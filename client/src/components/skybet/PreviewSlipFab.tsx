import { Ticket } from "lucide-react";
import type { SkybetEvent } from "@shared/skybet";

type PreviewSelection = {
  event: SkybetEvent;
  label: string;
  value: string;
} | null;

type PreviewSlipFabProps = {
  selection: PreviewSelection;
  selectionCount?: number;
  onOpen: () => void;
};

export function PreviewSlipFab({ selection, selectionCount = selection ? 1 : 0, onOpen }: PreviewSlipFabProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={selection ? "Open preview slip with one selection" : "Open preview slip"}
      className="sky-preview-slip-fab"
    >
      <Ticket className="size-6" />
      <span className="sr-only">{selection ? "One selection in Preview slip" : "No selections in Preview slip"}</span>
      {selectionCount > 0 ? <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[var(--sky-emerald-600)] text-[10px] font-extrabold text-white">{selectionCount}</span> : null}
    </button>
  );
}
