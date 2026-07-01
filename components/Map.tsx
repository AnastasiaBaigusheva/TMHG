"use client";

import { GameZone, ZONE_ORDER, ZONE_LABELS } from "@/lib/anthropic";

export default function Map({
  openedZones,
  currentZone,
}: {
  openedZones: GameZone[];
  currentZone: GameZone | null;
}) {
  return (
    <div className="space-y-1">
      {ZONE_ORDER.map((zone) => {
        const isCurrent   = currentZone === zone;
        const isCompleted = openedZones.includes(zone) && !isCurrent;
        const isUpcoming  = !openedZones.includes(zone) && !isCurrent;

        return (
          <div
            key={zone}
            className={[
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isCurrent   ? "text-accent"      : "",
              isCompleted ? "text-[#5a5853]"   : "",
              isUpcoming  ? "text-[#2e2d2b]"   : "",
            ].join(" ")}
          >
            <span className={[
              "font-mono text-xs w-4 text-center flex-shrink-0",
              isCurrent   ? "text-accent"    : "",
              isCompleted ? "text-[#4a4844]" : "",
              isUpcoming  ? "text-[#2e2d2b]" : "",
            ].join(" ")}>
              {isCompleted ? "✓" : isCurrent ? "●" : "○"}
            </span>
            <span>{ZONE_LABELS[zone]}</span>
          </div>
        );
      })}
    </div>
  );
}
