"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Minus } from "lucide-react";

// util
const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// IMPORTANT: Make sure this really points to Django (e.g., "http://127.0.0.1:8000")
import { API_BASE_URL } from "../utils/api";

type Msg = { id: number; type: "bot" | "user"; text: string; time: string };

// ---- Frontend key helpers ----
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (!FRONTEND_KEY) {
    console.warn("NEXT_PUBLIC_FRONTEND_KEY is empty; requests may be forbidden.");
  }
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

export function ChatBot() {
  // Visual config
  const botName = "CreativeAI";
  const primaryGradient = "bg-[#891F1A]";
  const secondaryGradient = "bg-[#891F1A]";
  const position = "bottom-left" as
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right";

  const ariaOpenChat = "Open chat";
  const ariaCloseChat = "Close chat";
  const inputPlaceholder = "Type a message…";

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [prompts, setPrompts] = useState<string[]>([
    "I want to buy some expensive products.",
    "Show me some premium categories.",
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Greeting bubble
  const [showHi, setShowHi] = useState(false);
  const [animateIcon, setAnimateIcon] = useState(false);
  const [hiText, setHiText] = useState("Hi 👋");

  const selectPrompt = (p: string) => {
    setInputValue(p);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ---- Fetch helpers ----
  const readAsJsonOrThrow = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(bodyText);
      } catch {}
    }
    try {
      return JSON.parse(bodyText);
    } catch {
      const snippet = bodyText.slice(0, 300).replace(/\s+/g, " ");
      throw new Error(
        `Expected JSON but got ${res.status} ${res.statusText}. Content-Type="${contentType}". First chars: "${snippet}"`
      );
    }
  };

  const fetchJSON = async (url: string, init?: RequestInit) => {
    if (!API_BASE_URL || API_BASE_URL.startsWith("/") || API_BASE_URL === "") {
      throw new Error(
        `API_BASE_URL appears invalid ("${API_BASE_URL}"). It must be an absolute URL to your Django server.`
      );
    }
    const baseInit: RequestInit = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      mode: "cors",
      ...init,
    };
    const finalInit = withFrontendKey(baseInit);
    const res = await fetch(url, finalInit);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    }
    return readAsJsonOrThrow(res);
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Boot with greeting
  useEffect(() => {
    setAnimateIcon(true);
    setShowHi(true);
    const hiTimer = setTimeout(() => setShowHi(false), 2600);
    const animTimer = setTimeout(() => setAnimateIcon(false), 1800);
    return () => {
      clearTimeout(hiTimer);
      clearTimeout(animTimer);
    };
  }, []);

  // UI helpers
  const addMessage = (type: "bot" | "user", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), type, text, time: nowTime() },
    ]);
  };

  const handleSend = async (raw?: string) => {
    const text = (raw ?? inputValue).trim();
    if (!text) return;
    addMessage("user", text);
    setInputValue("");
    // simplified network calls omitted for brevity
  };

  // Positions
  const fabPos =
    position === "bottom-right"
      ? "bottom-6 right-6"
      : position === "top-left"
      ? "top-6 left-6"
      : position === "top-right"
      ? "top-6 right-6"
      : "bottom-6 left-6";

  const panelPos =
    position === "bottom-right"
      ? "md:bottom-24 md:right-6"
      : position === "top-left"
      ? "md:top-24 md:left-6"
      : position === "top-right"
      ? "md:top-24 md:right-6"
      : "md:bottom-24 md:left-6";

  const bubbleOffset =
    position === "bottom-right"
      ? "right-[5.25rem] bottom-2 origin-bottom-right"
      : position === "top-left"
      ? "left-[5.25rem] top-2 origin-top-left"
      : position === "top-right"
      ? "right-[5.25rem] top-2 origin-top-right"
      : "left-[5.25rem] bottom-2 origin-bottom-left";

  return (
    <div
      style={{ fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif" }}
    >
      {/* FAB + Greeting bubble */}
      <div className={cls("fixed z-50", fabPos)}>
        <div className="relative">
          {showHi && (
            <div
              className={cls(
                "absolute px-5 py-1.5 text-sm font-semibold bg-red-500 border border-gray-200 shadow-md",
                "transition transform scale-100 opacity-100",
                "animate-[fadeInOut_2.6s_ease-in-out_forwards]",
                bubbleOffset
              )}
            >
              {/* small → Light (300) */}
              <small className="font-light">{hiText}</small>
            </div>
          )}
          <button
            onClick={() => setIsOpen((v) => !v)}
            className={cls(
              "relative w-16 h-16 rounded-full shadow-xl transition-all duration-300 bg-gradient-to-r hover:scale-110",
              primaryGradient,
              animateIcon && "animate-bounce"
            )}
            aria-label={isOpen ? ariaCloseChat : ariaOpenChat}
          >
            {animateIcon && (
              <span className="pointer-events-none absolute inset-0 rounded-full ring-8 ring-indigo-300/40 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Panel */}
      {isOpen && (
        <div
          className={cls(
            "fixed z-50 bg-white transition-all duration-300",
            "bottom-0 left-0 right-0 h-[92vh] rounded-t-[28px] shadow-2xl",
            "md:right-auto md:w-[420px] md:h-[550px] md:rounded-3xl md:shadow-[0_20px_60px_rgba(0,0,0,0.15)] md:bottom-[150px]",
            panelPos
          )}
        >
          {/* Header */}
          <header
            className={cls(
              "p-5 flex items-center justify-between bg-gradient-to-r rounded-t-[28px] md:rounded-t-3xl",
              primaryGradient
            )}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg" />
              <div>
                {/* h3 → Medium (500) */}
                <h3 className="text-white font-bold text-lg">{botName}</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                  {/* span → Regular (400) */}
                  <span className="text-white/90 text-sm font-normal">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label={ariaCloseChat}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center"
            >
              <Minus className="w-5 h-5" />
            </button>
          </header>

          {/* Messages */}
          <main
            className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white"
            style={{ height: "calc(100% - 200px)" }}
          >
            <div className="p-5 space-y-6">
              {messages.map((m) => (
                <article key={m.id} className={cls("flex", m.type === "user" ? "justify-end" : "justify-start")}>
                  <div className="flex flex-col">
                    {/* p → Regular (400) */}
                    <p className="px-5 py-4 text-sm leading-relaxed bg-gray-100 text-gray-800 rounded-lg whitespace-pre-line">
                      {m.text}
                    </p>
                    {/* time → small (300) */}
                    <small className="text-xs text-gray-500 font-light mt-1">{m.time}</small>
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-100 p-5 rounded-b-[28px] md:rounded-b-3xl">
            {/* Prompts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {prompts.map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  onClick={() => selectPrompt(p)}
                  className="inline-flex items-center px-4 py-2.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Input */}
            <div className="flex items-center space-x-3 bg-gray-50 rounded-full p-3 border border-gray-200/50 shadow-sm text-black">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={inputPlaceholder}
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-500 px-2 font-normal"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim()}
                className="text-white rounded-full p-3 font-medium"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
