"use client";

import Link from "next/link";

const steps = [
  "Формулируете запрос",
  "Игра задаёт вопросы, от которых трудно спрятаться",
  "После каждого этапа открывается часть вашей внутренней карты",
  "В конце вы получаете краткое резюме инсайтов",
];

const important = [
  "Это не терапия",
  "Это не гадание",
  "Это не медицинская диагностика",
  "Вы можете остановиться в любой момент",
  "Если тема становится слишком тяжёлой, лучше сделать паузу или обсудить её с психологом",
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-bg">

      {/* ── HERO ── ровно один экран, border-b отбивает следующую секцию */}
      <section className="relative overflow-hidden flex flex-col items-center justify-center border-b border-border" style={{ minHeight: "100dvh" }}>

        <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-accent blur-[160px]" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent blur-[160px]" />
        </div>

        <div className="relative w-full max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent/80 mb-8">
            Игра-исследование
          </p>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight mb-8">
            Самая сложная игра в мире
          </h1>

          {/* Bug 1 fix: stronger hero text */}
          <p className="text-lg sm:text-xl text-[#bdbab2] max-w-xl mx-auto mb-12 leading-relaxed">
            Игра, в которой невозможно победить, соврав себе.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link
              href="/chat"
              className="px-8 py-4 rounded-full bg-accent text-bg font-medium text-sm tracking-wide hover:bg-[#d9bb84] transition-colors"
            >
              Начать игру
            </Link>
            <a
              href="#how-it-works"
              className="text-sm text-[#bdbab2] hover:text-white underline underline-offset-4 decoration-[#3a3a40] transition-colors"
            >
              Как это работает
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#3a3836] animate-bounce">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </section>

      {/* ── КАК ЭТО РАБОТАЕТ ── Bug 2 fix: заменили ol на div-карточки, цифры только наши */}
      <section id="how-it-works" className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-2xl font-medium mb-12 text-center">Как это работает</h2>
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-5 items-start">
              <span className="flex-shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-sm text-accent select-none">
                {i + 1}
              </span>
              <span className="text-[#cfccc5] leading-relaxed pt-1.5">{step}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── ВАЖНО ── Bug 3 fix: gap между тире и текстом */}
      <section className="max-w-3xl mx-auto px-6 py-24 border-t border-border">
        <h2 className="text-2xl font-medium mb-10 text-center">Важно</h2>
        <div className="rounded-2xl border border-border bg-panel p-8">
          <ul className="space-y-4">
            {important.map((line, i) => (
              <li key={i} className="flex gap-3 text-[#cfccc5] leading-relaxed">
                {/* Bug 3: gap-3 даёт пространство, тире не прилипает */}
                <span className="text-accent mt-1 flex-shrink-0">—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── BOTTOM CTA ── Bug 4+5 fix: гендерно-нейтральный текст, тихий дисклеймер */}
      <section className="max-w-3xl mx-auto px-6 pt-8 pb-32 text-center">
        <Link
          href="/chat"
          className="inline-block px-10 py-4 rounded-full bg-accent text-bg font-medium text-sm tracking-wide hover:bg-[#d9bb84] transition-colors"
        >
          Войти в игру
        </Link>
        {/* Bug 5: opacity-50 + text-[10px] — совсем тихий, не конкурирует с CTA */}
        <p className="mt-5 text-[10px] text-[#4a4844] opacity-70">
          Не терапия, не диагностика, не замена психолога.
        </p>
      </section>

    </main>
  );
}
