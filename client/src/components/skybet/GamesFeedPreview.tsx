import { useMemo, useState } from "react";
import { Activity, CircleAlert, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

type GamesFeedPreviewProps = {
  heading?: string;
  showPredictions?: boolean;
};

function displayStartTime(value: string, isLive: boolean) {
  if (isLive) return value;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

export function GamesFeedPreview({ heading = "SKYBET match engine", showPredictions = false }: GamesFeedPreviewProps) {
  const [category, setCategory] = useState("All");
  const scoreboard = trpc.games.simulatedFeed.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const categories = ["All", "Live now", "Upcoming"];
  const visibleEvents = useMemo(() => {
    const events = scoreboard.data?.events ?? [];
    if (category === "Live now") return events.filter(event => event.isLive);
    if (category === "Upcoming") return events.filter(event => !event.isLive);
    return events;
  }, [category, scoreboard.data?.events]);

  return (
    <section className="mt-5" aria-labelledby="games-feed-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /></span><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Match updates</p></div>
          <h2 id="games-feed-heading" className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">{heading}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Refresh simulated match feed" className="size-10 rounded-xl text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]" disabled={scoreboard.isFetching} onClick={() => scoreboard.refetch()}>
          <RefreshCw className={`size-4 ${scoreboard.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Match categories">
        {categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-extrabold transition ${category === item ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white" : "border-[var(--sky-blue-100)] bg-white text-[var(--sky-navy-700)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"}`}>{item}</button>)}
      </div>

      <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5">
            <span className="font-bold text-[var(--sky-navy-700)] dark:text-slate-300">SKYBET-generated market data · internally managed fixtures and odds</span>
            <span className="font-semibold text-[var(--sky-navy-500)] dark:text-slate-400">{scoreboard.data ? `Refreshes every ${scoreboard.data.refreshAfterSeconds}s` : "Loading market updates"}</span>
          </div>
          <div role="status" className="flex items-start gap-2 border-b border-[var(--sky-blue-100)] px-3 py-2 text-xs leading-5 text-[var(--sky-navy-600)] dark:border-white/10 dark:text-slate-400"><CircleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--sky-blue-600)]" />{scoreboard.data?.message}</div>
          {scoreboard.isError ? <p className="p-3 text-sm text-destructive">The match feed is unavailable. Please refresh.</p> : null}
          <div className="flex gap-2 overflow-x-auto p-2.5 pb-3 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible">
            {scoreboard.isLoading ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Loading match updates…</p> : null}
            {visibleEvents.map(event => (
              <article key={event.id} className="min-w-[8.5rem] rounded-lg border border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-2 text-left dark:border-white/10 dark:bg-white/5 sm:min-w-0">
                <div className="flex items-center justify-between gap-2"><Badge variant="outline" className={`rounded-md border-0 px-0 text-[10px] font-extrabold uppercase ${event.isLive ? "text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" : "text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"}`}>{event.isLive ? "Live now" : "Upcoming"}</Badge><span className="text-xs font-extrabold tabular-nums text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{displayStartTime(event.startsAt, event.isLive)}</span></div>
                <p className="mt-1 truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}{event.score ? `  ${event.score.split(" – ")[0]}` : ""}</p>
                <p className="mt-px truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}{event.score ? `  ${event.score.split(" – ")[1] ?? ""}` : ""}</p>
                <p className="mt-1 truncate text-[11px] text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition} · {event.status}</p>
                <span className="mt-1.5 block text-[11px] font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">SKYBET-generated market odds</span>
                {showPredictions && "predictedOutcome" in event ? <p className="mt-1 text-[11px] font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Forecast: {event.predictedOutcome} · {event.predictionConfidence}% confidence</p> : null}
              </article>
            ))}
            {!scoreboard.isLoading && !scoreboard.isError && visibleEvents.length === 0 ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">No match updates are available in this category yet.</p> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
