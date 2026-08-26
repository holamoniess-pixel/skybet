import { useMemo, useState } from "react";
import { Activity, CircleAlert, Gamepad2, RefreshCw } from "lucide-react";
import type { SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

type GamesFeedPreviewProps = {
  onMarketSelect: (event: SkybetEvent, label: string, value: string) => void;
};

export function GamesFeedPreview({ onMarketSelect }: GamesFeedPreviewProps) {
  const [category, setCategory] = useState("All");
  const feed = trpc.games.mockFeed.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const providerStatus = trpc.sportsData.status.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const categories = ["All", "Live now", "Football", "Court"];
  const visibleEvents = useMemo(() => {
    const events = feed.data?.events ?? [];
    if (category === "Live now") return events.filter(event => event.isLive);
    if (category === "Football") return events.filter(event => event.sport === "Football");
    if (category === "Court") return events.filter(event => event.sport === "Tennis");
    return events;
  }, [category, feed.data?.events]);

  return (
    <section className="mt-5" aria-labelledby="games-feed-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /></span><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Virtual games</p></div>
          <h2 id="games-feed-heading" className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">Featured virtual matches</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Refresh games feed" className="size-10 rounded-xl text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]" disabled={feed.isFetching} onClick={() => feed.refetch()}>
          <RefreshCw className={`size-4 ${feed.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Virtual game categories">
        {categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-extrabold transition ${category === item ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white" : "border-[var(--sky-blue-100)] bg-white text-[var(--sky-navy-700)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"}`}>{item}</button>)}
      </div>

      <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5">
            <span className="flex items-center gap-2 font-bold text-[var(--sky-navy-700)] dark:text-slate-300"><Gamepad2 className="size-3.5 text-[var(--sky-blue-600)]" /> Virtual games · preview catalogue</span>
            <span className="font-semibold text-[var(--sky-navy-500)] dark:text-slate-400">{feed.data ? `Refreshes every ${feed.data.refreshAfterSeconds}s` : "Loading feed"}</span>
          </div>
          {providerStatus.data?.state === "unconfigured" ? <div role="status" className="flex items-start gap-2 border-b border-[var(--sky-blue-100)] px-3 py-2 text-xs leading-5 text-[var(--sky-navy-600)] dark:border-white/10 dark:text-slate-400"><CircleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--sky-blue-600)]" />{providerStatus.data.message}</div> : null}
          {feed.isError ? <p className="p-3 text-sm text-destructive">The games feed is unavailable. Please refresh.</p> : null}
          <div className="flex gap-2 overflow-x-auto p-2.5 pb-3 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible">
            {feed.isLoading ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Loading virtual matches…</p> : null}
            {visibleEvents.map(event => (
              <button key={event.id} type="button" onClick={() => onMarketSelect(event, event.markets[0].label, event.markets[0].value)} className="min-w-[8.5rem] rounded-lg border border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-2 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-blue-500)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:min-w-0" aria-label={`Add ${event.teams[0]} preview selection`}>
                <div className="flex items-center justify-between gap-2"><Badge variant="outline" className={`rounded-md border-0 px-0 text-[10px] font-extrabold uppercase ${event.isLive ? "text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" : "text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"}`}>{event.isLive ? "Live now" : "Upcoming"}</Badge><span className="text-xs font-extrabold tabular-nums text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span></div>
                <p className="mt-1 truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}</p>
                <p className="mt-px truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}</p>
                <p className="mt-1 truncate text-[11px] text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition}</p>
                <span className="mt-1.5 block text-[11px] font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">Preview {event.markets[0].value}</span>
              </button>
            ))}
            {!feed.isLoading && !feed.isError && visibleEvents.length === 0 ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">No virtual matches in this category yet.</p> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
