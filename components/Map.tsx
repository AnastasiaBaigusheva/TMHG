"use client";

export const ZONES = [
  { key: "запрос", label: "Запрос" },
  { key: "ценности", label: "Ценности" },
  { key: "страхи", label: "Страхи" },
  { key: "защиты", label: "Защиты" },
  { key: "отношения", label: "Отношения" },
  { key: "сценарии", label: "Сценарии" },
  { key: "ресурсы", label: "Ресурсы" },
  { key: "инсайты", label: "Инсайты" },
] as const;

export type ZoneKey = (typeof ZONES)[number]["key"];

export default function Map({
  visited,
  active,
}: {
  visited: Set<string>;
  active: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#7a7770] mb-3">
        Карта исследования
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">
        {ZONES.map((zone) => {
          const isActive = active === zone.key;
          const isVisited = visited.has(zone.key);
          return (
            <div
              key={zone.key}
              className={[
                "rounded-lg px-3 py-2 text-xs sm:text-sm border transition-colors",
                isActive
                  ? "border-accent text-accent bg-accent/10"
                  : isVisited
                  ? "border-border text-[#cfccc5] bg-white/[0.02]"
                  : "border-border/60 text-[#5a5853]",
              ].join(" ")}
            >
              {zone.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
