import { useEffect, useState } from "react";
import { BadgeCheck, Percent } from "lucide-react";
import { toast } from "sonner";
import { validateReferralCommissionPercentage } from "@shared/payments";
import { AdminUserSearch } from "@/components/skybet/AdminUserSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export function ReferralCommissionAdminCard() {
  const utils = trpc.useUtils();
  const [percentage, setPercentage] = useState("0");
  const [reason, setReason] = useState("Programme referral commission update");
  const [userId, setUserId] = useState("");
  const [overridePercentage, setOverridePercentage] = useState("0");
  const [overrideReason, setOverrideReason] = useState("Customer-specific referral commission exception");
  const selectedUserId = Number(userId);
  const hasSelectedUser = Number.isInteger(selectedUserId) && selectedUserId > 0;
  const activeRule = trpc.commissions.activeRule.useQuery();
  const activeOverride = trpc.commissions.activeOverride.useQuery({ userId: selectedUserId }, { enabled: hasSelectedUser });
  const saveDefault = trpc.commissions.saveDefaultRule.useMutation({
    onSuccess: rule => { setPercentage(String(rule.percentage)); utils.commissions.activeRule.invalidate(); toast.success(`Global referral commission saved at ${Number(rule.percentage).toFixed(2)}%.`); },
    onError: error => toast.error(error.message),
  });
  const saveOverride = trpc.commissions.saveUserOverride.useMutation({
    onSuccess: override => { setOverridePercentage(String(override.percentage)); utils.commissions.activeOverride.invalidate({ userId: override.userId }); toast.success(`Customer #${override.userId} commission override saved.`); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (activeRule.data) { setPercentage(String(activeRule.data.percentage)); setReason(activeRule.data.reason); }
  }, [activeRule.data]);

  const saveGlobal = () => {
    if (!validateReferralCommissionPercentage(percentage).ok) return toast.error("Enter a percentage from 0 to 100.");
    saveDefault.mutate({ percentage, reason });
  };
  const saveCustomer = () => {
    if (!hasSelectedUser) return toast.error("Select a valid customer first.");
    if (!validateReferralCommissionPercentage(overridePercentage).ok) return toast.error("Enter a percentage from 0 to 100.");
    saveOverride.mutate({ userId: selectedUserId, percentage: overridePercentage, reason: overrideReason });
  };

  return <Card className="border-[var(--sky-blue-100)] bg-white shadow-[0_12px_26px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]"><CardHeader className="border-b border-[var(--sky-blue-100)] pb-5 dark:border-white/10"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-blue-600)] text-white"><Percent className="size-5" /></span><div><CardTitle className="text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Referral commission</CardTitle><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Set a global percentage for all referrals or a documented customer exception. It is policy configuration only; any resulting reward remains bonus balance only.</p></div></div></CardHeader><CardContent className="space-y-5 p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-2"><Label htmlFor="commission-percentage" className="font-bold text-[var(--sky-navy-950)] dark:text-white">Global commission percentage</Label><div className="relative"><Input id="commission-percentage" value={percentage} onChange={event => setPercentage(event.target.value)} inputMode="decimal" className="h-12 rounded-xl border-[var(--sky-blue-200)] bg-[var(--sky-ice-50)] pr-11 text-base font-extrabold text-[var(--sky-navy-950)] dark:border-white/15 dark:bg-white/5 dark:text-white" /><span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-extrabold text-[var(--sky-blue-700)]">%</span></div><p className="text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">When no customer override exists, this percentage applies to every eligible referral.</p></div><Button disabled={saveDefault.isPending || activeRule.isLoading} onClick={saveGlobal} className="h-12 rounded-xl bg-[var(--sky-blue-600)] px-5 font-extrabold hover:bg-[var(--sky-blue-700)]">{saveDefault.isPending ? "Saving…" : "Save global commission"}</Button></div><div className="space-y-2"><Label htmlFor="commission-reason">Change reason</Label><Input id="commission-reason" value={reason} onChange={event => setReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><div className="border-t border-[var(--sky-blue-100)] pt-5 dark:border-white/10"><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Customer override</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">The override percentage replaces the global policy only for the selected customer.</p><div className="mt-4"><AdminUserSearch onSelectUser={id => setUserId(String(id))} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="commission-customer">Customer ID</Label><Input id="commission-customer" inputMode="numeric" value={userId} onChange={event => setUserId(event.target.value)} placeholder="Search above or enter ID" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><div className="space-y-2"><Label htmlFor="commission-override">Commission percentage</Label><div className="relative"><Input id="commission-override" inputMode="decimal" value={overridePercentage} onChange={event => setOverridePercentage(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] pr-9 dark:border-white/15 dark:bg-white/5" /><span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-extrabold text-[var(--sky-blue-700)]">%</span></div></div></div><div className="mt-4 space-y-2"><Label htmlFor="commission-override-reason">Override reason</Label><Input id="commission-override-reason" value={overrideReason} onChange={event => setOverrideReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><Button disabled={saveOverride.isPending} variant="outline" onClick={saveCustomer} className="mt-4 h-11 rounded-xl border-[var(--sky-blue-200)] font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)] dark:border-white/15 dark:text-white">{saveOverride.isPending ? "Saving…" : "Save customer override"}</Button>{hasSelectedUser ? <div className="mt-4 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 text-sm dark:border-white/10 dark:bg-white/5">{activeOverride.isLoading ? <p className="text-[var(--sky-navy-600)] dark:text-slate-400">Checking customer override…</p> : activeOverride.data ? <div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--sky-emerald-700)]" /><p className="text-[var(--sky-navy-700)] dark:text-slate-300"><strong className="text-[var(--sky-navy-950)] dark:text-white">Active override:</strong> Customer #{activeOverride.data.userId} uses {Number(activeOverride.data.percentage).toFixed(2)}%. Reason: {activeOverride.data.reason}</p></div> : <p className="text-[var(--sky-navy-600)] dark:text-slate-400">No override is active. The global percentage applies.</p>}</div> : null}</div></CardContent></Card>;
}
