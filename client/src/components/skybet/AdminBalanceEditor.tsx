import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export function AdminBalanceEditor() {
  const [userIdText, setUserIdText] = useState("");
  const [balanceType, setBalanceType] = useState<"deposited" | "bonus">("deposited");
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const userId = Number(userIdText);
  const adminBalances = (trpc as unknown as { adminBalances?: { adjust: { useMutation: (options: unknown) => any } } }).adminBalances;
  if (!adminBalances) return <Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><h2 className="text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">Edit customer balance</h2><p className="mt-2 text-sm text-muted-foreground">Balance editing is available after the updated API is deployed.</p></CardContent></Card>;
  const summary = trpc.adminManagement.customerSummary.useQuery({ userId }, { enabled: Number.isInteger(userId) && userId > 0 });
  const utils = trpc.useUtils();
  const adjust = adminBalances.adjust.useMutation({
    onSuccess: async () => {
      setMessage("Balance saved and audit recorded.");
      await utils.adminManagement.customerSummary.invalidate({ userId });
      setNewBalance("");
      setReason("");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const current = balanceType === "deposited" ? summary.data?.balance.depositedBalance : summary.data?.balance.bonusBalance;

  return <Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><h2 className="text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">Edit customer balance</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Set the deposited or bonus balance for one customer. Every change is written as an immutable, auditable adjustment.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="balance-user-id">Customer ID</Label><Input id="balance-user-id" value={userIdText} onChange={event => setUserIdText(event.target.value)} inputMode="numeric" placeholder="e.g. 12" /></div><div className="space-y-2"><Label htmlFor="balance-type">Balance type</Label><select id="balance-type" value={balanceType} onChange={event => setBalanceType(event.target.value as "deposited" | "bonus")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="deposited">Deposited balance</option><option value="bonus">Bonus balance</option></select></div></div>{summary.isFetching ? <p className="mt-4 text-xs text-muted-foreground">Loading customer balance…</p> : summary.data ? <p className="mt-4 rounded-lg bg-[var(--sky-ice-50)] px-3 py-2 text-sm font-bold dark:bg-white/5">Current {balanceType} balance: GH₵ {Number(current ?? 0).toFixed(2)}</p> : userIdText ? <p className="mt-4 text-sm text-muted-foreground">Enter a valid customer ID to load the current balance.</p> : null}<div className="mt-4 space-y-2"><Label htmlFor="new-balance">New balance</Label><Input id="new-balance" value={newBalance} onChange={event => setNewBalance(event.target.value)} inputMode="decimal" placeholder="0.00" /></div><div className="mt-4 space-y-2"><Label htmlFor="balance-reason">Reason</Label><Input id="balance-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Describe the approved adjustment" /></div><Button type="button" disabled={adjust.isPending || !summary.data || !newBalance || reason.trim().length < 5} onClick={() => adjust.mutate({ userId, currency: "GHS", balanceType, newBalance, reason, idempotencyKey: `admin-balance-${userId}-${balanceType}-${Date.now()}` })} className="mt-5 h-11 bg-[var(--sky-blue-700)] font-extrabold text-white hover:bg-[var(--sky-blue-800)]">{adjust.isPending ? "Saving…" : "Save balance"}</Button>{message ? <p role="status" className="mt-3 text-sm font-semibold text-[var(--sky-navy-700)] dark:text-slate-300">{message}</p> : null}</CardContent></Card>;
}
