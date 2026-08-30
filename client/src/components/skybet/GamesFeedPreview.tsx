import { useMemo, useState } from "react";
import { Activity, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import type { SkybetEvent } from "@shared/skybet";

type GamesFeedPreviewProps = {
  heading?: string;
  showPredictions?: boolean;
};

type AdminSelection = {
  eventId: string;
  label: string;
  odds: string;
  teams: string[];
};

function displayStartTime(value: string, isLive: boolean) {
  if (isLive) return value;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

export function GamesFeedPreview({ heading = "SKYBET match centre", showPredictions = false }: GamesFeedPreviewProps) {
  const [category, setCategory] = useState("All");
  const [adminSelections, setAdminSelections] = useState<AdminSelection[]>([]);
  const [generatedCode, setGeneratedCode] = useState("");
  const matchFeed = (trpc as unknown as { games?: { matchFeed?: { useQuery: (input?: undefined, options?: unknown) => any } } }).games?.matchFeed;
  const adminFeed = (trpc as unknown as { adminMatches?: { feed?: { useQuery: (input?: undefined, options?: unknown) => any } } }).adminMatches?.feed;
  const scoreboard: { data?: { events?: Array<SkybetEvent & { predictedOutcome?: string; predictionConfidence?: number }> }; isError: boolean; isLoading: boolean; isFetching: boolean; refetch: () => Promise<unknown> } = showPredictions && adminFeed?.useQuery
    ? adminFeed.useQuery(undefined, { refetchInterval: 30_000, refetchIntervalInBackground: false })
    : matchFeed?.useQuery
      ? matchFeed.useQuery(undefined, { refetchInterval: 30_000, refetchIntervalInBackground: false })
      : { data: undefined, isError: false, isLoading: false, isFetching: false, refetch: async () => undefined };
  const sharedBets = (trpc as unknown as { sharedBets?: { create?: { useMutation: (options: unknown) => any } } }).sharedBets;
  const createShareCode = sharedBets?.create ? sharedBets.create.useMutation({
    onSuccess: (result: { code: string } | undefined) => {
      if (result) {
        navigator.clipboard?.writeText(result.code).catch(() => undefined);
        toast.success(`Share code ${result.code} copied.`);
        setAdminSelections([]);
        setGeneratedCode(result.code);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  }) : { isPending: false, mutate: () => undefined };
  const categories = ["All", "Live now", "Upcoming"];
  const visibleEvents = useMemo(() => {
    const events = scoreboard.data?.events ?? [];
    if (category === "Live now") return events.filter(event => event.isLive);
    if (category === "Upcoming") return events.filter(event => !event.isLive);
    return events;
  }, [category, scoreboard.data?.events]);
  const combinedOdds = adminSelections.reduce((total, selection) => total * Number(selection.odds), 1);

  function selectAdminMarket(event: { id: string; teams: string[] }, market: { label: string; value: string }) {
    setAdminSelections(current => {
      const next = current.filter(selection => selection.eventId !== event.id);
      const existing = current.find(selection => selection.eventId === event.id);
      if (existing?.label === market.label) return next;
      return [...next, { eventId: event.id, label: market.label, odds: market.value, teams: event.teams }];
    });
  }

  return (
    <section className="mt-5" aria-labelledby="games-feed-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /></span><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Match updates</p></div>
          <h2 id="games-feed-heading" className="mt-1 text-xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">{heading}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Refresh match updates" className="size-10 rounded-xl text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]" disabled={scoreboard.isFetching} onClick={() => scoreboard.refetch()}>
          <RefreshCw className={`size-4 ${scoreboard.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Match categories">
        {categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-extrabold transition ${category === item ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white" : "border-[var(--sky-blue-100)] bg-white text-[var(--sky-navy-700)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"}`}>{item}</button>)}
      </div>

      {showPredictions && adminSelections.length ? <Card className="mb-3 border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/5 dark:border-[var(--sky-emerald-500)]/20 dark:bg-[var(--sky-emerald-500)]/5"><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold tracking-[0.1em] text-[var(--sky-emerald-700)] uppercase">Admin winner selections</p><p className="mt-1 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{adminSelections.length} selection{adminSelections.length === 1 ? "" : "s"} · Combined odds {combinedOdds.toFixed(2)}</p>{generatedCode ? <p className="mt-1 text-sm font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">Match code: {generatedCode}</p> : null}</div><Button type="button" disabled={createShareCode.isPending} onClick={() => createShareCode.mutate({ source: "admin", selections: adminSelections.map(({ eventId, label, odds }) => ({ eventId, label, odds })) })} className="h-10 rounded-xl bg-[var(--sky-emerald-600)] px-4 text-xs font-extrabold text-white hover:bg-[var(--sky-emerald-700)]"><Copy className="mr-1.5 size-3.5" />Generate Match Code</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{adminSelections.map(selection => <div key={selection.eventId} className="rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-white/5"><p className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">{selection.teams.join(" vs ")}</p><p className="mt-0.5 font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">{selection.label} · {selection.odds}</p></div>)}</div></CardContent></Card> : null}

      <Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
        <CardContent className="p-0">
          {scoreboard.isError ? <p className="p-3 text-sm text-destructive">The matches are unavailable. Please refresh.</p> : null}
          <div className={showPredictions ? "grid gap-3 p-3" : "flex gap-2 overflow-x-auto p-2.5 pb-3 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible"}>
            {scoreboard.isLoading ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Loading match updates…</p> : null}
            {visibleEvents.map(event => (
              <article key={event.id} className={showPredictions ? "rounded-2xl border border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-5 text-left shadow-[0_10px_24px_rgba(10,63,158,0.06)] dark:border-white/10 dark:bg-white/5" : "min-w-[8.5rem] rounded-lg border border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-2 text-left dark:border-white/10 dark:bg-white/5 sm:min-w-0"}>
                <div className="flex items-center justify-between gap-2"><Badge variant="outline" className={`rounded-md border-0 px-0 text-[10px] font-extrabold uppercase ${event.isLive ? "text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" : "text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"}`}>{event.isLive ? "Live now" : "Upcoming"}</Badge><span className="text-xs font-extrabold tabular-nums text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{displayStartTime(event.startsAt, event.isLive)}</span></div>
                <p className="mt-1 truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}{event.score ? `  ${event.score.split(" – ")[0]}` : ""}</p>
                <p className="mt-px truncate text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}{event.score ? `  ${event.score.split(" – ")[1] ?? ""}` : ""}</p>
                <p className="mt-1 truncate text-[11px] text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition} · {event.status}</p>
                <span className="mt-1.5 block text-[11px] font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">Available selections</span>
                {showPredictions ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{event.markets.slice(0, 3).map(market => { const selected = adminSelections.find(selection => selection.eventId === event.id)?.label === market.label; return <button key={market.label} type="button" aria-pressed={selected} onClick={() => selectAdminMarket(event, market)} className={`min-h-12 rounded-xl border px-2 py-2 text-left text-xs font-extrabold transition ${selected ? "border-[var(--sky-emerald-600)] bg-[var(--sky-emerald-600)]/15 text-[var(--sky-emerald-800)] ring-2 ring-[var(--sky-emerald-600)] ring-offset-1 dark:text-[var(--sky-emerald-300)]" : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"}`}><span className="block truncate">{market.label}</span><span className="mt-1 block text-sm">{market.value}</span><span className="mt-1 block text-[10px] uppercase">{selected ? "Selected winner" : "Not selected"}</span></button>; })}</div> : null}
              </article>
            ))}
            {!scoreboard.isLoading && !scoreboard.isError && visibleEvents.length === 0 ? <p className="p-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">No matches are available in this category yet.</p> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
