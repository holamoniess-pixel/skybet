import { Activity, ChevronRight, Radio } from "lucide-react";
import type { SkybetEvent } from "@shared/skybet";

type MobileMatchRailProps = {
  liveEvents: SkybetEvent[];
  onOpenLive: () => void;
};

export function MobileMatchRail({ liveEvents, onOpenLive }: MobileMatchRailProps) {
  return (
    <section className="border-b border-[var(--sky-blue-100)] bg-white px-4 py-2.5 dark:border-white/10 dark:bg-[var(--card)] md:hidden" aria-label="Live match summary">
      <button type="button" onClick={onOpenLive} className="mx-auto flex min-h-11 w-full max-w-md items-center gap-3 rounded-xl bg-[var(--sky-navy-950)] px-3 text-left text-white">
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--sky-emerald-600)]/20 text-[var(--sky-emerald-500)]"><Radio className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold tracking-[0.12em] text-[var(--sky-blue-300)] uppercase">Live board</span><span className="block truncate text-sm font-bold">{liveEvents.length} live events · {liveEvents[0]?.teams.join(" vs ") ?? "Match centre"}</span></span>
        <ChevronRight className="size-4 text-[var(--sky-blue-300)]" />
      </button>
      <div className="mx-auto mt-2 flex max-w-md items-center gap-2 text-[11px] font-semibold text-[var(--sky-navy-600)] dark:text-slate-400"><Activity className="size-3.5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" /> Live score and event states are preview content.</div>
    </section>
  );
}
