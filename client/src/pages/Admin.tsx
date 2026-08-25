import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  Gift,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { validateReferralRewardAmount } from "@shared/referrals";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminUserSearch } from "@/components/skybet/AdminUserSearch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

const oversightItems = [
  {
    icon: Gift,
    title: "Referral controls",
    description: "Programme defaults and per-user exceptions must be versioned and auditable.",
    state: "Configuration ready",
  },
  {
    icon: ShieldCheck,
    title: "Safer-play checks",
    description: "Restriction, exclusion, and marketing-suppression states belong to server-enforced account logic.",
    state: "Policy required",
  },
  {
    icon: Landmark,
    title: "Wallet operations",
    description: "Financial transactions remain unavailable until regulated providers, KYC, and reconciliations are approved.",
    state: "Not connected",
  },
] as const;

function AdminOverview() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("Programme reward update");
  const [overrideUserId, setOverrideUserId] = useState("");
  const [overrideAmount, setOverrideAmount] = useState("10");
  const [overrideReason, setOverrideReason] = useState("Customer-specific referral reward exception");
  const overrideUserIdNumber = Number(overrideUserId);
  const canLookupOverride = Number.isInteger(overrideUserIdNumber) && overrideUserIdNumber > 0;
  const referralUtils = trpc.useUtils();
  const activeRule = trpc.referrals.activeRule.useQuery(undefined, { enabled: user?.role === "admin" });
  const activeOverride = trpc.referrals.activeOverride.useQuery(
    { userId: overrideUserIdNumber },
    { enabled: user?.role === "admin" && canLookupOverride }
  );
  const saveDefaultRule = trpc.referrals.saveDefaultRule.useMutation({
    onSuccess: rule => {
      setAmount(String(rule.amount));
      referralUtils.referrals.activeRule.invalidate();
      toast.success(`Programme reward saved at GHS ${Number(rule.amount).toFixed(2)}.`);
    },
    onError: error => toast.error(error.message),
  });
  const saveUserOverride = trpc.referrals.saveUserOverride.useMutation({
    onSuccess: override => {
      setOverrideAmount(String(override.amount));
      referralUtils.referrals.activeOverride.invalidate({ userId: override.userId });
      toast.success(`Customer #${override.userId} referral reward override saved.`);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (activeRule.data) {
      setAmount(String(activeRule.data.amount));
      setReason(activeRule.data.reason);
    }
  }, [activeRule.data]);

  if (user?.role !== "admin") {
    return (
      <div className="mx-auto grid min-h-[60dvh] max-w-xl place-items-center">
        <Card className="w-full border-[var(--sky-blue-100)] bg-white shadow-[0_14px_32px_rgba(10,63,158,0.08)] dark:border-white/10 dark:bg-[var(--card)]">
          <CardContent className="p-7 text-center">
            <LockKeyhole className="mx-auto size-8 text-[var(--sky-blue-600)]" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">Administrator access required</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">This workspace is reserved for a SKYBET administrator account. Customer and restricted accounts cannot access referral or operational controls.</p>
            <Button asChild className="mt-5 h-11 rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]">
              <a href="/">Return to SKYBET</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const saveReward = () => {
    if (!validateReferralRewardAmount(amount).ok) {
      toast.error("Enter a valid programme reward amount.");
      return;
    }
    saveDefaultRule.mutate({ amount, currency: "GHS", reason });
  };

  const saveOverride = () => {
    const userId = Number(overrideUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error("Enter a valid customer ID.");
      return;
    }
    if (!validateReferralRewardAmount(overrideAmount).ok) {
      toast.error("Enter a valid customer reward amount.");
      return;
    }
    saveUserOverride.mutate({ userId, amount: overrideAmount, currency: "GHS", reason: overrideReason });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[var(--sky-blue-100)] bg-white p-5 shadow-[0_14px_32px_rgba(10,63,158,0.06)] sm:p-7 lg:flex-row lg:items-end dark:border-white/10 dark:bg-[var(--card)]">
        <div>
          <Badge className="rounded-full bg-[var(--sky-ice-100)] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[var(--sky-blue-700)] uppercase hover:bg-[var(--sky-ice-100)]">SKYBET control room</Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.06em] text-[var(--sky-navy-950)] sm:text-4xl dark:text-white">Operations with guardrails.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">The initial workspace keeps sensitive referral, safety, and provider-readiness decisions visible before any regulated live operation is enabled.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-3 py-2 text-sm font-bold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">
          <BadgeCheck className="size-4" />
          Preview environment
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {oversightItems.map(({ icon: Icon, title, description, state }) => (
          <Card key={title} className="border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-5" /></span>
                <Badge variant="outline" className="rounded-lg border-[var(--sky-blue-200)] text-[10px] font-extrabold tracking-[0.08em] text-[var(--sky-blue-700)] uppercase dark:border-white/15 dark:text-[var(--sky-blue-300)]">{state}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-[var(--sky-blue-100)] bg-white shadow-[0_12px_26px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
          <CardHeader className="border-b border-[var(--sky-blue-100)] pb-5 dark:border-white/10">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-blue-600)] text-white"><SlidersHorizontal className="size-5" /></span><div><CardTitle className="text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Referral reward controls</CardTitle><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Save a programme-wide GHS reward or create a documented per-customer exception. Every saved change creates an audit event.</p></div></div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2"><Label htmlFor="referral-amount" className="font-bold text-[var(--sky-navy-950)] dark:text-white">Programme default reward</Label><div className="relative"><Input id="referral-amount" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" aria-describedby="reward-help" className="h-12 rounded-xl border-[var(--sky-blue-200)] bg-[var(--sky-ice-50)] pr-14 text-base font-extrabold text-[var(--sky-navy-950)] dark:border-white/15 dark:bg-white/5 dark:text-white" /><span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">GHS</span></div><p id="reward-help" className="text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Set the programme reward, for example 5, 10, 15, or 20 GHS. The active rule is loaded from the server.</p></div>
              <Button disabled={saveDefaultRule.isPending || activeRule.isLoading} className="h-12 rounded-xl bg-[var(--sky-blue-600)] px-5 font-extrabold hover:bg-[var(--sky-blue-700)]" onClick={saveReward}>{saveDefaultRule.isPending ? "Saving…" : "Save programme rule"}</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="programme-reason" className="font-bold text-[var(--sky-navy-950)] dark:text-white">Change reason</Label><Input id="programme-reason" value={reason} onChange={event => setReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div>
            <div className="border-t border-[var(--sky-blue-100)] pt-5 dark:border-white/10"><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Customer override</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Search account records, select a customer, then save a documented referral-reward exception.</p><div className="mt-4"><AdminUserSearch onSelectUser={userId => setOverrideUserId(String(userId))} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="override-user-id">Customer ID</Label><Input id="override-user-id" inputMode="numeric" value={overrideUserId} onChange={event => setOverrideUserId(event.target.value)} placeholder="Search above or enter ID" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><div className="space-y-2"><Label htmlFor="override-amount">Override amount (GHS)</Label><Input id="override-amount" inputMode="decimal" value={overrideAmount} onChange={event => setOverrideAmount(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div></div><div className="mt-4 space-y-2"><Label htmlFor="override-reason">Override reason</Label><Input id="override-reason" value={overrideReason} onChange={event => setOverrideReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><Button disabled={saveUserOverride.isPending} variant="outline" className="mt-4 h-11 rounded-xl border-[var(--sky-blue-200)] font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)] dark:border-white/15 dark:text-white" onClick={saveOverride}>{saveUserOverride.isPending ? "Saving…" : "Save customer override"}</Button>{canLookupOverride ? <div className="mt-4 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 text-sm dark:border-white/10 dark:bg-white/5">{activeOverride.isLoading ? <p className="text-[var(--sky-navy-600)] dark:text-slate-400">Checking customer override…</p> : activeOverride.data ? <div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" /><p className="text-[var(--sky-navy-700)] dark:text-slate-300"><strong className="text-[var(--sky-navy-950)] dark:text-white">Active override:</strong> Customer #{activeOverride.data.userId} receives GHS {Number(activeOverride.data.amount).toFixed(2)}. Reason: {activeOverride.data.reason}</p></div> : <p className="text-[var(--sky-navy-600)] dark:text-slate-400">No active customer-specific override. The programme default applies.</p>}</div> : null}</div>
          </CardContent>
        </Card>

        <Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white shadow-[0_12px_26px_rgba(6,26,59,0.16)] dark:border-white/10">
          <CardContent className="p-6">
            <CircleAlert className="size-6 text-[var(--sky-blue-300)]" />
            <h2 className="mt-5 text-xl font-extrabold tracking-[-0.04em]">Before live activation</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300"><li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--sky-emerald-500)]" />Confirm operator licensing, jurisdiction, age checks, and responsible-play controls.</li><li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--sky-emerald-500)]" />Connect a licensed data or game provider through a server-side adapter and health monitoring.</li><li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--sky-emerald-500)]" />Add immutable audit events for referral rule changes, account restrictions, and financial reconciliation.</li></ul>
            <a href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-extrabold text-white transition hover:bg-white/15">Open customer match centre <ArrowUpRight className="size-4" /></a>
          </CardContent>
        </Card>
      </section>

      <Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><ClipboardList className="size-5" /></span><div><p className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">Referral changes are captured for audit</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Programme rules and customer overrides create append-only administrator audit events. Audit search and export remain a planned operational view.</p></div></div><UsersRound className="size-6 text-[var(--sky-blue-300)]" /></CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  return <DashboardLayout><AdminOverview /></DashboardLayout>;
}
