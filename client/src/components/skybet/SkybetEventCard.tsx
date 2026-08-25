import { Clock3 } from "lucide-react";
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
  return (
    <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-300">
            <StatusDot live={event.isLive} />
            <span className="truncate">{event.competition}</span>
          </div>
          <span className="shrink-0 text-xs font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-extrabold tracking-[-0.03em] text-[var(--sky-navy-950)] dark:text-white">
                {event.teams[0]} <span className="font-medium text-[var(--sky-navy-400)]">vs</span> {event.teams[1]}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--sky-navy-600)] dark:text-slate-400">
                <Clock3 className="size-3.5" />
                {event.status}
              </p>
            </div>
            {event.score ? (
              <div className="rounded-xl bg-[var(--sky-navy-950)] px-3 py-2 text-sm font-extrabold tabular-nums text-white">{event.score}</div>
            ) : (
              <Badge variant="outline" className="rounded-lg border-[var(--sky-emerald-600)]/30 bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">
                Scheduled
              </Badge>
            )}
          </div>
          <div className={`mt-4 grid gap-2 ${event.markets.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {event.markets.map(market => {
              const selected = selectedMarket === market.label;
              return (
                <button
                  key={market.label}
                  type="button"
                  onClick={() => onMarketSelect(event, market.label, market.value)}
                  className={`min-h-14 rounded-xl border p-2 text-left transition ${
                    selected
                      ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white shadow-[0_8px_18px_rgba(15,87,199,0.18)]"
                      : "border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] text-[var(--sky-navy-950)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  }`}
                >
                  <span className={`block truncate text-[11px] font-bold ${selected ? "text-white/75" : "text-[var(--sky-navy-600)] dark:text-slate-400"}`}>{market.label}</span>
                  <span className="mt-1 block text-sm font-extrabold tabular-nums">{market.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
