import { Check } from "lucide-react";
import { toast } from "sonner";
import { formatSelection, type SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
};

export function SelectionSheet({ open, onOpenChange, selection }: SelectionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-[2rem] border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-0 dark:border-white/10 dark:bg-[var(--card)] sm:mx-auto sm:max-w-lg">
        <SheetHeader className="border-b border-[var(--sky-blue-100)] p-5 text-left dark:border-white/10">
          <SheetTitle className="text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Review your selection</SheetTitle>
          <SheetDescription>This preview does not accept real-money actions.</SheetDescription>
        </SheetHeader>
        <div className="p-5">
          {selection ? (
            <>
              <div className="rounded-2xl border border-[var(--sky-blue-100)] bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Badge className="rounded-full bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]">{selection.event.competition}</Badge>
                <p className="mt-3 text-base font-extrabold leading-6 text-[var(--sky-navy-950)] dark:text-white">{formatSelection(selection.event, selection.label)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--sky-blue-100)] pt-4 dark:border-white/10">
                  <span className="text-sm font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Market value</span>
                  <span className="text-lg font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{selection.value}</span>
                </div>
              </div>
              <Button className="mt-4 h-12 w-full rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]" onClick={() => toast.success("Selection saved in this preview session.")}>Confirm preview selection <Check className="size-4" /></Button>
            </>
          ) : (
            <p className="text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Choose an event option to continue.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
