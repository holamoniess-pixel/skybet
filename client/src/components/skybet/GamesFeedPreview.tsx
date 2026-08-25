import { Activity, Gamepad2, RefreshCw } from "lucide-react";
import type { SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

type GamesFeedPreviewProps = {
  onOpenEvent: (event: SkybetEvent) => void;
};

export function GamesFeedPreview({ onOpenEvent }: GamesFeedPreviewProps) {
  const feed = trpc.games.mockFeed.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return (
    <section className="mt-5" aria-labelledby="games-feed-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /></span><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Provider preview</p></div>
          <h2 id="games-feed-heading" className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">Simulated games feed</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Refresh simulated games feed" className="size-10 rounded-xl text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]" disabled={feed.isFetching} onClick={() => feed.refetch()}>
          <RefreshCw className={`size-4 ${feed.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] px-4 py-2.5 text-xs dark:border-white/10 dark:bg-white/5">
            <span className="flex items-center gap-2 font-bold text-[var(--sky-navy-700)] dark:text-slate-300"><Gamepad2 className="size-3.5 text-[var(--sky-blue-600)]" /> Mock API · not provider data</span>
            <span className="font-semibold text-[var(--sky-navy-500)] dark:text-slate-400">{feed.data ? `Refreshes every ${feed.data.refreshAfterSeconds}s` : "Loading feed"}</span>
          </div>
          {feed.isError ? <p className="p-4 text-sm text-destructive">The simulated feed is unavailable. Please refresh the preview.</p> : null}
          <div className="flex gap-3 overflow-x-auto p-3 pb-4 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible">
            {feed.isLoading ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Loading simulated match cards…</p> : null}
            {feed.data?.events.map(event => (
              <button key={event.id} type="button" onClick={() => onOpenEvent(event)} className="min-w-[13.25rem] rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-3 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky-blue-500)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:min-w-0">
                <div className="flex items-center justify-between gap-2"><Badge variant="outline" className={`rounded-md border-0 px-0 text-[10px] font-extrabold uppercase ${event.isLive ? "text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" : "text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"}`}>{event.isLive ? "Live now" : "Upcoming"}</Badge><span className="text-xs font-extrabold tabular-nums text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span></div>
                <p className="mt-3 truncate text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}</p>
                <p className="mt-2 truncate text-xs text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
