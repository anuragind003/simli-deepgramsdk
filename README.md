# Simli Agent App (Simli-Deepgram SDK)

A clean, minimalistic conversational AI interface powered by **Simli**, **Deepgram**, and **OpenAI**. This version uses manual orchestration for full control over the AI pipeline (STT -> LLM -> TTS).

### Features

- **Minimalistic UI:** A clean, white-themed interface designed for business and professional use.
- **Manual Orchestration:** Direct integration with Deepgram (STT/TTS) and OpenAI (GPT-4o-mini) for granular control.
- **Next.js Custom Server:** Unified frontend and backend running on a single port.
- **Simli SDK:** High-fidelity avatar rendering with real-time lip-sync.

### Environment variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SIMLI_API_KEY="your_simli_key"
NEXT_PUBLIC_SIMLI_FACE_ID="your_face_id"
DEEPGRAM_API_KEY="your_deepgram_key"
OPENAI_API_KEY="your_openai_key"
```

### Getting Started

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Run in development mode:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

### Architecture

This repo implements a **Manual Pipeline**:

1.  **STT:** Deepgram `nova-2` streams user audio.
2.  **LLM:** OpenAI `gpt-4o-mini` generates a streaming text response.
3.  **TTS:** Deepgram `speak` WebSocket converts text to PCM16 audio.
4.  **Avatar:** Simli Client renders the audio with lip-sync.

### Deployment

The project is optimized for deployment as a single Node.js application. Use `npm run build` and `npm start` to run the production server.

---

[Simli](https://simli.com) | [Deepgram](https://deepgram.com) | [OpenAI](https://openai.com)
