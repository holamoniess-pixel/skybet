import { useEffect, useState } from "react";
import { BadgeDollarSign, BadgeCheck, CircleAlert, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { validateBonusPolicyAmounts } from "@shared/bonusPolicies";
import { AdminUserSearch } from "@/components/skybet/AdminUserSearch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

type PolicyInputs = {
  depositBonusAmount: string;
  settlementBonusAmount: string;
};

const emptyPolicy: PolicyInputs = {
  depositBonusAmount: "0.00",
  settlementBonusAmount: "0.00",
};

function PolicyFields({ idPrefix, values, onChange }: { idPrefix: string; values: PolicyInputs; onChange: (field: keyof PolicyInputs, value: string) => void }) {
  const fields: Array<[keyof PolicyInputs, string, string]> = [
    ["depositBonusAmount", "Deposit bonus", "Promotion credit only"],
    ["settlementBonusAmount", "Settlement bonus", "Promotion credit only"],
  ];

  return <div className="grid gap-3 sm:grid-cols-2">{fields.map(([field, label, help]) => <div key={field} className="space-y-1.5"><Label htmlFor={`${idPrefix}-${field}`} className="text-xs font-extrabold text-[var(--sky-navy-900)] dark:text-white">{label}</Label><div className="relative"><Input id={`${idPrefix}-${field}`} value={values[field]} onChange={event => onChange(field, event.target.value)} inputMode="decimal" aria-describedby={`${idPrefix}-${field}-help`} className="h-11 rounded-xl border-[var(--sky-blue-200)] bg-[var(--sky-ice-50)] pr-12 font-extrabold text-[var(--sky-navy-950)] dark:border-white/15 dark:bg-white/5 dark:text-white" /><span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">GHS</span></div><p id={`${idPrefix}-${field}-help`} className="text-[11px] leading-4 text-[var(--sky-navy-600)] dark:text-slate-400">{help}</p></div>)}</div>;
}

export function BonusPolicyAdminCard() {
  const [programmePolicy, setProgrammePolicy] = useState<PolicyInputs>(emptyPolicy);
  const [programmeReason, setProgrammeReason] = useState("Programme bonus policy update");
  const [customerId, setCustomerId] = useState("");
  const [customerPolicy, setCustomerPolicy] = useState<PolicyInputs>(emptyPolicy);
  const [customerReason, setCustomerReason] = useState("Customer-specific bonus policy exception");
  const customerIdNumber = Number(customerId);
  const canLookupCustomer = Number.isInteger(customerIdNumber) && customerIdNumber > 0;
  const utils = trpc.useUtils();
  const activeRule = trpc.bonusPolicies.activeRule.useQuery();
  const activeOverride = trpc.bonusPolicies.activeOverride.useQuery({ userId: customerIdNumber }, { enabled: canLookupCustomer });
  const saveDefaultRule = trpc.bonusPolicies.saveDefaultRule.useMutation({
    onSuccess: rule => {
      setProgrammePolicy({ depositBonusAmount: String(rule.depositBonusAmount), settlementBonusAmount: String(rule.settlementBonusAmount) });
      utils.bonusPolicies.activeRule.invalidate();
      toast.success("Programme bonus policy saved. Credits remain in bonus balance only.");
    },
    onError: error => toast.error(error.message),
  });
  const saveUserOverride = trpc.bonusPolicies.saveUserOverride.useMutation({
    onSuccess: rule => {
      setCustomerPolicy({ depositBonusAmount: String(rule.depositBonusAmount), settlementBonusAmount: String(rule.settlementBonusAmount) });
      utils.bonusPolicies.activeOverride.invalidate({ userId: rule.userId });
      toast.success(`Customer #${rule.userId} bonus policy saved.`);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!activeRule.data) return;
    setProgrammePolicy({ depositBonusAmount: String(activeRule.data.depositBonusAmount), settlementBonusAmount: String(activeRule.data.settlementBonusAmount) });
    setProgrammeReason(activeRule.data.reason);
  }, [activeRule.data]);

  const updateProgramme = (field: keyof PolicyInputs, value: string) => setProgrammePolicy(current => ({ ...current, [field]: value }));
  const updateCustomer = (field: keyof PolicyInputs, value: string) => setCustomerPolicy(current => ({ ...current, [field]: value }));
  const submitProgramme = () => {
    const validation = validateBonusPolicyAmounts({ referralCommissionAmount: "0.00", ...programmePolicy });
    if (!validation.ok) return toast.error(validation.reason);
    saveDefaultRule.mutate({ referralCommissionAmount: "0.00", ...programmePolicy, currency: "GHS", reason: programmeReason });
  };
  const submitCustomer = () => {
    if (!canLookupCustomer) return toast.error("Select a valid customer before saving an override.");
    const validation = validateBonusPolicyAmounts({ referralCommissionAmount: "0.00", ...customerPolicy });
    if (!validation.ok) return toast.error(validation.reason);
    saveUserOverride.mutate({ userId: customerIdNumber, referralCommissionAmount: "0.00", ...customerPolicy, currency: "GHS", reason: customerReason });
  };

  return <Card className="border-[var(--sky-blue-100)] bg-white shadow-[0_12px_26px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]"><CardHeader className="border-b border-[var(--sky-blue-100)] pb-5 dark:border-white/10"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sky-emerald-600)]/12 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><BadgeDollarSign className="size-5" /></span><div><CardTitle className="text-xl font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Bonus ledger policy</CardTitle><p className="mt-1 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Set deposit and settlement bonus amounts. Referral commission percentage is configured separately; all non-deposit credits remain in bonus balance only.</p></div></div></CardHeader><CardContent className="space-y-6 p-5 sm:p-6"><div className="rounded-2xl border border-[var(--sky-emerald-600)]/20 bg-[var(--sky-emerald-600)]/8 p-4"><div className="flex items-center gap-2"><Badge className="rounded-full bg-[var(--sky-emerald-600)]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.1em] text-[var(--sky-emerald-700)] uppercase hover:bg-[var(--sky-emerald-600)]/15 dark:text-[var(--sky-emerald-500)]">Bonus only</Badge><p className="text-xs font-bold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">Configuration does not credit customers or move funds.</p></div><div className="mt-4"><PolicyFields idPrefix="programme-policy" values={programmePolicy} onChange={updateProgramme} /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-1.5"><Label htmlFor="programme-policy-reason" className="text-xs font-extrabold">Policy change reason</Label><Input id="programme-policy-reason" value={programmeReason} onChange={event => setProgrammeReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><Button onClick={submitProgramme} disabled={activeRule.isLoading || saveDefaultRule.isPending} className="h-11 rounded-xl bg-[var(--sky-blue-600)] px-4 font-extrabold hover:bg-[var(--sky-blue-700)]">{saveDefaultRule.isPending ? "Saving…" : "Save programme policy"}</Button></div></div><div className="border-t border-[var(--sky-blue-100)] pt-5 dark:border-white/10"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-4 shrink-0 text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]" /><div><p className="text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Customer bonus exception</p><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Override the two bonus-credit amounts for one customer. The reason and before/after record are kept in the administrator audit log.</p></div></div><div className="mt-4"><AdminUserSearch onSelectUser={userId => setCustomerId(String(userId))} /></div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,0.4fr)_1fr]"><div className="space-y-1.5"><Label htmlFor="bonus-policy-customer-id" className="text-xs font-extrabold">Customer ID</Label><Input id="bonus-policy-customer-id" value={customerId} onChange={event => setCustomerId(event.target.value)} inputMode="numeric" placeholder="Select above" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><div className="rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 text-xs leading-5 text-[var(--sky-navy-700)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{canLookupCustomer && activeOverride.data ? <><BadgeCheck className="mr-1 inline size-3.5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" />Active exception found for customer #{activeOverride.data.userId}.</> : canLookupCustomer && activeOverride.isLoading ? "Checking active customer policy…" : "No active customer exception selected. The programme policy will apply."}</div></div><div className="mt-4"><PolicyFields idPrefix="customer-policy" values={customerPolicy} onChange={updateCustomer} /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-1.5"><Label htmlFor="customer-policy-reason" className="text-xs font-extrabold">Exception reason</Label><Input id="customer-policy-reason" value={customerReason} onChange={event => setCustomerReason(event.target.value)} className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><Button variant="outline" onClick={submitCustomer} disabled={saveUserOverride.isPending} className="h-11 rounded-xl border-[var(--sky-blue-200)] px-4 font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)] dark:border-white/15 dark:text-white">{saveUserOverride.isPending ? "Saving…" : "Save customer policy"}</Button></div></div><div className="flex gap-2 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 text-xs leading-5 text-[var(--sky-navy-700)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><CircleAlert className="mt-0.5 size-4 shrink-0 text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]" />These are policy controls only. Ledger entries, deposits, withdrawals, and settlement credits require approved server-side payment and betting services.</div></CardContent></Card>;
}
