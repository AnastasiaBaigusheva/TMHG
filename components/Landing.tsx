"use client";

import Link from "next/link";

const steps = [
  "Вы формулируете личный запрос",
  "ИИ помогает уточнить настоящую тему",
  "Игра задает вопросы, от которых трудно спрятаться",
  "После каждого этапа открывается часть вашей внутренней карты",
  "В конце вы получаете краткое резюме инсайтов",
];

const important = [
  "Это не терапия",
  "Это не гадание",
  "Это не медицинская диагностика",
  "Вы можете остановиться в любой момент",
  "Если тема становится слишком тяжелой, лучше сделать паузу или обсудить ее с психологом",
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-accent blur-[160px]" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent blur-[160px]" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-32 pb-28 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent/80 mb-8">
            Игра-исследование
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight mb-8">
            Самая сложная игра в мире
          </h1>
          <p className="text-lg sm:text-xl text-[#bdbab2] mb-6 leading-relaxed">
            Не потому что в ней сложные правила.
            <br />А потому что играть придется против самого себя.
          </p>
          <p className="text-base text-[#8e8b85] max-w-xl mx-auto mb-12 leading-relaxed">
            Это интерактивная игра-исследование. Она помогает увидеть свои
            внутренние конфликты, повторяющиеся сценарии, страхи, ценности и
            точки роста через честный разговор с ИИ.
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
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="max-w-3xl mx-auto px-6 py-24 border-t border-border"
      >
        <h2 className="text-2xl font-medium mb-12 text-center">
          Как это работает
        </h2>
        <ol className="space-y-6">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-5 items-start">
              <span className="flex-shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-sm text-accent">
                {i + 1}
              </span>
              <span className="text-[#cfccc5] leading-relaxed pt-1.5">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Important */}
      <section className="max-w-3xl mx-auto px-6 py-24 border-t border-border">
        <h2 className="text-2xl font-medium mb-10 text-center">Важно</h2>
        <div className="rounded-2xl border border-border bg-panel p-8">
          <ul className="space-y-4">
            {important.map((line, i) => (
              <li key={i} className="flex gap-3 text-[#cfccc5] leading-relaxed">
                <span className="text-accent mt-1">—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-6 pt-8 pb-32 text-center">
        <Link
          href="/chat"
          className="inline-block px-10 py-4 rounded-full bg-accent text-bg font-medium text-sm tracking-wide hover:bg-[#d9bb84] transition-colors"
        >
          Я готова начать
        </Link>
        <p className="mt-6 text-xs text-[#6f6c66]">
          Не терапия, не диагностика, не замена психолога.
        </p>
      </section>
    </main>
  );
}
