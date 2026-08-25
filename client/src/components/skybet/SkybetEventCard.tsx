import { ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";
import type { SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type SkybetEventCardProps = {
  event: SkybetEvent;
  selectedMarket?: string;
  onMarketSelect: (event: SkybetEvent, label: string, value: string) => void;
};

function StatusDot({ live }: { live: boolean }) {
  return <span className={live ? "sky-live-dot" : "sky-status-dot"} aria-hidden="true" />;
}

export function SkybetEventCard({ event, selectedMarket, onMarketSelect }: SkybetEventCardProps) {
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const displayedMarkets = showAllMarkets ? event.markets : event.markets.slice(0, 3);
  const hiddenMarketCount = Math.max(event.markets.length - 3, 0);

  return (
    <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_4px_12px_rgba(10,63,158,0.035)] dark:border-white/10 dark:bg-[var(--card)]">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-300">
            <StatusDot live={event.isLive} />
            <span className="truncate">{event.competition}</span>
          </div>
          <span className="shrink-0 text-xs font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span>
        </div>
        <div className="p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-[-0.03em] text-[var(--sky-navy-950)] dark:text-white">
                {event.teams[0]} <span className="font-medium text-[var(--sky-navy-400)]">vs</span> {event.teams[1]}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--sky-navy-600)] dark:text-slate-400">
                <Clock3 className="size-3.5" />
                {event.status}
              </p>
            </div>
            {event.score ? (
              <div className="rounded-lg bg-[var(--sky-navy-950)] px-2.5 py-1 text-sm font-extrabold tabular-nums text-white">{event.score}</div>
            ) : (
              <Badge variant="outline" className="rounded-lg border-[var(--sky-emerald-600)]/30 bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">
                Scheduled
              </Badge>
            )}
          </div>
          <div className={`mt-2 grid gap-1.5 ${displayedMarkets.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {displayedMarkets.map(market => {
              const selected = selectedMarket === market.label;
              return (
                <button
                  key={market.label}
                  type="button"
                  onClick={() => onMarketSelect(event, market.label, market.value)}
                  className={`min-h-11 rounded-lg border px-2 py-1 text-left transition ${
                    selected
                      ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white shadow-[0_8px_18px_rgba(15,87,199,0.18)]"
                      : "border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] text-[var(--sky-navy-950)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  }`}
                >
                  <span className={`block truncate text-[10px] font-bold ${selected ? "text-white/75" : "text-[var(--sky-navy-600)] dark:text-slate-400"}`}>{market.label}</span>
                  <span className="mt-0.5 block text-sm font-extrabold tabular-nums">{market.value}</span>
                </button>
              );
            })}
          </div>
          {hiddenMarketCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllMarkets(value => !value)}
              className="mt-2 flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--sky-blue-200)] px-3 text-xs font-extrabold text-[var(--sky-blue-700)] transition hover:bg-[var(--sky-ice-50)] dark:border-white/15 dark:text-[var(--sky-blue-300)] dark:hover:bg-white/5"
            >
              {showAllMarkets ? "Show fewer preview markets" : `Show ${hiddenMarketCount} more preview markets`}
              <ChevronDown className={`size-3.5 transition-transform ${showAllMarkets ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
