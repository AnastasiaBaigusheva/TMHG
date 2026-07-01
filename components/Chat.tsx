"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Map from "@/components/Map";
import {
  MAX_USER_MESSAGE_LENGTH,
  containsCrisisLanguage,
  GameState,
  INITIAL_GAME_STATE,
} from "@/lib/anthropic";

type Role = "user" | "assistant";
interface ChatMsg { role: Role; content: string; }

const CRISIS_NOTICE =
  "Похоже, вы пишете о чём-то очень тяжёлом. Это важнее игры. Пожалуйста, обратитесь к близкому человеку, специалисту или в экстренную службу вашей страны прямо сейчас.";

const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_GAME_STATE === "true";

export default function Chat() {
  const [messages,  setMessages]  = useState<ChatMsg[]>([]);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [paused,    setPaused]    = useState(false);
  const [crisis,    setCrisis]    = useState(false);
  const [mapOpen,   setMapOpen]   = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initiated  = useRef(false);
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";
  const finished = gameState.stage === "finished";

  // Auto-scroll messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Init
  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;
    callApi([{ role: "user", content: "__INIT__" }], INITIAL_GAME_STATE);
  }, []);

  async function callApi(history: ChatMsg[], state: GameState) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, gameState: state }),
      });
      const data = await res.json().catch(() => ({})) as {
        content?: string; gameState?: GameState; error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Ошибка при обращении к ИИ.");

      const assistantText = data.content ?? "";
      const newState: GameState = data.gameState ?? { ...state, turnCount: state.turnCount + 1 };
      const isInit = history.length === 1 && history[0].content === "__INIT__";
      setMessages((prev) => {
        const visible = isInit ? [] : prev;
        return [...visible, { role: "assistant", content: assistantText }];
      });
      setGameState(newState);
      if (newState.safetyFlag) { setCrisis(true); setPaused(true); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || loading) return;
    if (trimmed.length > MAX_USER_MESSAGE_LENGTH) {
      setError(`Максимум ${MAX_USER_MESSAGE_LENGTH} символов.`);
      return;
    }
    if (containsCrisisLanguage(trimmed)) { setCrisis(true); setPaused(true); }
    const newHistory: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newHistory);
    if (!overrideText) setInput("");
    callApi(newHistory, gameState);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // On mobile (touch), Enter should insert newline — only use shortcut on desktop
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePause() {
    if (paused && !crisis) { setPaused(false); }
    else if (!paused) { setPaused(true); handleSend("Я хочу сделать паузу."); }
  }

  function handleFinish() {
    if (finished || loading) return;
    handleSend("Я хочу завершить игру и получить краткое резюме.");
  }

  return (
    // h-dvh = dynamic viewport height — корректно работает при открытой клавиатуре на мобайле
    <div className="flex flex-col bg-bg" style={{ height: "100dvh" }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center justify-between gap-2">
        {/* Left: back + title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex-shrink-0 text-[#8e8b85] hover:text-white transition-colors p-1 -ml-1"
            aria-label="Выход"
          >
            {/* Left arrow SVG — no external icon font needed */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <span className="text-sm font-medium truncate text-[#e9e7e2]">
            Самая сложная игра
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Map toggle (mobile only) */}
          <button
            onClick={() => setMapOpen((v) => !v)}
            className="lg:hidden p-2 rounded-full border border-border text-[#8e8b85] hover:border-accent hover:text-accent transition-colors"
            aria-label="Карта исследования"
            title="Карта"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </button>

          <button
            onClick={handlePause}
            disabled={loading || crisis}
            className="text-xs px-2.5 py-1.5 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {paused && !crisis ? "Продолжить" : "Пауза"}
          </button>

          <button
            onClick={handleFinish}
            disabled={finished || loading}
            className="text-xs px-2.5 py-1.5 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            Завершить
          </button>
        </div>
      </header>

      {/* ── MAP DRAWER (mobile) ─────────────────────────────── */}
      {mapOpen && (
        <div className="lg:hidden flex-shrink-0 border-b border-border bg-panel px-4 py-4 space-y-3">
          <Map openedZones={gameState.openedZones} currentZone={gameState.currentZone} />
          <p className="text-[11px] text-[#5a5853]">
            Не терапия, не диагностика, не замена психолога.
          </p>
          {DEBUG_MODE && (
            <pre className="text-[10px] font-mono text-[#7a7770] overflow-auto max-h-48 break-all">
              {JSON.stringify(gameState, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar (desktop only) */}
        <aside className="hidden lg:flex flex-col gap-4 w-56 flex-shrink-0 border-r border-border px-4 py-5 overflow-y-auto">
          <Map openedZones={gameState.openedZones} currentZone={gameState.currentZone} />
          <p className="text-[11px] leading-relaxed text-[#5a5853]">
            Это не терапия, не диагностика и не замена психолога. Если тема
            становится слишком тяжёлой — сделайте паузу.
          </p>
          {DEBUG_MODE && (
            <div className="rounded-xl border border-border bg-bg p-3 text-[10px] font-mono text-[#7a7770] overflow-auto max-h-96 break-all">
              <p className="text-accent mb-1 font-semibold">DEBUG</p>
              <pre>{JSON.stringify(gameState, null, 2)}</pre>
            </div>
          )}
        </aside>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
            // Prevent rubber-band scroll stealing focus from textarea on iOS
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={[
                  "max-w-[88%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-bg rounded-br-sm"
                    : "bg-white/[0.05] text-[#e3e0d9] border border-border rounded-bl-sm",
                ].join(" ")}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] bg-white/[0.05] border border-border text-[#8e8b85]">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                </div>
              </div>
            )}

            {crisis && (
              <div className="rounded-2xl px-4 py-3 text-sm bg-red-950/40 border border-red-800/60 text-red-200">
                {CRISIS_NOTICE}
              </div>
            )}

            {error && (
              <div className="rounded-2xl px-4 py-3 text-sm bg-red-950/30 border border-red-900/50 text-red-300 flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">!</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* ── INPUT AREA ──────────────────────────────────── */}
          <div
            className="flex-shrink-0 border-t border-border bg-bg px-3 pt-3 pb-3"
            // pb with safe-area for iPhone home bar
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {paused && !crisis && (
              <div className="mb-2 text-xs text-[#8e8b85] bg-white/[0.03] border border-border rounded-xl px-3 py-2 text-center">
                Пауза. Нажмите «Продолжить», когда будете готовы.
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_USER_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                disabled={loading || paused || finished}
                placeholder={
                  finished ? "Игра завершена." :
                  paused   ? "Игра на паузе…"  :
                             "Напишите ответ…"
                }
                rows={1}
                className="flex-1 resize-none bg-white/[0.04] border border-border rounded-2xl px-4 py-3 text-[15px] text-[#e9e7e2] placeholder:text-[#4a4844] focus:outline-none focus:border-accent disabled:opacity-50 leading-relaxed"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />

              {/* Send button — icon on mobile, text on desktop */}
              <button
                onClick={() => handleSend()}
                disabled={loading || paused || finished || !input.trim()}
                className="flex-shrink-0 w-12 h-12 rounded-2xl bg-accent text-bg flex items-center justify-center hover:bg-[#d9bb84] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Отправить"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>

            <div className="mt-1.5 text-[11px] text-[#3a3836] text-right px-1">
              {input.length > 0 && `${input.length} / ${MAX_USER_MESSAGE_LENGTH}`}
            </div>
          </div>
        </div>
      </div>

      {/* ── FINISHED BANNER ────────────────────────────────── */}
      {finished && (
        <div className="flex-shrink-0 border-t border-border px-6 py-5 text-center">
          <p className="text-sm text-[#8e8b85] mb-3">
            Игра завершена. Спасибо, что прошли этот путь.
          </p>
          {feedbackUrl && (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 rounded-full border border-accent text-accent text-sm hover:bg-accent hover:text-bg transition-colors"
            >
              Оставить отзыв
            </a>
          )}
        </div>
      )}
    </div>
  );
}
