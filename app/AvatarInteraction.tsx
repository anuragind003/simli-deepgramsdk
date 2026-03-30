import VideoBox from "@/app/components/VideoBox";
import cn from "@/app/utils/TailwindMergeAndClsx";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  generateIceServers,
  generateSimliSessionToken,
  LogLevel,
  SimliClient,
} from "simli-client";

interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

let simliClient: SimliClient | null = null;

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
  simli_faceid,
  elevenlabs_voiceid,
  initialPrompt,
  onStart,
  showDottedFace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isSocketOpen, setIsSocketOpen] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [agentTranscript, setAgentTranscript] = useState("");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const initializeWebSocket = useCallback((connectionId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;

    socketRef.current = new WebSocket(
      `${protocol}://${host}/ws?connectionId=${connectionId}`,
    );

    socketRef.current.onopen = () => {
      console.log("Connected to server");
      setIsSocketOpen(true);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket Disconnected");
      setIsSocketOpen(false);
    };

    socketRef.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);
          simliClient?.sendAudioData(uint8Array);
        });
        return;
      }

      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "ready":
            console.log("Voice agent is ready");
            break;
          case "userTranscript":
            setUserTranscript((prev) => {
              const next = prev
                ? `${prev}\n${message.content}`
                : message.content;
              return next;
            });
            break;
          case "agentTranscript":
            setAgentTranscript(message.content);
            break;
          case "userStartedSpeaking":
            console.log("User started speaking");
            simliClient?.ClearBuffer();
            setIsAgentSpeaking(false);
            break;
          case "agentStartedSpeaking":
            console.log("Agent started speaking");
            setIsAgentSpeaking(true);
            break;
          case "agentAudioDone":
            console.log("Agent audio done");
            setIsAgentSpeaking(false);
            break;
          case "interrupt":
            console.log("Interrupting current response");
            simliClient?.ClearBuffer();
            setIsAgentSpeaking(false);
            break;
          case "error":
            console.error("Agent error:", message.error);
            setError(String(message.error));
            break;
          default:
            console.warn("Unhandled message from server:", message);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError(
        "WebSocket connection error. Please check if the server is running.",
      );
    };
  }, []);

  const startConversation = useCallback(async () => {
    try {
      const baseUrl =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "";

      const response = await fetch(`${baseUrl}/start-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: initialPrompt,
          voiceId: elevenlabs_voiceid,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const data = await response.json();
      initializeWebSocket(data.connectionId);
    } catch (error) {
      console.error("Error starting conversation:", error);
      window.alert(
        `Whoopsie! Encountered the following error(s):\n\n[${error}].\n\nTry fixing those and restarting the application (npm run start).`,
      );
      handleStop();
      setError("Failed to start conversation. Please try again.");
    }
  }, [elevenlabs_voiceid, initialPrompt, initializeWebSocket]);

  const initializeSimliClient = useCallback(async () => {
    if (!videoRef.current || !audioRef.current) {
      console.error("initializeSimliClient: videoRef or audioRef is null");
      return;
    }
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        faceId: simli_faceid,
        maxIdleTime: 600,
        maxSessionLength: 600,
        handleSilence: true,
      };

      const sessionToken = (
        await generateSimliSessionToken({
          apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY as string,
          config: SimliConfig,
        })
      ).session_token;

      let iceServers;
      try {
        iceServers = await generateIceServers(
          process.env.NEXT_PUBLIC_SIMLI_API_KEY as string,
        );
      } catch (err) {
        console.warn(
          "Unable to fetch Simli ICE servers, falling back to public STUN:",
          err,
        );
        iceServers = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ];
      }

      simliClient = new SimliClient(
        sessionToken,
        videoRef.current,
        audioRef.current,
        [],
        LogLevel.DEBUG,
        "livekit",
      );
      simliClient.on("start", () => {
        console.log("SimliClient connected");
        setIsAvatarVisible(true);
        const audioData = new Uint8Array(6000).fill(0);
        simliClient?.sendAudioData(audioData);
      });

      try {
        await simliClient.start();
      } catch (startError: any) {
        console.error("SimliClient failed to start:", startError);
        console.error("SimliClient error details:", {
          message: startError?.message,
          status: startError?.status,
          response: startError?.response,
          stack: startError?.stack,
        });
        setError(
          "Simli client failed to start. Verify your SIMLI API key, face ID, and network connectivity.",
        );
        return;
      }

      await startConversation();
    }
  }, [simli_faceid, startConversation]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(input);
        const bytes = new Uint8Array(pcm16);
        // Send raw 16-bit PCM bytes to the server (Deepgram agent expects linear16).
        socketRef.current.send(bytes);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store cleanup references on the stream for later
      (stream as any)._audioContext = audioContext;
      (stream as any)._processor = processor;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
    }
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();
    await initializeSimliClient();
    startRecording();
  }, [onStart, initializeSimliClient]);

  const handleStop = useCallback(() => {
    setIsLoading(false);
    setError("");
    setIsAvatarVisible(false);

    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      const audioContext = (audioStream as any)._audioContext as AudioContext;
      const processor = (audioStream as any)._processor as ScriptProcessorNode;
      processor?.disconnect();
      audioContext?.close();
      setAudioStream(null);
    }

    simliClient?.stop();
    simliClient = null;
    socketRef.current?.close();
    window.location.href = "/";
  }, [audioStream]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      simliClient?.stop();
      simliClient = null;
    };
  }, []);

  // We send raw PCM audio from the ScriptProcessor only. Using MediaRecorder here
  // can send compressed audio (e.g., Opus in WebM) which will not match the
  // voice agent's `linear16` audio input settings.
  // If you want to use MediaRecorder, you must match the encoding and sample rate
  // on the server and ensure the agent is configured for that format.

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          showDottedFace ? "h-0 overflow-hidden" : "h-auto"
        }`}
      >
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex flex-col items-center">
        {!isAvatarVisible ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className={cn(
              "w-full h-[52px] mt-4 disabled:bg-[#343434] disabled:text-white disabled:hover:rounded-[100px] bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
              "flex justify-center items-center",
            )}
          >
            {isLoading ? (
              <IconSparkleLoader className="h-[20px] animate-loader" />
            ) : (
              <span className="font-abc-repro-mono font-bold w-[164px]">
                Test Interaction
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={handleStop}
              className={cn(
                "mt-4 group text-white flex-grow bg-red hover:rounded-sm hover:bg-white h-[52px] px-6 rounded-[100px] transition-all duration-300",
              )}
            >
              <span className="font-abc-repro-mono group-hover:text-black font-bold w-[164px] transition-all duration-300">
                Stop Interaction
              </span>
            </button>
          </div>
        )}
      </div>
      <div className="mt-6 w-full max-w-lg rounded-3xl border border-slate-100 bg-slate-50/50 p-6 text-left text-sm text-slate-800 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-900 tracking-tight">
            Transcript
          </span>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isAgentSpeaking
                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-slate-200 text-slate-600 ring-1 ring-slate-300"
            }`}
          >
            {isAgentSpeaking ? "Agent Speaking" : "Listening..."}
          </span>
        </div>

        <div className="mb-4 max-h-48 overflow-y-auto rounded-2xl bg-white p-4 text-[13px] leading-relaxed shadow-inner border border-slate-100">
          <div className="mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              You
            </span>
            <div className="mt-1 whitespace-pre-wrap text-slate-700 font-medium">
              {userTranscript || "..."}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Agent
            </span>
            <div className="mt-1 whitespace-pre-wrap text-slate-800 font-semibold leading-snug">
              {agentTranscript || "..."}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs font-medium text-red-500 text-center">
            {error}
          </p>
        )}
      </div>
    </>
  );
};

export default AvatarInteraction;
