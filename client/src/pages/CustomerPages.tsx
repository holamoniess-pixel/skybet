import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Bell, CalendarDays, CircleHelp, ClipboardList, Copy, Gamepad2, Link2, Mail, Search, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { filterSkybetEvents, type SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/components/skybet/CustomerShell";
import { GamesFeedPreview } from "@/components/skybet/GamesFeedPreview";
import { PreviewSlipFab } from "@/components/skybet/PreviewSlipFab";
import { SelectionSheet } from "@/components/skybet/SelectionSheet";
import { SkybetEventCard } from "@/components/skybet/SkybetEventCard";
import { trpc } from "@/lib/trpc";

type Selection = { event: SkybetEvent; label: string; value: string };
type PreviewSelection = Selection | null;

function useSelectionSlip() {
  const [selections, setSelections] = useState<Selection[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("skybet-preview-slip") ?? "[]") as Selection[]; } catch { return []; }
  });
  useEffect(() => { window.localStorage.setItem("skybet-preview-slip", JSON.stringify(selections)); }, [selections]);
  const chooseSelection = (event: SkybetEvent, label: string, value: string) => setSelections(current => [...current.filter(item => item.event.id !== event.id), { event, label, value }]);
  const removeSelection = (eventId: string, label: string) => setSelections(current => current.filter(item => !(item.event.id === eventId && item.label === label)));
  return { selections, chooseSelection, removeSelection, clearSelections: () => setSelections([]) };
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="border-b border-[var(--sky-blue-100)] bg-white py-5 dark:border-white/10 dark:bg-[var(--card)] sm:py-6"><div className="container"><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">{eyebrow}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.06em] text-[var(--sky-navy-950)] sm:text-4xl dark:text-white">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-300">{description}</p></div></section>;
}

function EventRows({ events }: { events: SkybetEvent[] }) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { selections, chooseSelection, removeSelection, clearSelections } = useSelectionSlip();
  return <><div className="space-y-2">{events.map(event => <SkybetEventCard key={event.id} event={event} selectedMarket={selections.find(item => item.event.id === event.id)?.label} onMarketSelect={chooseSelection} />)}</div><PreviewSlipFab selection={selections[0] ?? null} selectionCount={selections.length} onOpen={() => setSelectionOpen(true)} /><SelectionSheet open={selectionOpen} onOpenChange={setSelectionOpen} selection={selections[0] ?? null} selections={selections} onRemoveSelection={removeSelection} onClearSelections={clearSelections} /></>;
}

export function LivePage() {
  const feed = trpc.games.matchFeed.useQuery(undefined, { refetchInterval: 30_000, refetchIntervalInBackground: false });
  const events = filterSkybetEvents(feed.data?.events ?? [], "live", "All");
  return <CustomerShell activeMobileNav="Live"><PageHeader eyebrow="Live board" title="Live matches" description="Live states and scores from the live match service." /><main className="container py-5 md:py-6"><div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-3 py-2 text-sm font-bold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /> {events.length} live events</div><EventRows events={events} /></main></CustomerShell>;
}

export function SportsPage() {
  const feed = trpc.games.matchFeed.useQuery(undefined, { refetchInterval: 30_000, refetchIntervalInBackground: false });
  const events = filterSkybetEvents(feed.data?.events ?? [], "upcoming", "All");
  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Discover sports" title="Upcoming matches" description="Browse football fixtures, live updates, forecasts, and odds." /><main className="container py-5 md:py-6"><div className="mb-3 grid gap-2 sm:grid-cols-3">{["Football", "Tennis", "Virtuals"].map((sport, index) => <Card key={sport} className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="flex items-center gap-2.5 p-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[var(--sky-ice-100)] text-[var(--sky-blue-600)]"><Trophy className="size-3.5" /></span><div><p className="text-[13px] font-extrabold text-[var(--sky-navy-950)] dark:text-white">{sport}</p><p className="mt-px text-[11px] text-[var(--sky-navy-600)] dark:text-slate-400">{index === 0 ? "Football fixtures" : "More sports soon"}</p></div></CardContent></Card>)}</div><EventRows events={events} /></main></CustomerShell>;
}

export function GamesPage() {
  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Games hub" title="SKYBET match centre" description="View SKYBET football pairings, upcoming/live states, forecasts, scores, and market odds." /><main className="container py-5 md:py-6"><GamesFeedPreview heading="Scores and fixtures" /></main></CustomerShell>;
}

export function SearchPage() {
  const feed = trpc.games.matchFeed.useQuery(undefined, { refetchInterval: 30_000, refetchIntervalInBackground: false });
  const [query, setQuery] = useState("");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { selections, chooseSelection, removeSelection, clearSelections } = useSelectionSlip();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const events = feed.data?.events ?? [];
    if (!normalized) return events;
    return events.filter(event => [event.sport, event.competition, ...event.teams].join(" ").toLowerCase().includes(normalized));
  }, [query, feed.data?.events]);
  const chooseFirstMarket = (event: SkybetEvent) => {
    const market = event.markets[0];
    chooseSelection(event, market.label, market.value);
  };

  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Catalogue search" title="Find an event" description="Search the match market catalogue by sport, competition, or team name." /><main className="container py-5 md:py-6"><div className="relative"><Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--sky-blue-600)]" /><Input autoFocus aria-label="Search SKYBET events" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sport, competition, or team" className="h-12 rounded-2xl border-[var(--sky-blue-200)] bg-white pl-12 text-base dark:border-white/15 dark:bg-[var(--card)]" /></div><p className="mt-3 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">{results.length} matching event{results.length === 1 ? "" : "s"} · tap a card to open its betslip.</p><div className="mt-3 space-y-2">{results.map(event => <button key={event.id} type="button" onClick={() => chooseFirstMarket(event)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--sky-blue-100)] bg-white p-3 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:hover:bg-white/5"><span className={`size-2 rounded-full ${event.isLive ? "bg-[var(--sky-emerald-600)]" : "bg-[var(--sky-blue-500)]"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]} vs {event.teams[1]}</span><span className="block truncate text-xs text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition}</span></span><span className="text-xs font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.markets[0].value}</span></button>)}</div></main><PreviewSlipFab selection={selections[0] ?? null} selectionCount={selections.length} onOpen={() => setSelectionOpen(true)} /><SelectionSheet open={selectionOpen} onOpenChange={setSelectionOpen} selection={selections[0] ?? null} selections={selections} onRemoveSelection={removeSelection} onClearSelections={clearSelections} /></CustomerShell>;
}

export function ActivityPage() {
  const [copyMessage, setCopyMessage] = useState("");
  const referralProfile = trpc.account.referralProfile.useQuery();
  const notifications = trpc.account.notifications.useQuery();
  const referralCode = referralProfile.data?.referralCode ?? "";
  const referralLink = `${typeof window === "undefined" ? "https://skybet.example" : window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`;
  const copyReferralLink = async () => {
    if (!navigator.clipboard) {
      setCopyMessage("Copy is unavailable. You can select the link manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyMessage("Referral link copied.");
    } catch {
      setCopyMessage("We could not copy the link. You can select it manually instead.");
    }
  };

  return <CustomerShell activeMobileNav="Rewards"><PageHeader eyebrow="My activity" title="Selection activity" description="Keep your selections, account updates, and safer-play actions together in one SKYBET view." /><main className="container py-5 md:py-6"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><Card id="rewards" className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-3"><ClipboardList className="size-4.5 text-[var(--sky-blue-600)]" /><h2 className="mt-2 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Selection activity</h2><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Your current selections are shown here.</p></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-3"><Bell className="size-4.5 text-[var(--sky-blue-600)]" /><h2 className="mt-2 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Notifications</h2>{notifications.data?.length ? <div className="mt-2 space-y-2">{notifications.data.slice(0, 4).map(item => <div key={item.id} className="rounded-lg bg-[var(--sky-ice-50)] p-2 dark:bg-white/5"><p className="text-xs font-extrabold">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">{item.content}</p></div>)}</div> : <p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Referral signup updates will appear here.</p>}</CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-white/5"><CardContent className="p-3"><ShieldCheck className="size-4.5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" /><h2 className="mt-2 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Account controls</h2><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Security, support, and safer-play choices stay visible.</p></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white dark:border-white/10"><CardContent className="p-3"><Link2 className="size-4.5 text-[var(--sky-emerald-500)]" /><h2 className="mt-2 text-sm font-extrabold">Referral link</h2><p className="mt-1 text-xs leading-5 text-slate-300">Share this link to attribute eligible new customers. Rewards are credited to the bonus balance after their first approved deposit.</p><code className="mt-2 block truncate rounded-lg bg-white/10 px-2 py-1.5 text-[11px] text-[var(--sky-blue-200)]">{referralCode ? referralLink : "Your referral link is being prepared"}</code><p className="mt-2 text-xs text-slate-300">{referralProfile.data?.referralsCount ?? 0} referred · GH₵ {referralProfile.data?.rewardsCredited ?? "0.00"} credited</p><Button type="button" variant="outline" className="mt-2 min-h-10 border-white/20 bg-white/5 text-xs font-extrabold text-white hover:bg-white/10" onClick={copyReferralLink}><Copy className="size-3.5" />Copy referral link</Button><p aria-live="polite" className="mt-1 min-h-4 text-xs font-semibold text-[var(--sky-emerald-500)]">{copyMessage}</p></CardContent></Card></div></main></CustomerShell>;
}

export function AccountPage() {
  const accountSections = [
    { id: "profile", icon: UserRound, title: "Profile", text: "Manage your identity and account preferences here." },
    { id: "safer-play", icon: ShieldCheck, title: "Safer play", text: "Set limits, manage exclusions, and access support whenever you need them." },
    { id: "support", icon: CircleHelp, title: "Customer service", text: "For account support, contact the SKYBET customer-service team.", email: "Skybet0553@gmail.com" },
    { id: "preferences", icon: UserRound, title: "Preferences", text: "Manage your personalisation choices here." },
  ];
  return <CustomerShell activeMobileNav="Account"><PageHeader eyebrow="Account centre" title="Your SKYBET controls" description="Manage your identity, preferences, safety, and support from one place." /><main className="container py-5 md:py-6"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{accountSections.map(({ id, icon: Icon, title, text, email }) => <Card id={id} key={title} className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-3"><span className="grid size-8 place-items-center rounded-lg bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-3.5" /></span><h2 className="mt-2 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">{text}</p>{email ? <a href={`mailto:${email}`} aria-label="Email SKYBET customer service" className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-2 text-[11px] font-extrabold text-[var(--sky-emerald-700)] hover:bg-[var(--sky-emerald-600)]/15 dark:text-[var(--sky-emerald-500)]"><Mail className="size-3.5" />{email}</a> : null}</CardContent></Card>)}</div></main></CustomerShell>;
}

export function EventDetailPage() {
  const [, params] = useRoute("/event/:id");
  const [, setLocation] = useLocation();
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { selections, chooseSelection, removeSelection, clearSelections } = useSelectionSlip();
  const backendFeed = trpc.games.matchFeed.useQuery(undefined, { refetchInterval: 30_000 });
  const event = backendFeed.data?.events.find(item => item.id === params?.id);
  if (!event) return <CustomerShell activeMobileNav="Sports"><main className="container py-12"><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-6 text-center"><CalendarDays className="mx-auto size-7 text-[var(--sky-blue-600)]" /><h1 className="mt-3 text-xl font-extrabold">Event not found</h1><Button className="mt-4" onClick={() => setLocation("/sports")}>Browse events</Button></CardContent></Card></main></CustomerShell>;
  return <CustomerShell activeMobileNav={event.isLive ? "Live" : "Sports"}><PageHeader eyebrow={event.isLive ? "Live match market" : "match market"} title={`${event.teams[0]} vs ${event.teams[1]}`} description={`${event.competition} · ${event.status}`} /><main className="container py-5 md:py-6"><Button variant="ghost" className="mb-4 -ml-3 font-bold text-[var(--sky-blue-700)]" onClick={() => setLocation(event.isLive ? "/live" : "/sports")}><ArrowLeft className="size-4" /> Return to event board</Button><Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><Badge className="bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]">{event.sport}</Badge><span className="text-sm font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span></div><div className="mt-5 grid items-center gap-3 text-center sm:grid-cols-[1fr_auto_1fr]"><p className="text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}</p><span className="rounded-xl bg-[var(--sky-navy-950)] px-3 py-1.5 text-base font-extrabold text-white">{event.score ?? "VS"}</span><p className="text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}</p></div><div className="mt-5 grid gap-2 sm:grid-cols-3">{event.markets.map(market => <button key={market.label} type="button" onClick={() => chooseSelection(event, market.label, market.value)} className="min-h-11 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 text-left transition hover:border-[var(--sky-blue-300)] dark:border-white/10 dark:bg-white/5"><span className="block text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-400">{market.label}</span><span className="mt-1 block text-base font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{market.value}</span></button>)}</div><div className="mt-4 rounded-xl bg-[var(--sky-emerald-600)]/10 p-3 text-sm leading-5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">SKYBET market. Bets are validated and recorded securely.</div></CardContent></Card></main><PreviewSlipFab selection={selections[0] ?? null} selectionCount={selections.length} onOpen={() => setSelectionOpen(true)} /><SelectionSheet open={selectionOpen} onOpenChange={setSelectionOpen} selection={selections[0] ?? null} selections={selections} onRemoveSelection={removeSelection} onClearSelections={clearSelections} /></CustomerShell>;
}
