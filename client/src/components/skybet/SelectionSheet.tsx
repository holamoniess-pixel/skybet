import { Check, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatSelection, type SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Selection = {
  event: SkybetEvent;
  label: string;
  value: string;
};

type SelectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: Selection | null;
  selections?: Selection[];
  onRemoveSelection?: (eventId: string, label: string) => void;
  onClearSelections?: () => void;
  onLoadCode?: (code: string) => void;
  codeMessage?: string;
};

export function SelectionSheet({ open, onOpenChange, selection, selections, onRemoveSelection, onClearSelections, onLoadCode, codeMessage }: SelectionSheetProps) {
  const [code, setCode] = useState("");
  const [stake, setStake] = useState("10");
  const selectedItems = selections ?? (selection ? [selection] : []);
  const combinedOdds = selectedItems.reduce((total: number, item: Selection) => total * Number(item.value), 1);
  const numericStake = Number(stake);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-[2rem] border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-0 dark:border-white/10 dark:bg-[var(--card)] sm:mx-auto sm:max-w-lg">
        <SheetHeader className="border-b border-[var(--sky-blue-100)] p-5 text-left dark:border-white/10">
          <SheetTitle className="text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Review your selection</SheetTitle>
          <SheetDescription>This preview does not accept real-money actions.</SheetDescription>
        </SheetHeader>
        <div className="p-5">
          {onLoadCode ? <form className="sky-preview-code-panel" onSubmit={event => { event.preventDefault(); onLoadCode(code); }}>
            <div className="relative min-w-0 flex-1"><KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--sky-blue-600)]" /><Input aria-label="Enter an authored preview code" placeholder="e.g. SKY-LIVE-01" value={code} onChange={event => setCode(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] bg-white pl-10 text-sm dark:border-white/15 dark:bg-white/5" /></div>
            <Button type="submit" className="h-11 shrink-0 rounded-xl bg-[var(--sky-blue-600)] px-4 font-extrabold hover:bg-[var(--sky-blue-700)]">Load code</Button>
          </form> : null}
          {onLoadCode ? <p aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{codeMessage || "Enter an authored code to restore a local preview selection."}</p> : null}
          {selectedItems.length ? (
            <>
              <div className="mt-4 space-y-2">
                {selectedItems.map(item => <div key={`${item.event.id}:${item.label}`} className="rounded-2xl border border-[var(--sky-blue-100)] bg-white p-4 dark:border-white/10 dark:bg-white/5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge className="rounded-full bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]">{item.event.competition}</Badge><p className="mt-2 text-sm font-extrabold leading-5 text-[var(--sky-navy-950)] dark:text-white">{formatSelection(item.event, item.label)}</p></div>{onRemoveSelection ? <button type="button" aria-label={`Remove ${item.label}`} onClick={() => onRemoveSelection(item.event.id, item.label)} className="rounded-lg p-2 text-[var(--sky-navy-500)] hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button> : null}</div><div className="mt-3 flex items-center justify-between border-t border-[var(--sky-blue-100)] pt-3 text-sm dark:border-white/10"><span className="font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Odds</span><span className="font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{item.value}</span></div></div>)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--sky-ice-50)] p-3 dark:bg-white/5"><div><p className="text-xs font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Accumulator odds</p><p className="mt-1 text-lg font-black text-[var(--sky-navy-950)] dark:text-white">{combinedOdds.toFixed(2)}</p></div><div><label htmlFor="preview-stake" className="text-xs font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Stake (GHS)</label><Input id="preview-stake" inputMode="decimal" value={stake} onChange={event => setStake(event.target.value)} className="mt-1 h-9 bg-white dark:bg-white/10" /></div><p className="col-span-2 border-t border-[var(--sky-blue-100)] pt-2 text-sm font-extrabold text-[var(--sky-blue-700)] dark:border-white/10 dark:text-[var(--sky-blue-300)]">Potential return: GH₵ {Number.isFinite(numericStake) ? (numericStake * combinedOdds).toFixed(2) : "0.00"}</p></div>
              <div className="mt-4 flex gap-2"><Button variant="outline" className="h-11 flex-1 font-extrabold" onClick={onClearSelections}>Clear slip</Button><Button className="h-11 flex-[2] rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]" onClick={() => toast.success("Preview slip saved locally. No wager was submitted.")}>Save preview slip <Check className="size-4" /></Button></div>
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Choose an event option or restore an authored code to continue.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
