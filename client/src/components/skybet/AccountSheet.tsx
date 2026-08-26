import { Bell, ChevronRight, Copy, Heart, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useState } from "react";
import { CustomerAuthDialog } from "@/components/CustomerAuthDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const accountItems = [
  [ShieldCheck, "Safer play", "Limits, time-outs, and account protection", "/account#safer-play"],
  [Heart, "Referral rewards", "View eligible referral progress", "/activity#rewards"],
  [Copy, "Activity", "Review account and selection history", "/activity"],
  [Sparkles, "Preferences", "Personalise the SKYBET experience", "/account#preferences"],
] as const;

export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const [, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  const navigateTo = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[92%] border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-0 dark:border-white/10 dark:bg-[var(--card)] sm:max-w-md">
        <SheetHeader className="border-b border-[var(--sky-blue-100)] p-5 text-left dark:border-white/10">
          <SheetTitle className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white"><UserRound className="size-5 text-[var(--sky-blue-600)]" /> Account centre</SheetTitle>
          <SheetDescription>Secure account and safer-play routes for the SKYBET foundation.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-5">
          <div className="rounded-2xl bg-[var(--sky-navy-950)] p-4 text-white">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[0.12em] text-[var(--sky-blue-300)] uppercase">Visitor view</p><p className="mt-1 text-lg font-extrabold">Explore with confidence</p></div><Bell className="size-5 text-[var(--sky-blue-300)]" /></div>
            <Button className="mt-4 h-10 w-full rounded-xl bg-white font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-50)]" onClick={() => setAuthOpen(true)}>Sign in to SKYBET</Button>
          </div>
          {accountItems.map(([Icon, title, description, href]) => (
            <button key={title} type="button" onClick={() => navigateTo(href)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-[var(--sky-blue-100)] bg-white p-3 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-5" /></span>
              <span className="min-w-0"><span className="block text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{title}</span><span className="mt-0.5 block text-xs text-[var(--sky-navy-600)] dark:text-slate-400">{description}</span></span>
              <ChevronRight className="ml-auto size-4 text-[var(--sky-blue-400)]" />
            </button>
          ))}
        </div>
            </SheetContent>
      </Sheet>
      <CustomerAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
