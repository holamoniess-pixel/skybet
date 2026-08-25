import { CircleDot, Dribbble, Radio, Trophy, Waves } from "lucide-react";

type MobileMatchRailProps = {
  onSelect: (item: "Live" | "Football" | "Basketball" | "Tennis" | "Virtuals") => void;
};

const discoveryItems = [
  { label: "Live", icon: Radio, action: "Live" as const },
  { label: "Premier", icon: Trophy, action: "Football" as const },
  { label: "Basketball", icon: Dribbble, action: "Basketball" as const },
  { label: "V-games", icon: Waves, action: "Virtuals" as const },
  { label: "Tennis", icon: CircleDot, action: "Tennis" as const },
];

export function MobileMatchRail({ onSelect }: MobileMatchRailProps) {
  return (
    <section className="border-b border-[var(--sky-blue-100)] bg-white px-3 py-2 dark:border-white/10 dark:bg-[var(--card)] md:hidden" aria-label="Sport discovery">
      <div className="mx-auto flex max-w-md gap-2 overflow-x-auto [scrollbar-width:none]">
        {discoveryItems.map(({ label, icon: Icon, action }) => <button key={label} type="button" onClick={() => onSelect(action)} className="flex min-h-12 min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-extrabold text-[var(--sky-navy-700)] transition hover:bg-[var(--sky-ice-50)] dark:text-slate-200 dark:hover:bg-white/5"><span className={`grid size-7 place-items-center rounded-lg ${label === "Live" ? "bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" : "bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"}`}><Icon className="size-4" /></span><span>{label}</span></button>)}
      </div>
    </section>
  );
}
