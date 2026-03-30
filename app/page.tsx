"use client";
import AvatarInteraction from "@/app/AvatarInteraction";
import DottedFace from "@/app/components/DottedFace";
import React, { useState } from "react";
import { Toaster } from "react-hot-toast";

// Update the Avatar interface to include an image URL
interface Avatar {
  name: string;
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
}

// Updated JSON structure for avatar data with image URLs
const avatar: Avatar = {
  name: "Chrystal",
  simli_faceid:
    process.env.NEXT_PUBLIC_SIMLI_FACE_ID ||
    "b9e5fba3-071a-4e35-896e-211c4d6eaa7b",
  elevenlabs_voiceid: "aura-2-thalia-en",
  initialPrompt:
    "You are a support agent for Simli and you're living in local Create-Simli-App, the interactive demo for Simli that you can start building from. You can swap me out with other characters.",
};

const Demo: React.FC = () => {
  const [error, setError] = useState("");
  const [showDottedFace, setShowDottedFace] = useState(true);
  const [scriptContext, setScriptContext] = useState("");
  const [mode, setMode] = useState<"interview" | "teacher">("interview");

  const dynamicPrompt =
    mode === "interview"
      ? `You are a helpful assistant engaging the user based on the following script context. Interact with the user using this context: ${scriptContext}. IMPORTANT: Speak conversational text only. Do NOT use markdown like bold, italics, or headers. Keep it natural and do not use exclamation marks or spell out punctuation!`
      : `You are a helpful teacher explaining the concepts in the following script. Explain it step by step. If the user interrupts, resolve their query and then continue explaining the concept. Script context: ${scriptContext}. IMPORTANT: Speak conversational text only. Do NOT use markdown like bold, italics, or headers. Keep it natural and do not use exclamation marks or spell out punctuation!`;

  const onStart = () => {
    setShowDottedFace(false);
  };

  return (
    <>
      <Toaster />
      <div className="relative min-h-screen overflow-hidden font-sans text-slate-800 bg-white">
        {/* Decorative Background Removal for minimalism */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-5">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Cpath d=\'M30 0l-1 1v28h-28l-1 1 1 1h28v28l1 1 1-1v-28h28l1-1-1-1h-28v-28z\' fill=\'%23000\' fill-opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-30"></div>
        </div>

        {/* Header */}
        <header className="relative z-10 mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
                <span className="text-xl font-semibold text-white">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Simli Agent
                </h1>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                  Intelligent Voice Interaction
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-wide text-indigo-700 ring-1 ring-slate-200">
                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse" />
                Live Agent
              </span>
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Voice Interface
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Click 'Test Interaction' to start a conversation with the AI
                  avatar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  Real-time
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Voice AI
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-5 pb-12 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Configuration Panel */}
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-6 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="absolute inset-0 opacity-40 [mask-image:linear-gradient(180deg,rgba(0,0,0,0.7),transparent)]" />
              <div className="relative flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Agent Configuration
                  </h2>
                  <p className="mt-1 text-sm text-slate-100/70">
                    Pick a mode and provide the context for your session.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-semibold text-white/90">
                      Operational Mode
                    </span>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <label
                        className={`flex-1 cursor-pointer rounded-2xl border border-white/10 p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/10 ${
                          mode === "interview"
                            ? "bg-gradient-to-br from-indigo-500/70 to-sky-500/40 text-white shadow-lg"
                            : "bg-white/5 text-slate-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          value="interview"
                          className="sr-only"
                          checked={mode === "interview"}
                          onChange={() => setMode("interview")}
                        />
                        <span className="font-medium">Interview</span>
                        <span className="mt-1 block text-xs text-white/70">
                          Interactive Q&A based on context
                        </span>
                      </label>

                      <label
                        className={`flex-1 cursor-pointer rounded-2xl border border-white/10 p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/10 ${
                          mode === "teacher"
                            ? "bg-gradient-to-br from-emerald-500/60 to-teal-500/40 text-white shadow-lg"
                            : "bg-white/5 text-slate-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          value="teacher"
                          className="sr-only"
                          checked={mode === "teacher"}
                          onChange={() => setMode("teacher")}
                        />
                        <span className="font-medium">Teacher</span>
                        <span className="mt-1 block text-xs text-white/70">
                          Guided explanation & concept breakdown
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-white/90">
                      Context / Script
                    </span>
                    <textarea
                      className="h-48 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/90 shadow-inner outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                      placeholder="Enter the transcript, concepts, or details you want the agent to use..."
                      value={scriptContext}
                      onChange={(e) => setScriptContext(e.target.value)}
                    />
                    <p className="text-xs text-white/60">
                      You can paste a transcript, key points, or anything you'd
                      like the avatar to reference.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Interaction Panel */}
            <section className="relative flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-6 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/90">
                    Live Interaction
                  </h3>
                  <p className="text-xs text-white/60">
                    Real-time voice experience with this avatar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        showDottedFace ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        showDottedFace ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    ></span>
                  </span>
                  <span className="text-xs font-medium text-white/70">
                    {showDottedFace ? "Standby" : "Active"}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
                <div className="relative w-full max-w-sm">
                  {showDottedFace && (
                    <div className="mb-4 overflow-hidden rounded-3xl bg-black/30 border border-white/10 shadow-lg backdrop-blur">
                      <DottedFace />
                    </div>
                  )}

                  <AvatarInteraction
                    simli_faceid={avatar.simli_faceid}
                    elevenlabs_voiceid={avatar.elevenlabs_voiceid}
                    initialPrompt={dynamicPrompt}
                    onStart={onStart}
                    showDottedFace={showDottedFace}
                  />
                </div>

                <div className="mt-1 flex w-full max-w-sm flex-col items-center gap-2">
                  <p className="text-xs text-white/60">
                    Tip: Try asking questions like “How would you solve X?” or
                    “Explain how … works”.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span className="inline-flex h-1 w-1 rounded-full bg-white/50" />
                    <span>Powered by Simli</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/40">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-xs text-white/60">
            <span>
              © {new Date().getFullYear()} Simli. Built for modern voice AI
              experiences.
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              <span>Secure by design</span>
            </span>
          </footer>
        </main>
      </div>
    </>
  );
};

export default Demo;
