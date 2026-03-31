import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import next from "next";
import OpenAI from "openai";
import path from "path";
import url from "url";
import { WebSocket, WebSocketServer } from "ws";
import { validateApiKeys } from "./utils/validateApiKeys";

// load environment variables from .env.local (Next.js uses .env.local too)
dotenv.config({ path: ".env.local" });

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful virtual assistant. Keep responses concise and conversational.";
const MAX_HISTORY_MESSAGES = 20;

type OpenAIStreamState = {
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  controller: AbortController;
};

type ConnectionState = {
  prompt: string;
  voiceId: string;
  ws?: WebSocket;
  deepgram?: {
    send: (data: any) => void;
    getReadyState: () => number;
    keepAlive: () => void;
    removeAllListeners: () => void;
  };
  currentOpenAIStream: OpenAIStreamState | null;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
};

const connections = new Map<string, ConnectionState>();

const trimConversationHistory = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
) => {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return messages;
  }

  const [system, ...rest] = messages;
  if (!system) {
    return messages.slice(-MAX_HISTORY_MESSAGES);
  }

  return [system, ...rest.slice(-(MAX_HISTORY_MESSAGES - 1))];
};

const interruptCurrentStream = (connectionId: string, ws: WebSocket) => {
  const connection = connections.get(connectionId);
  if (!connection?.currentOpenAIStream) {
    return;
  }

  console.log(`Interrupting current stream (ID: ${connectionId})`);
  connection.currentOpenAIStream.controller.abort();
  connection.currentOpenAIStream = null;
  ws.send(JSON.stringify({ type: "interrupt" }));
};

app.post("/start-conversation", (req: any, res: any) => {
  const { prompt, voiceId } = req.body as { prompt: string; voiceId: string };
  if (!prompt || !voiceId) {
    return res.status(400).json({ error: "Prompt and voiceId are required" });
  }

  const validate = validateApiKeys();
  if (!validate.valid) {
    console.error(
      "API key validation failed. Fix the following errors and run `npm run start` again:",
      validate.errors,
    );
    return res
      .status(400)
      .json({ error: "API key invalid: " + validate.errors });
  }

  const systemPrompt = prompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const connectionId = Date.now().toString();
  connections.set(connectionId, {
    prompt: systemPrompt,
    voiceId,
    currentOpenAIStream: null,
    messages: [{ role: "system", content: systemPrompt }],
  });

  res.json({
    connectionId,
    message: "Conversation started. Connect to WebSocket to continue.",
  });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (!request.url) {
    socket.destroy();
    return;
  }

  const { pathname, query } = url.parse(request.url, true);

  if (pathname === "/ws") {
    const connectionId =
      typeof query.connectionId === "string" ? query.connectionId : undefined;

    if (!connectionId || !connections.has(connectionId)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const connection = connections.get(connectionId);
      if (!connection) {
        socket.destroy();
        return;
      }

      console.log(`WebSocket: Client connected (ID: ${connectionId})`);
      setupWebSocket(ws, connection.prompt, connection.voiceId, connectionId);
    });
  } else {
    // Let Next.js handle its own WebSockets (like HMR)
    const nextUpgradeHandler = nextApp.getUpgradeHandler();
    nextUpgradeHandler(request, socket, head);
  }
});

const setupWebSocket = (
  ws: WebSocket,
  initialPrompt: string,
  voiceId: string,
  connectionId: string,
) => {
  let isFinals: string[] = [];
  let audioQueue: any[] = [];
  let keepAlive: NodeJS.Timeout;
  let userSpeakingNotified = false;

  const deepgram = deepgramClient.listen.live({
    model: "nova-2",
    language: "en",
    smart_format: true,
    no_delay: true,
    interim_results: true,
    endpointing: 300,
    utterance_end_ms: 1000,
    encoding: "linear16",
    sample_rate: 48000,
    channels: 1,
  });

  deepgram.addListener(LiveTranscriptionEvents.Open, () => {
    console.log(`Deepgram STT: Connected (ID: ${connectionId})`);
    ws.send(JSON.stringify({ type: "ready" }));

    while (audioQueue.length > 0) {
      const audioData = audioQueue.shift();
      deepgram.send(audioData);
    }
  });

  deepgram.addListener(LiveTranscriptionEvents.Transcript, (data: any) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript || "";
    if (!transcript) {
      return;
    }

    if (!data.is_final && !userSpeakingNotified) {
      userSpeakingNotified = true;
      ws.send(JSON.stringify({ type: "userStartedSpeaking" }));
    }

    if (data.is_final) {
      isFinals.push(transcript);

      if (data.speech_final) {
        const utterance = isFinals.join(" ");
        isFinals = [];
        userSpeakingNotified = false;

        ws.send(JSON.stringify({ type: "userTranscript", content: utterance }));
        console.log(
          `Deepgram STT: [Speech Final] ${utterance} (ID: ${connectionId})`,
        );

        interruptCurrentStream(connectionId, ws);

        promptLLM(ws, utterance, connectionId);
      }
    }
  });

  deepgram.addListener(LiveTranscriptionEvents.UtteranceEnd, () => {
    if (isFinals.length > 0) {
      const utterance = isFinals.join(" ");
      isFinals = [];
      userSpeakingNotified = false;

      ws.send(JSON.stringify({ type: "userTranscript", content: utterance }));
      console.log(
        `Deepgram STT: [Speech Final] ${utterance} (ID: ${connectionId})`,
      );

      interruptCurrentStream(connectionId, ws);

      promptLLM(ws, utterance, connectionId);
    }
  });

  deepgram.addListener(LiveTranscriptionEvents.Close, () => {
    console.log(`Deepgram STT: Disconnected (ID: ${connectionId})`);
    clearInterval(keepAlive);
    deepgram.removeAllListeners();
  });

  deepgram.addListener(LiveTranscriptionEvents.Error, (error: any) => {
    console.error(`Deepgram STT error (ID: ${connectionId}):`, error);
    ws.send(JSON.stringify({ type: "error", error: String(error) }));
  });

  ws.on("message", (message: any) => {
    if (deepgram.getReadyState() === 1) {
      deepgram.send(message);
    } else {
      audioQueue.push(message);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket: Client disconnected (ID: ${connectionId})`);
    clearInterval(keepAlive);

    const connection = connections.get(connectionId);
    if (connection?.currentOpenAIStream) {
      connection.currentOpenAIStream.controller.abort();
      connection.currentOpenAIStream = null;
    }

    deepgram.removeAllListeners();
    connections.delete(connectionId);
  });

  keepAlive = setInterval(() => {
    deepgram.keepAlive();
  }, 5_000);

  const existingConnection = connections.get(connectionId);
  if (!existingConnection) {
    ws.close();
    deepgram.removeAllListeners();
    return;
  }

  connections.set(connectionId, {
    ...existingConnection,
    ws,
    deepgram,
  });
};

async function promptLLM(ws: WebSocket, prompt: string, connectionId: string) {
  const connection = connections.get(connectionId);
  if (!connection) {
    return;
  }

  try {
    connection.messages.push({ role: "user", content: prompt });
    connection.messages = trimConversationHistory(connection.messages);

    const controller = new AbortController();
    const stream = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: connection.messages,
        temperature: 1,
        max_tokens: 120,
        top_p: 1,
        stream: true,
      },
      { signal: controller.signal },
    );

    connection.currentOpenAIStream = { stream, controller };

    let fullResponse = "";
    let deepgramTtsWs: WebSocket | undefined;
    let startedSpeakingSent = false;

    try {
      for await (const chunk of stream) {
        if (!connections.has(connectionId)) {
          console.log(
            `LLM process stopped: Connection ${connectionId} no longer exists`,
          );
          break;
        }

        const chunkMessage = chunk.choices[0]?.delta?.content || "";
        if (!chunkMessage) {
          continue;
        }

        fullResponse += chunkMessage;
        ws.send(
          JSON.stringify({ type: "agentTranscript", content: fullResponse }),
        );

        if (!deepgramTtsWs) {
          deepgramTtsWs = await startDeepgramTtsStreaming(
            ws,
            connection.voiceId,
            connectionId,
          );
        }

        if (!startedSpeakingSent) {
          startedSpeakingSent = true;
          ws.send(JSON.stringify({ type: "agentStartedSpeaking" }));
        }

        deepgramTtsWs.send(
          JSON.stringify({ type: "Speak", text: chunkMessage }),
        );
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("OpenAI stream aborted due to new speech");
        if (deepgramTtsWs) {
          deepgramTtsWs.close();
        }
      } else {
        throw error;
      }
    }

    connection.currentOpenAIStream = null;

    if (fullResponse.trim()) {
      connection.messages.push({ role: "assistant", content: fullResponse });
      connection.messages = trimConversationHistory(connection.messages);
    }

    if (deepgramTtsWs) {
      deepgramTtsWs.send(JSON.stringify({ type: "Flush" }));
    }
  } catch (error) {
    connection.currentOpenAIStream = null;
    console.error(`Error in promptLLM (ID: ${connectionId}):`, error);
    ws.send(JSON.stringify({ type: "error", error: String(error) }));
  }
}

async function startDeepgramTtsStreaming(
  ws: WebSocket,
  voiceId: string,
  connectionId: string,
) {
  return new Promise<WebSocket>((resolve, reject) => {
    const deepgramTtsWs = new WebSocket(
      `wss://api.deepgram.com/v1/speak?model=${voiceId}&encoding=linear16&sample_rate=16000`,
      { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } },
    );

    deepgramTtsWs.on("open", () => {
      console.log(`Connected to Deepgram TTS WebSocket (ID: ${connectionId})`);
      resolve(deepgramTtsWs);
    });

    deepgramTtsWs.on("message", (data: any) => {
      if (!connections.has(connectionId)) {
        console.log(
          `Deepgram TTS process stopped: Connection ${connectionId} no longer exists`,
        );
        deepgramTtsWs.close();
        return;
      }

      if (data instanceof Buffer) {
        const chunkSize = 5 * 1024;
        let i = 0;

        while (i < data.length) {
          const end = Math.min(i + chunkSize, data.length);
          ws.send(data.slice(i, end));
          i += chunkSize;
        }
      } else {
        const message = JSON.parse(data.toString());
        if (message.type === "Flushed") {
          console.log(`Deepgram TTS streaming completed (ID: ${connectionId})`);
          ws.send(JSON.stringify({ type: "agentAudioDone" }));
          deepgramTtsWs.send(JSON.stringify({ type: "Close" }));
        }
      }
    });

    deepgramTtsWs.on("error", (error) => {
      console.error(
        `Deepgram TTS WebSocket error (ID: ${connectionId}):`,
        error,
      );
      reject(error);
    });

    deepgramTtsWs.on("close", () => {
      console.log(`Deepgram TTS WebSocket closed (ID: ${connectionId})`);
    });
  });
}

async function main() {
  try {
    if (dev) {
      const devLockPath = path.join(process.cwd(), ".next", "dev", "lock");
      try {
        fs.rmSync(devLockPath, { force: true });
      } catch (_error) {
        // ignore
      }
    }

    await nextApp.prepare();

    app.all("*", (req, res) => nextHandler(req, res));

    const port = Number(process.env.PORT) || 8080;
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
