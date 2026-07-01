"use client";

import { GameZone } from "@/lib/anthropic";

export const ZONE_META: { key: GameZone; label: string }[] = [
  { key: "request",       label: "Запрос"     },
  { key: "values",        label: "Ценности"   },
  { key: "fears",         label: "Страхи"     },
  { key: "defenses",      label: "Защиты"     },
  { key: "relationships", label: "Отношения"  },
  { key: "patterns",      label: "Сценарии"   },
  { key: "resources",     label: "Ресурсы"    },
  { key: "insights",      label: "Инсайты"    },
];

// Legacy export so old imports don't break
export const ZONES = ZONE_META;

export default function Map({
  openedZones,
  currentZone,
}: {
  openedZones: GameZone[];
  currentZone: GameZone | null;
  // legacy props accepted but ignored
  visited?: Set<string>;
  active?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#7a7770] mb-3">
        Карта исследования
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">
        {ZONE_META.map((zone) => {
          const isActive  = currentZone === zone.key;
          const isOpened  = openedZones.includes(zone.key);
          return (
            <div
              key={zone.key}
              className={[
                "rounded-lg px-3 py-2 text-xs sm:text-sm border transition-colors",
                isActive
                  ? "border-accent text-accent bg-accent/10 font-medium"
                  : isOpened
                  ? "border-border text-[#cfccc5] bg-white/[0.02]"
                  : "border-border/40 text-[#4a4844]",
              ].join(" ")}
            >
              {isOpened && !isActive && (
                <span className="mr-1.5 text-[#5a5853]">✓</span>
              )}
              {zone.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
