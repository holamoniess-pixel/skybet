import { useLocation } from "wouter";
import { BadgeCheck, Bell, CircleAlert, ClipboardList, Landmark, LockKeyhole, Settings2, UsersRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminManagementCard } from "@/components/skybet/AdminManagementCard";
import { BonusPolicyAdminCard } from "@/components/skybet/BonusPolicyAdminCard";
import { CustomerAccountAdminCard } from "@/components/skybet/CustomerAccountAdminCard";
import { GamesFeedPreview } from "@/components/skybet/GamesFeedPreview";
import { PaymentReviewAdminCard } from "@/components/skybet/PaymentReviewAdminCard";
import { ProofRetentionStatusCard } from "@/components/skybet/ProofRetentionStatusCard";
import { ReferralCommissionAdminCard } from "@/components/skybet/ReferralCommissionAdminCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AdminSection = "overview" | "customers" | "deposits" | "withdrawals" | "bonuses" | "site" | "matches" | "administrators";

const sectionDetails: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "SKYBET control room", title: "Operations with guardrails.", description: "Choose a clear work area for customers, review requests, bonuses, or site setup." },
  customers: { eyebrow: "Customer accounts", title: "Find a customer before you act.", description: "View deposited and bonus balances separately, payment state, and active policy exceptions." },
  deposits: { eyebrow: "Deposit review", title: "Review submitted deposits.", description: "Inspect proof, record a reasoned decision, and credit the deposited balance when approved." },
  withdrawals: { eyebrow: "Withdrawal review", title: "Review Mobile Money withdrawals.", description: "Review each withdrawal request, record the decision, and retain the audit trail." },
  bonuses: { eyebrow: "Bonuses & rewards", title: "Set policy, not customer funds.", description: "Manage site-wide and per-customer bonus and referral settings. All non-deposit values remain bonus balance only." },
  site: { eyebrow: "Site configuration", title: "Configure the operating boundary.", description: "Review payments, rewards, editorial content, and market settings." },
  matches: { eyebrow: "Match updates", title: "Fixtures with transparent forecasts.", description: "Inspect current pairings, live-state updates, odds, and forecasts. Settlement remains an explicit administrative action." },
  administrators: { eyebrow: "Owner controls", title: "Manage administrator access.", description: "Only the primary owner can create, revoke, or restore another local administrator." },
};

function AdminHeader({ section }: { section: AdminSection }) {
  const detail = sectionDetails[section];
  return <section className="flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[var(--sky-blue-100)] bg-white p-5 shadow-[0_14px_32px_rgba(10,63,158,0.06)] sm:p-7 lg:flex-row lg:items-end dark:border-white/10 dark:bg-[var(--card)]"><div><Badge className="rounded-full bg-[var(--sky-ice-100)] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[var(--sky-blue-700)] uppercase hover:bg-[var(--sky-ice-100)]">{detail.eyebrow}</Badge><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.06em] text-[var(--sky-navy-950)] sm:text-4xl dark:text-white">{detail.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{detail.description}</p></div><div className="flex items-center gap-2 rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-3 py-2 text-sm font-bold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><BadgeCheck className="size-4" />Manual review controls</div></section>;
}

function ReferralNotificationsCard() {
  const notifications = trpc.account.notifications.useQuery();
  return <Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Bell className="size-4" /></span><div><h2 className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">Referral signup notifications</h2><p className="text-xs text-[var(--sky-navy-600)] dark:text-slate-400">New referral-attributed signups are recorded here for administrators.</p></div></div>{notifications.data?.length ? <div className="mt-4 space-y-2">{notifications.data.slice(0, 5).map(item => <div key={item.id} className="rounded-xl bg-[var(--sky-ice-50)] p-3 dark:bg-white/5"><p className="text-xs font-extrabold text-[var(--sky-navy-950)] dark:text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">{item.content}</p></div>)}</div> : <p className="mt-4 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">No referral signup notifications yet.</p>}</CardContent></Card>;
}

function AdminOverview() {
  const quickLinks: Array<{ href: string; icon: typeof UsersRound; title: string; body: string }> = [
    { href: "/admin/customers", icon: UsersRound, title: "Customer accounts", body: "Search customer records and view separated balances." },
    { href: "/admin/deposits", icon: Landmark, title: "Deposits", body: "Review submitted deposits and proof." },
    { href: "/admin/withdrawals", icon: ClipboardList, title: "Withdrawals", body: "Review Mobile Money withdrawal requests." },
    { href: "/admin/bonuses", icon: Settings2, title: "Bonuses & rewards", body: "Set global or customer-specific policy." },
  ];
  return <><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{quickLinks.map(({ href, icon: Icon, title, body }) => <a href={href} key={href} className="rounded-2xl border border-[var(--sky-blue-100)] bg-white p-5 shadow-[0_10px_24px_rgba(10,63,158,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--sky-blue-300)] dark:border-white/10 dark:bg-[var(--card)]"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-5" /></span><h2 className="mt-5 font-extrabold text-[var(--sky-navy-950)] dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{body}</p></a>)}</section><section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><ReferralNotificationsCard /><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><ClipboardList className="size-5" /></span><div><p className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">Every sensitive action requires a reason</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Payment reviews, payment holds, bonus rules, referral settings, and administrator access changes retain an operational audit record.</p></div></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white dark:border-white/10"><CardContent className="p-5"><CircleAlert className="size-5 text-[var(--sky-emerald-500)]" /><p className="mt-3 text-sm font-extrabold">Payments and wagering controls</p><p className="mt-1 text-xs leading-5 text-slate-300">Approved deposits credit the deposited balance through the server ledger. Market outcomes are settled through administrator controls.</p></CardContent></Card></section></>;
}

function SiteConfigurationPage() {
  return <div className="grid gap-5"><section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4"><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><Landmark className="size-5 text-[var(--sky-blue-700)]" /><h2 className="mt-4 font-extrabold text-[var(--sky-navy-950)] dark:text-white">Payments</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Review submitted deposits and withdrawals, payment methods, and account activity.</p><Button asChild variant="outline" className="mt-4 h-10 border-[var(--sky-blue-200)] text-[var(--sky-blue-700)]"><a href="/admin/deposits">Open payment review</a></Button></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><UsersRound className="size-5 text-[var(--sky-blue-700)]" /><h2 className="mt-4 font-extrabold text-[var(--sky-navy-950)] dark:text-white">Customer rewards</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Site-wide and per-customer referral and bonus policies are versioned and audited.</p><Button asChild variant="outline" className="mt-4 h-10 border-[var(--sky-blue-200)] text-[var(--sky-blue-700)]"><a href="/admin/bonuses">Open rewards controls</a></Button></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><Settings2 className="size-5 text-[var(--sky-blue-700)]" /><h2 className="mt-4 font-extrabold text-[var(--sky-navy-950)] dark:text-white">Editorial content</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Promotional banners and landing-page content are managed separately in the SKYBET editorial workspace.</p><Button asChild variant="outline" className="mt-4 h-10 border-[var(--sky-blue-200)] text-[var(--sky-blue-700)]"><a href="https://skybet-editorial.sanity.studio/" target="_blank" rel="noreferrer">Open editorial workspace</a></Button></CardContent></Card><ProofRetentionStatusCard /></section></div>;
}

function AdminWorkspace() {
  const { user } = useAuth();
  const [location] = useLocation();
  const candidate = location.split("/")[2] as AdminSection | undefined;
  const section: AdminSection = candidate && candidate in sectionDetails ? candidate : "overview";
  if (user?.role !== "admin") return <div className="mx-auto grid min-h-[60dvh] max-w-xl place-items-center"><Card className="w-full border-[var(--sky-blue-100)] bg-white shadow-[0_14px_32px_rgba(10,63,158,0.08)] dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-7 text-center"><LockKeyhole className="mx-auto size-8 text-[var(--sky-blue-600)]" /><h1 className="mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">Administrator access required</h1><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">This workspace is reserved for a SKYBET administrator account.</p><Button asChild className="mt-5 h-11 rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]"><a href="/">Return to SKYBET</a></Button></CardContent></Card></div>;
  return <div className="mx-auto max-w-7xl space-y-6 pb-10"><AdminHeader section={section} />{section === "overview" ? <AdminOverview /> : null}{section === "customers" ? <CustomerAccountAdminCard /> : null}{section === "deposits" ? <PaymentReviewAdminCard requestType="deposit" /> : null}{section === "withdrawals" ? <PaymentReviewAdminCard requestType="withdrawal" /> : null}{section === "bonuses" ? <div className="grid gap-5"><BonusPolicyAdminCard /><ReferralCommissionAdminCard /></div> : null}{section === "site" ? <SiteConfigurationPage /> : null}{section === "matches" ? <GamesFeedPreview heading="Scores, fixtures & forecasts" showPredictions /> : null}{section === "administrators" ? <AdminManagementCard /> : null}</div>;
}

export default function Admin() { return <DashboardLayout><AdminWorkspace /></DashboardLayout>; }
