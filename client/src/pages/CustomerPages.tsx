import { useMemo, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, CircleHelp, ClipboardList, Gamepad2, Mail, Search, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { getMockGamesFeed } from "@shared/mockGamesFeed";
import { filterSkybetEvents, SKYBET_EVENTS, type SkybetEvent } from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/components/skybet/CustomerShell";
import { GamesFeedPreview } from "@/components/skybet/GamesFeedPreview";
import { SelectionSheet } from "@/components/skybet/SelectionSheet";
import { SkybetEventCard } from "@/components/skybet/SkybetEventCard";

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="border-b border-[var(--sky-blue-100)] bg-white py-6 dark:border-white/10 dark:bg-[var(--card)] sm:py-8"><div className="container"><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.06em] text-[var(--sky-navy-950)] sm:text-4xl dark:text-white">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-300">{description}</p></div></section>;
}

function EventRows({ events }: { events: SkybetEvent[] }) {
  const [, setLocation] = useLocation();
  return <div className="space-y-3">{events.map(event => <SkybetEventCard key={event.id} event={event} onMarketSelect={() => setLocation(`/event/${event.id}`)} />)}</div>;
}

export function LivePage() {
  const events = filterSkybetEvents(SKYBET_EVENTS, "live", "All");
  return <CustomerShell activeMobileNav="Live"><PageHeader eyebrow="Live board" title="Live events" description="A focused original Skybet board for previewing event states and match-card information." /><main className="container py-6 md:py-8"><div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-3 py-2 text-sm font-bold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Activity className="size-4" /> {events.length} live preview events</div><EventRows events={events} /></main></CustomerShell>;
}

export function SportsPage() {
  const events = filterSkybetEvents(SKYBET_EVENTS, "upcoming", "All");
  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Discover sports" title="Upcoming events" description="Browse original Skybet preview cards across football, tennis, virtuals, and future catalogue categories." /><main className="container py-6 md:py-8"><div className="mb-5 grid gap-3 sm:grid-cols-3">{["Football", "Tennis", "Virtuals"].map((sport, index) => <Card key={sport} className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-4"><Trophy className="size-5 text-[var(--sky-blue-600)]" /><p className="mt-4 font-extrabold text-[var(--sky-navy-950)] dark:text-white">{sport}</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">{index === 0 ? "Featured preview events" : "Catalogue preview"}</p></CardContent></Card>)}</div><EventRows events={events} /></main></CustomerShell>;
}

export function GamesPage() {
  const [, setLocation] = useLocation();
  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Provider sandbox" title="Games feed preview" description="This page demonstrates how normalized match data can render before a licensed provider integration is approved." /><main className="container py-6 md:py-8"><GamesFeedPreview onOpenEvent={event => setLocation(`/event/${event.id}`)} /><Card className="mt-5 border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white dark:border-white/10"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><Gamepad2 className="size-7 text-[var(--sky-blue-300)]" /><div><p className="font-extrabold">Simulated feed boundary</p><p className="mt-1 text-sm leading-6 text-slate-300">The automatic refresh is a client preview of a mock API. It is not a provider connection and does not accept wagers, deposits, or payouts.</p></div></CardContent></Card></main></CustomerShell>;
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SKYBET_EVENTS;
    return SKYBET_EVENTS.filter(event => [event.sport, event.competition, ...event.teams].join(" ").toLowerCase().includes(normalized));
  }, [query]);
  return <CustomerShell activeMobileNav="Sports"><PageHeader eyebrow="Catalogue search" title="Find an event" description="Search the Skybet preview catalogue by sport, competition, or team name." /><main className="container py-6 md:py-8"><div className="relative"><Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--sky-blue-600)]" /><Input autoFocus aria-label="Search Skybet events" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sport, competition, or team" className="h-13 rounded-2xl border-[var(--sky-blue-200)] bg-white pl-12 text-base dark:border-white/15 dark:bg-[var(--card)]" /></div><p className="mt-4 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">{results.length} matching preview event{results.length === 1 ? "" : "s"}</p><div className="mt-4 space-y-3">{results.map(event => <button key={event.id} type="button" onClick={() => setLocation(`/event/${event.id}`)} className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-[var(--sky-blue-100)] bg-white p-4 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:hover:bg-white/5"><span className={`size-2 rounded-full ${event.isLive ? "bg-[var(--sky-emerald-600)]" : "bg-[var(--sky-blue-500)]"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]} vs {event.teams[1]}</span><span className="block truncate text-xs text-[var(--sky-navy-600)] dark:text-slate-400">{event.competition}</span></span><span className="text-xs font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span></button>)}</div></main></CustomerShell>;
}

export function ActivityPage() {
  return <CustomerShell activeMobileNav="Rewards"><PageHeader eyebrow="My activity" title="Preview activity" description="Keep future saved selections, account updates, and safer-play actions visible in one original Skybet view." /><main className="container py-6 md:py-8"><div className="grid gap-4 md:grid-cols-2"><Card id="rewards" className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><ClipboardList className="size-6 text-[var(--sky-blue-600)]" /><h2 className="mt-4 text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">No saved preview selections</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Event selections remain local to the current preview. Referral-reward and account activity will be available once customer features are approved.</p></CardContent></Card><Card className="border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-white/5"><CardContent className="p-5"><ShieldCheck className="size-6 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]" /><h2 className="mt-4 text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">Account controls stay visible</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Use the account area to preview security, support, and safer-play choices.</p></CardContent></Card></div></main></CustomerShell>;
}

export function AccountPage() {
  const accountSections = [
    { id: "profile", icon: UserRound, title: "Profile", text: "Identity and preferences will be visible here after account onboarding." },
    { id: "safer-play", icon: ShieldCheck, title: "Safer play", text: "Limits, exclusion, and support pathways must be server-enforced before launch." },
    { id: "support", icon: CircleHelp, title: "Customer service", text: "For account and preview support, contact the Skybet customer-service team.", email: "Skybet0553@gmail.com" },
    { id: "preferences", icon: UserRound, title: "Preferences", text: "Personalisation choices are held for the approved account experience." },
  ];

  return <CustomerShell activeMobileNav="Account"><PageHeader eyebrow="Account centre" title="Your Skybet controls" description="A clear account preview with safety, identity, and support areas ready for approved integrations." /><main className="container py-6 md:py-8"><div className="grid gap-4 md:grid-cols-3">{accountSections.map(({ id, icon: Icon, title, text, email }) => <Card id={id} key={title} className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><Icon className="size-5" /></span><h2 className="mt-5 text-lg font-extrabold text-[var(--sky-navy-950)] dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{text}</p>{email ? <a href={`mailto:${email}`} aria-label="Email Skybet customer service" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 px-3 text-sm font-extrabold text-[var(--sky-emerald-700)] hover:bg-[var(--sky-emerald-600)]/15 dark:text-[var(--sky-emerald-500)]"><Mail className="size-4" />{email}</a> : null}</CardContent></Card>)}</div></main></CustomerShell>;
}

export function EventDetailPage() {
  const [, params] = useRoute("/event/:id");
  const [, setLocation] = useLocation();
  const [selection, setSelection] = useState<{ event: SkybetEvent; label: string; value: string } | null>(null);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const event = [...SKYBET_EVENTS, ...getMockGamesFeed().events].find(item => item.id === params?.id);
  if (!event) return <CustomerShell activeMobileNav="Sports"><main className="container py-12"><Card className="border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-7 text-center"><CalendarDays className="mx-auto size-7 text-[var(--sky-blue-600)]" /><h1 className="mt-4 text-xl font-extrabold">Preview event not found</h1><Button className="mt-5" onClick={() => setLocation("/sports")}>Browse events</Button></CardContent></Card></main></CustomerShell>;
  return <CustomerShell activeMobileNav={event.isLive ? "Live" : "Sports"}><PageHeader eyebrow={event.isLive ? "Live event preview" : "Event preview"} title={`${event.teams[0]} vs ${event.teams[1]}`} description={`${event.competition} · ${event.status}`} /><main className="container py-6 md:py-8"><Button variant="ghost" className="mb-5 -ml-3 font-bold text-[var(--sky-blue-700)]" onClick={() => setLocation(event.isLive ? "/live" : "/sports")}><ArrowLeft className="size-4" /> Return to event board</Button><Card className="overflow-hidden border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)]"><CardContent className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><Badge className="bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)]">{event.sport}</Badge><span className="text-sm font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{event.startsAt}</span></div><div className="mt-8 grid items-center gap-4 text-center sm:grid-cols-[1fr_auto_1fr]"><p className="text-xl font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[0]}</p><span className="rounded-xl bg-[var(--sky-navy-950)] px-4 py-2 text-lg font-extrabold text-white">{event.score ?? "VS"}</span><p className="text-xl font-extrabold text-[var(--sky-navy-950)] dark:text-white">{event.teams[1]}</p></div><div className="mt-8 grid gap-3 sm:grid-cols-3">{event.markets.map(market => <button key={market.label} type="button" onClick={() => { setSelection({ event, label: market.label, value: market.value }); setSelectionOpen(true); }} className="rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-4 text-left transition hover:border-[var(--sky-blue-300)] dark:border-white/10 dark:bg-white/5"><span className="block text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-400">{market.label}</span><span className="mt-2 block text-lg font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{market.value}</span></button>)}</div><div className="mt-6 rounded-xl bg-[var(--sky-emerald-600)]/10 p-4 text-sm leading-6 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">This is a non-transactional event preview. Skybet does not currently accept deposits, wagers, or payouts.</div></CardContent></Card></main><SelectionSheet open={selectionOpen} onOpenChange={setSelectionOpen} selection={selection} /></CustomerShell>;
}
