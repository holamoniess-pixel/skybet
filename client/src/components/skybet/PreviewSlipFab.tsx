import { Ticket } from "lucide-react";
import type { SkybetEvent } from "@shared/skybet";

type PreviewSelection = {
  event: SkybetEvent;
  label: string;
  value: string;
} | null;

type PreviewSlipFabProps = {
  selection: PreviewSelection;
  onOpen: () => void;
};

export function PreviewSlipFab({ selection, onOpen }: PreviewSlipFabProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={selection ? "Open preview slip with one selection" : "Open preview slip"}
      className="sky-preview-slip-fab"
    >
      <span className="grid size-10 place-items-center rounded-full bg-[var(--sky-blue-600)] text-white shadow-[0_8px_18px_rgba(15,87,199,0.26)]">
        <Ticket className="size-[18px]" />
      </span>
      <span className="hidden pr-3 text-left md:block">
        <span className="block text-[10px] font-extrabold tracking-[0.1em] text-[var(--sky-blue-200)] uppercase">Preview slip</span>
        <span className="block text-xs font-extrabold text-white">{selection ? "1 selection" : "No selections"}</span>
      </span>
      {selection ? <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[var(--sky-emerald-600)] text-[10px] font-extrabold text-white">1</span> : null}
    </button>
  );
}
