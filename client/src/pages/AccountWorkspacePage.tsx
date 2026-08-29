import { Activity, CreditCard, Gift, History, Landmark, ListChecks, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerShell } from "@/components/skybet/CustomerShell";
import { SettlementPreviewDialog } from "@/components/skybet/SettlementPreviewDialog";
import { WalletPaymentRequestCard } from "@/components/skybet/WalletPaymentRequestCard";
import { trpc } from "@/lib/trpc";

const workspace = {
  "/profile": { eyebrow: "Profile", title: "Your profile", description: "Personal details and verified account preferences will appear here after sign-in.", icon: UserRound, body: "Sign in securely to view and manage your profile details." },
  "/settings": { eyebrow: "Settings", title: "Account settings", description: "Control communication, security, and account preferences from one place.", icon: Settings2, body: "Manage your account settings securely from this workspace." },
  "/bets": { eyebrow: "Bets", title: "Bets list", description: "A single place for your saved and settled account activity.", icon: ListChecks, body: "Your placed and settled bets will appear here." },
  "/bets/running": { eyebrow: "Bets", title: "Running bets", description: "Track your active bets and their settlement status.", icon: Activity, body: "Your active bets will appear here." },
  "/bets/history": { eyebrow: "Bets", title: "Bet history", description: "Review your completed bets and results.", icon: History, body: "Your completed bets and results will appear here." },
  "/wallet": { eyebrow: "Wallet", title: "Deposit and withdrawal", description: "Submit a payment request and monitor its review status.", icon: WalletCards, body: "Choose an available method, confirm the request details, and track its review status securely." },
} as const;

export function AccountWorkspacePage() {
  const [location, setLocation] = useLocation();
  const [settlementPreviewOpen, setSettlementPreviewOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const balance = trpc.account.balanceSummary.useQuery(undefined, { enabled: isAuthenticated });
  const view = workspace[location.split("#")[0] as keyof typeof workspace] ?? workspace["/profile"];
  const Icon = view.icon;
  const walletView = location.startsWith("/wallet");
  const deposited = balance.data?.depositedBalance ?? "0.00";
  const bonus = balance.data?.bonusBalance ?? "0.00";

  return <CustomerShell activeMobileNav="Account"><section className="border-b border-[var(--sky-blue-100)] bg-white py-5 dark:border-white/10 dark:bg-[var(--card)] sm:py-6"><div className="container"><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">{view.eyebrow}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.06em] text-[var(--sky-navy-950)] dark:text-white">{view.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-300">{view.description}</p></div></section><main className="container grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_19rem] md:py-6"><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-4 sm:p-5"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">{walletView ? "Payment requests" : "Account centre"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{view.body}</p>{walletView ? <WalletPaymentRequestCard /> : <><button type="button" onClick={() => setLocation("/account")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--sky-blue-200)] px-4 text-sm font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-50)] dark:border-white/15 dark:text-[var(--sky-blue-300)]"><CreditCard className="size-4" />Return to account centre</button>{location.startsWith("/bets/history") ? <button type="button" onClick={() => setSettlementPreviewOpen(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--sky-navy-950)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--sky-navy-900)]"><Gift className="size-4 text-[var(--sky-emerald-500)]" />View settlement details</button> : null}<div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--sky-emerald-600)]/10 p-3 text-xs leading-5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Your account activity and balance are protected by server-side controls.</div></>}</CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white dark:border-white/10"><CardContent className="p-4"><p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--sky-emerald-500)] uppercase">Balance separation</p><div className="mt-4 space-y-3"><div className="rounded-xl bg-white/8 p-3"><p className="text-xs font-bold text-slate-300">Deposited funds</p><p className="mt-1 text-xl font-extrabold">GH₵ {Number(deposited).toFixed(2)}</p><p className="mt-1 text-xs leading-5 text-slate-300">Only confirmed deposits and future eligible settlement funds.</p></div><div className="rounded-xl bg-[var(--sky-emerald-600)]/15 p-3"><p className="text-xs font-bold text-[var(--sky-emerald-500)]">Bonus balance</p><p className="mt-1 text-xl font-extrabold text-[var(--sky-emerald-500)]">GH₵ {Number(bonus).toFixed(2)}</p><p className="mt-1 text-xs leading-5 text-slate-300">Referral commissions, deposit bonuses, and settlement bonuses only.</p></div></div><p className="mt-4 text-xs leading-5 text-slate-300">Your deposited funds and bonus balance are tracked separately.</p></CardContent></Card></main><SettlementPreviewDialog open={settlementPreviewOpen} onOpenChange={setSettlementPreviewOpen} /></CustomerShell>;
}
