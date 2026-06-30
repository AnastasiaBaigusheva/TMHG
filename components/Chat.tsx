"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Map, { ZONES } from "@/components/Map";
import { MAX_USER_MESSAGE_LENGTH, containsCrisisLanguage } from "@/lib/anthropic";

type Role = "user" | "assistant";

interface ChatMsg {
  role: Role;
  content: string;
}

const FIRST_MESSAGE_TRIGGER = "__INIT__";
const CRISIS_NOTICE =
  "Похоже, вы пишете о чем-то очень тяжелом. Это важнее игры. Пожалуйста, обратитесь к близкому человеку, специалисту или в экстренную службу вашей страны прямо сейчас. Игра поставлена на паузу.";

function detectActiveZone(text: string): string | null {
  const lower = text.toLowerCase();
  for (const zone of ZONES) {
    if (lower.includes(zone.key)) return zone.key;
  }
  return null;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [visitedZones, setVisitedZones] = useState<Set<string>>(new Set());
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initiated = useRef(false);

  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;
    sendToAssistant([]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function sendToAssistant(history: ChatMsg[]) {
    setLoading(true);
    setError(null);

    const isInit = history.length === 0;
    const payloadMessages = isInit
      ? [{ role: "user" as Role, content: FIRST_MESSAGE_TRIGGER }]
      : history;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка при обращении к ИИ.");
      }

      if (!res.body) throw new Error("Пустой ответ от сервера.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      // Добавляем пустое сообщение ассистента, которое будем дополнять по мере стрима
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return updated;
        });
      }

      const zone = detectActiveZone(assistantText);
      if (zone) {
        setActiveZone(zone);
        setVisitedZones((prev) => new Set(prev).add(zone));
      }
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading || finished) return;

    if (trimmed.length > MAX_USER_MESSAGE_LENGTH) {
      setError(`Сообщение слишком длинное. Максимум ${MAX_USER_MESSAGE_LENGTH} символов.`);
      return;
    }

    if (containsCrisisLanguage(trimmed)) {
      setCrisis(true);
      setPaused(true);
    }

    const newHistory: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newHistory);
    setInput("");
    sendToAssistant(newHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePause() {
    setPaused((p) => !p);
  }

  function handleFinish() {
    if (finished || loading) return;
    const newHistory: ChatMsg[] = [
      ...messages,
      { role: "user", content: "Я хочу завершить игру. Пожалуйста, подведи итог." },
    ];
    setMessages(newHistory);
    setFinished(true);
    sendToAssistant(newHistory);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-[#8e8b85] hover:text-white transition-colors">
            ← Выход
          </Link>
          <h1 className="text-sm sm:text-base font-medium tracking-wide">
            Самая сложная игра в мире
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePause}
            className="text-xs sm:text-sm px-3 py-2 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors"
          >
            {paused ? "Продолжить" : "Сделать паузу"}
          </button>
          <button
            onClick={handleFinish}
            disabled={finished}
            className="text-xs sm:text-sm px-3 py-2 rounded-full border border-border text-[#cfccc5] hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            Завершить игру
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 gap-6">
        {/* Map sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <Map visited={visitedZones} active={activeZone} />
          <p className="mt-4 text-[11px] leading-relaxed text-[#5a5853] px-1">
            Это не терапия, не диагностика и не замена психолога. Если тема
            становится слишком тяжелой — сделайте паузу.
          </p>
        </aside>

        {/* Chat column */}
        <div className="flex-1 flex flex-col rounded-2xl border border-border bg-panel overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={[
                    "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-accent text-bg"
                      : "bg-white/[0.04] text-[#e3e0d9] border border-border",
                  ].join(" ")}
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-white/[0.04] border border-border text-[#8e8b85]">
                  Думаю…
                </div>
              </div>
            )}

            {crisis && (
              <div className="rounded-2xl px-4 py-3 text-sm bg-red-950/40 border border-red-800/60 text-red-200">
                {CRISIS_NOTICE}
              </div>
            )}

            {error && (
              <div className="rounded-2xl px-4 py-3 text-sm bg-red-950/30 border border-red-900/50 text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            {paused && !crisis && (
              <div className="mb-3 text-xs text-[#8e8b85] bg-white/[0.03] border border-border rounded-lg px-3 py-2">
                Игра на паузе. Нажмите «Продолжить», когда будете готовы.
              </div>
            )}
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_USER_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                disabled={loading || paused || finished}
                placeholder={
                  finished
                    ? "Игра завершена."
                    : paused
                    ? "Игра на паузе…"
                    : "Напишите ваш ответ…"
                }
                rows={2}
                className="flex-1 resize-none bg-transparent border border-border rounded-xl px-4 py-3 text-sm text-[#e9e7e2] placeholder:text-[#5a5853] focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || paused || finished || !input.trim()}
                className="px-5 py-3 rounded-xl bg-accent text-bg text-sm font-medium hover:bg-[#d9bb84] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Отправить
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#5a5853]">
              <span>{input.length} / {MAX_USER_MESSAGE_LENGTH}</span>
            </div>
          </div>
        </div>
      </div>

      {finished && (
        <div className="border-t border-border px-6 py-6 text-center">
          <p className="text-sm text-[#8e8b85] mb-4">
            Игра завершена. Спасибо, что прошли этот путь.
          </p>
          {feedbackUrl ? (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 rounded-full border border-accent text-accent text-sm hover:bg-accent hover:text-bg transition-colors"
            >
              Оставить отзыв
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
