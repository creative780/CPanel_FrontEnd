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

// ---- Frontend key helpers (MUST be present on every request) ----
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
  // Visual config (unchanged)
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

  // Greeting bubble + icon animation flags
  const [showHi, setShowHi] = useState(false);
  const [animateIcon, setAnimateIcon] = useState(false);
  const [hiText, setHiText] = useState("Hi 👋");

  // Select prompt fills the input (send on Enter or click Send)
  const selectPrompt = (p: string) => {
    setInputValue(p);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ---- Robust fetch helpers ----
  const readAsJsonOrThrow = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    // Try JSON when header says JSON
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(bodyText);
      } catch {
        // fall through to detailed error below
      }
    }

    // Try JSON anyway (some servers omit the header)
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
        `API_BASE_URL appears invalid ("${API_BASE_URL}"). It must be an absolute URL to your Django server, e.g., "http://127.0.0.1:8000".`
      );
    }

    // Defaults (JSON + CORS), then inject FRONTEND KEY
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

    // Surface JSON error bodies or give a readable HTML snippet
    if (!res.ok) {
      try {
        const data = await readAsJsonOrThrow(res);
        throw new Error(
          `HTTP ${res.status} ${res.statusText} from ${url}. Server said: ${JSON.stringify(
            data
          ).slice(0, 300)}`
        );
      } catch (e: any) {
        const contentType = res.headers.get("content-type") || "";
        const txt = await res.text().catch(() => "");
        const snippet = (txt || "").slice(0, 300).replace(/\s+/g, " ");
        throw new Error(
          `HTTP ${res.status} ${res.statusText} from ${url}. ${
            e?.message || `Non-JSON error response. Content-Type="${contentType}". First chars: "${snippet}"`
          }`
        );
      }
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

  // First load: animate icon + show bubble + bootstrap convo with backend
  useEffect(() => {
    setAnimateIcon(true);
    setShowHi(true);

    const hiTimer = setTimeout(() => setShowHi(false), 2600);
    const animTimer = setTimeout(() => setAnimateIcon(false), 1800);

    const boot = async () => {
      try {
        const existing =
          typeof window !== "undefined"
            ? localStorage.getItem("cc_conversation_id")
            : null;

        const payload: any = { message: "" };
        if (existing) payload.conversation_id = existing;

        const data = await fetchJSON(`${API_BASE_URL}/api/user-response/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        // keep conversation id
        if (data?.conversation_id) {
          setConversationId(data.conversation_id);
          localStorage.setItem("cc_conversation_id", data.conversation_id);
        }

        // show greeting bubble + push greeting and the bot's first three messages
        if (data?.greeting) setHiText(data.greeting);
        const bootMsgs: Msg[] = [];
        if (data?.greeting) {
          bootMsgs.push({
            id: Date.now() + Math.random(),
            type: "bot",
            text: data.greeting,
            time: nowTime(),
          });
        }
        if (Array.isArray(data?.bot_openers)) {
          data.bot_openers.forEach((t: string) =>
            bootMsgs.push({
              id: Date.now() + Math.random(),
              type: "bot",
              text: t,
              time: nowTime(),
            })
          );
        }
        if (bootMsgs.length) {
          setMessages((prev) => [...prev, ...bootMsgs]);
        }

        // fetch initial prompts
        await refreshPrompts(data?.conversation_id || existing || null);
      } catch (e: any) {
        console.error("Boot error:", e);
        // fallback: still show a simple greeting locally
        setHiText("Hello! How can I help today?");
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            type: "bot",
            text:
              "Hello! How can I help today?\n\n" +
              (e?.message
                ? `Note: ${e.message}`
                : "The server returned a non-JSON response."),
            time: nowTime(),
          },
        ]);
      }
    };

    boot();

    return () => {
      clearTimeout(hiTimer);
      clearTimeout(animTimer);
    };
  }, []);

  const refreshPrompts = async (cid: string | null) => {
    try {
      const q = cid ? `?conversation_id=${encodeURIComponent(cid)}` : "";
      const data = await fetchJSON(`${API_BASE_URL}/api/bot-prompts/${q}`, {
        method: "GET",
      });

      const incoming = Array.isArray(data?.prompts)
        ? data.prompts.filter(Boolean)
        : [];
      const nextTwo = incoming.slice(0, 2);

      if (nextTwo.length) {
        setPrompts(nextTwo);
      }
    } catch (e) {
      console.warn("Prompt refresh failed:", e);
      // ignore; keep existing prompts
    }
  };

  // UI helpers
  const addMessage = (type: "bot" | "user", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), type, text, time: nowTime() },
    ]);
  };

  // Networked send: user-response ➜ bot-response ➜ refresh prompts
  const handleSend = async (raw?: string) => {
    const text = (raw ?? inputValue).trim();
    if (!text) return;

    // optimistic user message
    addMessage("user", text);
    setInputValue("");

    try {
      // 1) record + classify
      const d1 = await fetchJSON(`${API_BASE_URL}/api/user-response/`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
        }),
      });

      // capture/refresh conversation id if new
      if (d1?.conversation_id && d1.conversation_id !== conversationId) {
        setConversationId(d1.conversation_id);
        localStorage.setItem("cc_conversation_id", d1.conversation_id);
      }

      // short-circuit if irrelevant (bot gate)
      if (d1?.intent === "irrelevant" || d1?.relevant === false) {
        addMessage("bot", d1?.bot_gate || "I can't answer such type of question");
        await refreshPrompts(d1?.conversation_id || conversationId);
        return;
      }

      // 2) get actual bot reply
      try {
        const d2 = await fetchJSON(`${API_BASE_URL}/api/bot-response/`, {
          method: "POST",
          body: JSON.stringify({
            conversation_id: d1?.conversation_id || conversationId,
            message: text,
          }),
        });

        if (d2?.bot_text) {
          addMessage("bot", d2.bot_text);
        } else {
          addMessage("bot", "Sorry, I couldn’t process that.");
        }
      } catch (e: any) {
        console.error("bot-response error:", e);
        addMessage(
          "bot",
          `Server error while generating a reply.\n${e?.message ?? ""}`
        );
      }

      // 3) refresh prompts for next steps
      await refreshPrompts(d1?.conversation_id || conversationId);
    } catch (e: any) {
      console.error("user-response error:", e);
      addMessage(
        "bot",
        `Network error. Please try again.\n${e?.message ?? ""}`
      );
    }
  };

  // Position classes
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

  // Greeting bubble positioning relative to FAB
  const bubbleOffset =
    position === "bottom-right"
      ? "right-[5.25rem] bottom-2 origin-bottom-right"
      : position === "top-left"
      ? "left-[5.25rem] top-2 origin-top-left"
      : position === "top-right"
      ? "right-[5.25rem] top-2 origin-top-right"
      : "left-[5.25rem] bottom-2 origin-bottom-left";

  return (
    <div>
      {/* Floating Button + greeting bubble from BOT */}
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
              style={{ animationName: "fadeInOut, fadeInOut" }}
            >
              {hiText}
              <span
                className={cls(
                  "absolute w-3 h-3 bg-white border border-gray-200 rotate-45",
                  position === "bottom-right"
                    ? "right-[-6px] bottom-2"
                    : position === "bottom-left"
                    ? "left-[-6px] bottom-2"
                    : position === "top-right"
                    ? "right-[-6px] top-2"
                    : position === "top-left"
                    ? "left-[-6px] top-2"
                    : ""
                )}
              />
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
            <div className="w-full h-full rounded-full flex items-center justify-center">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner">
                <div
                  className={cls("w-7 h-7 rounded-full bg-gradient-to-r", primaryGradient)}
                />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cls(
              "fixed z-50 bg-white transition-all duration-300",
              "bottom-0 left-0 right-0 h-[92vh] rounded-t-[28px] shadow-2xl",
              "md:right-auto md:w-[420px] md:h-[550px] md:rounded-3xl md:shadow-[0_20px_60px_rgba(0,0,0,0.15)] md:bottom-[150px]",
              panelPos
            )}
            role="dialog"
            aria-label={`${botName} chat window`}
          >
            {/* Header */}
            <div
              className={cls(
                "p-5 flex items-center justify-between bg-gradient-to-r rounded-t-[28px] md:rounded-t-3xl",
                primaryGradient
              )}
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <div
                    className={cls("w-9 h-9 rounded-full bg-gradient-to-br", primaryGradient)}
                  />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{botName}</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-white/90 text-sm">Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition"
                aria-label={ariaCloseChat}
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white"
              style={{ height: "calc(100% - 200px)" }}
            >
              <div className="p-5 space-y-6">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cls("flex", m.type === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cls(
                        "flex items-end space-x-3 max-w-[85%]",
                        m.type === "user" && "flex-row-reverse space-x-reverse"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full flex-shrink-0 shadow-sm">
                        {m.type === "bot" ? (
                          <div
                            className={cls("w-9 h-9 rounded-full bg-gradient-to-br", secondaryGradient)}
                          />
                        ) : (
                          <div className="w-9 h-9 bg-red-500 rounded-full" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div
                          className={cls(
                            "px-5 py-4 text-sm leading-relaxed max-w-xs",
                            m.type === "bot"
                              ? "bg-gray-100 text-gray-800 rounded-[20px] rounded-bl-md shadow-sm border border-gray-200/50"
                              : "bg-white text-gray-800 rounded-[20px] rounded-br-md shadow-md border border-gray-200"
                          )}
                        >
                          <p className="whitespace-pre-line">{m.text}</p>
                        </div>
                        <div
                          className={cls(
                            "flex items-center space-x-2 mt-2 px-2",
                            m.type === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <span className="text-xs text-gray-500 font-medium">{m.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-gray-100 p-5 rounded-b-[28px] md:rounded-b-3xl">
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
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-500 px-2"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim()}
                  className={cls(
                    "text-white rounded-full p-3 transition duration-200 hover:scale-110 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none bg-gradient-to-r",
                    primaryGradient
                  )}
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
