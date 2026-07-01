"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Map from "@/components/Map";
import {
  MAX_USER_MESSAGE_LENGTH,
  containsCrisisLanguage,
  GameState,
  INITIAL_GAME_STATE,
  GameZone,
  ZONE_ORDER,
  ZONE_LABELS,
} from "@/lib/anthropic";

// ─── Message types ────────────────────────────────────────────
type Role = "user" | "assistant";

interface ChatMsg {
  type: "chat";
  role: Role;
  content: string;
}

interface TransitionMsg {
  type: "transition";
  completedZone: GameZone;
  newZone: GameZone;
}

type Message = ChatMsg | TransitionMsg;

// ─── Constants ────────────────────────────────────────────────
const CRISIS_NOTICE =
  "Похоже, вы пишете о чём-то очень тяжёлом. Это важнее игры. Пожалуйста, обратитесь к близкому человеку, специалисту или в экстренную службу вашей страны прямо сейчас.";

const TOTAL_ZONES = ZONE_ORDER.length;
const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_GAME_STATE === "true";

// ─── Helpers ──────────────────────────────────────────────────
function zoneIndex(zone: GameZone | null): number {
  if (!zone) return 0;
  return ZONE_ORDER.indexOf(zone); // 0-based
}

function progressPercent(zone: GameZone | null): number {
  if (!zone) return 0;
  return Math.round(((zoneIndex(zone) + 1) / TOTAL_ZONES) * 100);
}

// ─── Sub-components ───────────────────────────────────────────

function ProgressHeader({ gameState }: { gameState: GameState }) {
  const idx = zoneIndex(gameState.currentZone) + 1; // 1-based
  const pct = progressPercent(gameState.currentZone);
  const label = gameState.currentZone ? ZONE_LABELS[gameState.currentZone] : "—";

  return (
    <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-bg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#5a5853] tracking-wide">
          Клетка {idx} из {TOTAL_ZONES}
        </span>
        <span className="text-xs font-medium text-accent tracking-[0.15em] uppercase">
          {label}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CellTransitionCard({ msg }: { msg: TransitionMsg }) {
  return (
    <div className="flex justify-center my-2">
      <div className="rounded-2xl border border-border bg-white/[0.03] px-6 py-4 text-center max-w-xs w-full">
        <p className="text-xs text-[#5a5853] mb-2 tracking-wide">✓ Клетка завершена</p>
        <p className="text-[11px] text-[#5a5853] mb-3">Открыта новая клетка</p>
        <p className="text-base font-medium text-accent tracking-[0.2em] uppercase">
          {ZONE_LABELS[msg.newZone]}
        </p>
      </div>
    </div>
  );
}

function FinishScreen({
  gameState,
  feedbackUrl,
}: {
  gameState: GameState;
  feedbackUrl: string;
}) {
  const completed = gameState.openedZones.length;
  const insights  = gameState.keyInsights.length;

  return (
    <div className="absolute inset-0 bg-bg flex flex-col items-center justify-center px-6 z-10">
      <div className="w-full max-w-sm text-center space-y-8">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase text-accent/70 mb-4">
            Исследование завершено
          </p>
          <h2 className="text-2xl font-medium text-[#e9e7e2] mb-6">
            Самая сложная игра в мире
          </h2>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-6 space-y-4 text-left">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#8e8b85]">Пройдено клеток</span>
            <span className="text-sm font-medium text-[#e9e7e2]">{completed} / {TOTAL_ZONES}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#8e8b85]">Получено инсайтов</span>
            <span className="text-sm font-medium text-accent">{insights}</span>
          </div>

          {gameState.keyInsights.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                {gameState.keyInsights.map((insight, i) => (
                  <p key={i} className="text-xs text-[#8e8b85] leading-relaxed">
                    · {insight}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          {feedbackUrl && (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-8 py-3 rounded-full bg-accent text-bg text-sm font-medium hover:bg-[#d9bb84] transition-colors"
            >
              Оставить отзыв
            </a>
          )}
          <Link
            href="/"
            className="block px-8 py-3 rounded-full border border-border text-[#8e8b85] text-sm hover:border-accent hover:text-accent transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat component ───────────────────────────────────────
export default function Chat() {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [paused,    setPaused]    = useState(false);
  const [crisis,    setCrisis]    = useState(false);
  const [mapOpen,   setMapOpen]   = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const initiated    = useRef(false);
  const prevZoneRef  = useRef<GameZone | null>(INITIAL_GAME_STATE.currentZone);

  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";
  const finished    = gameState.stage === "finished";

  // Auto-scroll
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
    callApi([{ type: "chat", role: "user", content: "__INIT__" }], INITIAL_GAME_STATE);
  }, []);

  async function callApi(history: Message[], state: GameState) {
    setLoading(true);
    setError(null);

    // Only send chat messages to the API
    const apiMessages = history
      .filter((m): m is ChatMsg => m.type === "chat")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, gameState: state }),
      });

      const data = await res.json().catch(() => ({})) as {
        content?: string;
        gameState?: GameState;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error || "Ошибка при обращении к ИИ.");

      const assistantText = data.content ?? "";
      const newState: GameState = data.gameState ?? { ...state, turnCount: state.turnCount + 1 };

      const isInit = apiMessages.length === 1 && apiMessages[0].content === "__INIT__";

      // Detect zone transition
      const prevZone = prevZoneRef.current;
      const newZone  = newState.currentZone;
      const zoneChanged = prevZone && newZone && prevZone !== newZone;
      prevZoneRef.current = newZone;

      setMessages((prev) => {
        const base = isInit ? [] : prev;
        const next: Message[] = [
          ...base,
          { type: "chat", role: "assistant", content: assistantText },
        ];
        // Insert transition card before the new message if zone changed
        if (zoneChanged && prevZone && newZone) {
          next.splice(next.length - 1, 0, {
            type: "transition",
            completedZone: prevZone,
            newZone: newZone,
          });
        }
        return next;
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

    const userMsg: ChatMsg = { type: "chat", role: "user", content: trimmed };
    const newHistory: Message[] = [...messages, userMsg];
    setMessages(newHistory);
    if (!overrideText) setInput("");
    callApi(newHistory, gameState);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
    <div className="flex flex-col bg-bg relative" style={{ height: "100dvh" }}>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center justify-between gap-2 bg-bg">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex-shrink-0 text-[#8e8b85] hover:text-white transition-colors p-1 -ml-1"
            aria-label="Выход"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <span className="text-sm font-medium truncate text-[#e9e7e2]">
            Самая сложная игра в мире
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Map toggle — mobile only */}
          <button
            onClick={() => setMapOpen((v) => !v)}
            className={[
              "lg:hidden p-2 rounded-full border transition-colors",
              mapOpen
                ? "border-accent text-accent"
                : "border-border text-[#8e8b85] hover:border-accent hover:text-accent",
            ].join(" ")}
            aria-label="Карта"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </button>
          <button
            onClick={handlePause}
            disabled={loading || crisis}
            className="text-xs px-2.5 py-1.5 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            {paused && !crisis ? "Продолжить" : "Пауза"}
          </button>
          <button
            onClick={handleFinish}
            disabled={finished || loading}
            className="text-xs px-2.5 py-1.5 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            Завершить
          </button>
        </div>
      </header>

      {/* ── PROGRESS BAR ─────────────────────────────────────── */}
      <ProgressHeader gameState={gameState} />

      {/* ── MOBILE MAP DRAWER ─────────────────────────────────── */}
      {mapOpen && (
        <div className="lg:hidden flex-shrink-0 border-b border-border bg-panel px-4 py-4 space-y-4">
          <Map openedZones={gameState.openedZones} currentZone={gameState.currentZone} />
          {gameState.keyInsights.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#5a5853] mb-2">Открытия</p>
              <ul className="space-y-1.5">
                {gameState.keyInsights.map((ins, i) => (
                  <li key={i} className="text-xs text-[#8e8b85] leading-relaxed">· {ins}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN LAYOUT ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col gap-6 w-52 flex-shrink-0 border-r border-border px-4 py-5 overflow-y-auto">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#5a5853] mb-3 px-3">Маршрут</p>
            <Map openedZones={gameState.openedZones} currentZone={gameState.currentZone} />
          </div>

          {gameState.keyInsights.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#5a5853] mb-2 px-3">Открытия</p>
              <ul className="space-y-2 px-3">
                {gameState.keyInsights.map((ins, i) => (
                  <li key={i} className="text-xs text-[#8e8b85] leading-relaxed">· {ins}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto">
            <p className="text-[10px] leading-relaxed text-[#3a3836] px-3">
              Не терапия, не диагностика, не замена психолога.
            </p>
          </div>

          {DEBUG_MODE && (
            <div className="rounded-xl border border-border bg-bg p-3 text-[10px] font-mono text-[#5a5853] overflow-auto max-h-80 break-all">
              <p className="text-accent mb-1">DEBUG</p>
              <pre>{JSON.stringify(gameState, null, 2)}</pre>
            </div>
          )}
        </aside>

        {/* Chat column */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {messages.map((m, i) => {
              if (m.type === "transition") {
                return <CellTransitionCard key={i} msg={m} />;
              }
              return (
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
              );
            })}

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

          {/* Input area */}
          <div
            className="flex-shrink-0 border-t border-border bg-bg px-3 pt-3"
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
                  paused   ? "Пауза…"          :
                             "Напишите ответ…"
                }
                rows={1}
                className="flex-1 resize-none bg-white/[0.04] border border-border rounded-2xl px-4 py-3 text-[15px] text-[#e9e7e2] placeholder:text-[#3a3836] focus:outline-none focus:border-accent disabled:opacity-50 leading-relaxed"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || paused || finished || !input.trim()}
                className="flex-shrink-0 w-12 h-12 rounded-2xl bg-accent text-bg flex items-center justify-center hover:bg-[#d9bb84] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Отправить"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div className="h-5 mt-1 text-right pr-1">
              {input.length > 0 && (
                <span className="text-[11px] text-[#3a3836]">
                  {input.length} / {MAX_USER_MESSAGE_LENGTH}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FINISH OVERLAY ───────────────────────────────────── */}
      {finished && (
        <FinishScreen gameState={gameState} feedbackUrl={feedbackUrl} />
      )}
    </div>
  );
}
