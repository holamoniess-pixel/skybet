import { Clock3, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "No scheduled proof expiry";
}

export function ProofRetentionStatusCard() {
  const status = trpc.paymentReview.proofRetentionStatus.useQuery();
  const data = status.data;
  return <Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-emerald-600)] text-white"><Clock3 className="size-5" /></span><div><h2 className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">Proof retention</h2><p className="mt-1 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Payment screenshots are private and removed after 24 hours. This card never displays proof files, keys, or storage credentials.</p></div></div>{status.isLoading ? <p className="mt-4 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Checking retention status…</p> : data ? <div className="mt-4 grid gap-2 rounded-xl bg-[var(--sky-ice-50)] p-3 text-xs text-[var(--sky-navy-700)] dark:bg-white/5 dark:text-slate-300"><p><strong>Cleanup protection:</strong> {data.cleanupConfigured ? "Ready for a protected daily request" : "Disabled until the server-only cleanup token is configured"}</p><p><strong>Proofs waiting for cleanup:</strong> {data.dueCount}</p><p><strong>Next expiry:</strong> {formatDate(data.nextExpiryAt)}</p><p><strong>Last cleanup:</strong> {data.lastRun ? `${data.lastRun.status} at ${formatDate(data.lastRun.runAt)} (${data.lastRun.deletedCount} removed, ${data.lastRun.failedCount} failed)` : "No cleanup run recorded yet"}</p></div> : <p className="mt-4 text-sm text-red-700">Retention status could not be loaded.</p>}<p className="mt-4 flex gap-2 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--sky-emerald-600)]" />Payment approval remains manual and does not move a balance.</p></CardContent></Card>;
}
