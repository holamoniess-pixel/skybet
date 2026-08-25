import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  CircleHelp,
  Compass,
  Gamepad2,
  Gift,
  LayoutGrid,
  Moon,
  ShieldCheck,
  Sun,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  filterSkybetEvents,
  formatSelection,
  SKYBET_EVENTS,
  SKYBET_SPORTS,
  type SkybetEvent,
  type SkybetMode,
} from "@shared/skybet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { AccountSheet } from "@/components/skybet/AccountSheet";
import { GamesFeedPreview } from "@/components/skybet/GamesFeedPreview";
import { MobileBottomNav } from "@/components/skybet/MobileBottomNav";
import { MobileMatchRail } from "@/components/skybet/MobileMatchRail";
import { SelectionSheet } from "@/components/skybet/SelectionSheet";
import { SkybetBrandMark } from "@/components/skybet/SkybetBrandMark";
import { SkybetEventCard } from "@/components/skybet/SkybetEventCard";

type Selection = {
  event: SkybetEvent;
  label: string;
  value: string;
};

const discoveryItems = [
  { label: "Live centre", icon: Activity, description: "Events happening now" },
  { label: "Today’s football", icon: Trophy, description: "Curated match cards" },
  { label: "Games hub", icon: Gamepad2, description: "Preview content lists" },
  { label: "Rewards", icon: Gift, description: "Referral progress" },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<SkybetMode>("live");
  const [sport, setSport] = useState("All");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [slipOpen, setSlipOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeMobileNav, setActiveMobileNav] = useState("Home");

  const events = useMemo(
    () => filterSkybetEvents(SKYBET_EVENTS, mode, sport),
    [mode, sport]
  );
  const liveEvents = useMemo(() => filterSkybetEvents(SKYBET_EVENTS, "live", "All"), []);

  const chooseSelection = (event: SkybetEvent, label: string, value: string) => {
    setSelection({ event, label, value });
    setSlipOpen(true);
  };

  const openFeedEvent = (event: SkybetEvent) => {
    setLocation(`/event/${event.id}`);
  };

  const handleMobileNavigation = (label: string) => {
    setActiveMobileNav(label);
    if (label === "Account") {
      setLocation("/account");
      return;
    }
    if (label === "Live") {
      setLocation("/live");
    }
    if (label === "Sports") {
      setLocation("/sports");
    }
    if (label === "Rewards") {
      setLocation("/activity");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--sky-white-50)] pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-[var(--sky-navy-950)] dark:bg-[var(--background)] dark:text-white md:pb-0">
      <header className="sticky top-0 z-40 border-b border-[var(--sky-blue-100)] bg-[color-mix(in_oklab,var(--sky-white-50)_94%,transparent)] backdrop-blur-xl dark:border-white/10 dark:bg-[color-mix(in_oklab,var(--background)_94%,transparent)]">
        <div className="container flex h-[4.5rem] items-center gap-3">
          <SkybetBrandMark />
          <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {["Sports", "Live", "Games", "My activity"].map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setLocation({ Sports: "/sports", Live: "/live", Games: "/games", "My activity": "/activity" }[item] ?? "/")}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--sky-navy-700)] transition hover:bg-[var(--sky-ice-100)] hover:text-[var(--sky-blue-700)] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-xl border-[var(--sky-blue-200)] text-[var(--sky-blue-700)] dark:border-white/15 dark:text-white"
              aria-label="Open account controls"
              onClick={() => setLocation("/account")}
            >
              <UserRound className="size-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-10 rounded-xl text-[var(--sky-navy-700)] sm:inline-flex dark:text-slate-200"
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </Button>
          </div>
        </div>
      </header>
      <MobileMatchRail liveEvents={liveEvents} onOpenLive={() => setLocation("/live")} />

      <main className="container py-5 md:py-8">
        <section className="sky-hero relative min-h-[19.5rem] overflow-hidden rounded-[1.75rem] border border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] px-5 py-6 shadow-[0_16px_50px_rgba(10,63,158,0.14)] dark:border-white/10 sm:min-h-[22rem] sm:rounded-[2rem] sm:px-8 sm:py-9">
          <img src="/manus-storage/skybet-live-match-hero_97d12259.png" alt="Illuminated football stadium for Skybet live match preview" className="absolute inset-0 size-full object-cover object-center opacity-75" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,19,51,0.98)_0%,rgba(3,19,51,0.87)_45%,rgba(3,19,51,0.18)_100%)]" aria-hidden="true" />
          <div className="relative max-w-xl">
            <Badge className="mb-4 rounded-full bg-[var(--sky-ice-100)] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[var(--sky-blue-700)] uppercase hover:bg-[var(--sky-ice-100)]">
              Match day preview
            </Badge>
            <h1 className="max-w-xl text-3xl font-extrabold tracking-[-0.06em] text-white sm:text-5xl">
              Your match day, in view.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">
              Live match states, virtual-game previews, and a clear route to the event board.
            </p>
            <div className="mt-5 flex">
              <Button
                className="h-12 rounded-xl bg-[var(--sky-blue-600)] px-5 font-bold text-white shadow-[0_10px_20px_rgba(15,87,199,0.2)] hover:bg-[var(--sky-blue-700)]"
                onClick={() => setLocation("/live")}
              >
                Open live board
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-1.5 border-t border-white/15 pt-4 sm:mt-7 sm:gap-2 sm:pt-5 lg:grid-cols-4">
            {discoveryItems.map(({ label, icon: Icon, description }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === "Live centre") setMode("live");
                  if (label === "Today’s football") {
                    setMode("upcoming");
                    setSport("Football");
                  }
                  if (label === "Rewards") toast.message("Referral rewards are planned for the secured Skybet release.");
                  if (label === "Games hub") document.getElementById("skybet-games-feed")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group flex min-h-14 items-center gap-2 rounded-xl px-2.5 text-left transition hover:bg-white/10 sm:gap-3 sm:rounded-2xl sm:px-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] transition group-hover:bg-[var(--sky-blue-600)] group-hover:text-white">
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-white">{label}</span>
                  <span className="block truncate text-xs text-slate-300">{description}</span>
                </span>
                <ChevronRight className="ml-auto size-4 text-[var(--sky-blue-400)]" />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] p-3 shadow-[0_12px_28px_rgba(6,26,59,0.18)] dark:border-white/10">
          <form
            className="flex gap-2"
            onSubmit={event => {
              event.preventDefault();
              toast.message("Event-code lookup will be enabled with the approved catalogue integration.");
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Ticket className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--sky-blue-300)]" />
              <input
                aria-label="Enter an event code"
                placeholder="Enter an event code"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/8 pr-3 pl-10 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[var(--sky-blue-400)] focus:ring-2 focus:ring-[var(--sky-blue-400)]/25"
              />
            </div>
            <Button type="submit" className="h-11 rounded-xl bg-[var(--sky-emerald-600)] px-4 font-extrabold text-white hover:bg-[var(--sky-emerald-700)]">
              Load
            </Button>
          </form>
        </section>

        <section className="mt-5 -mr-4 overflow-x-auto pb-1 pr-4 sm:mr-0 sm:pr-0" aria-label="Skybet quick filters">
          <div className="flex w-max gap-2">
            {SKYBET_SPORTS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setSport(item)}
                className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition ${
                  sport === item
                    ? "border-[var(--sky-blue-600)] bg-[var(--sky-blue-600)] text-white shadow-[0_8px_18px_rgba(15,87,199,0.18)]"
                    : "border-[var(--sky-blue-100)] bg-white text-[var(--sky-navy-700)] hover:border-[var(--sky-blue-300)] hover:bg-[var(--sky-ice-50)] dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200 dark:hover:bg-white/5"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div id="skybet-games-feed" className="scroll-mt-28">
          <GamesFeedPreview onOpenEvent={openFeedEvent} />
        </div>

        <section className="mt-6 grid items-start gap-5 xl:mt-7 xl:grid-cols-[13rem_minmax(0,1fr)_20rem]" id="skybet-events">
          <aside className="hidden rounded-2xl border border-[var(--sky-blue-100)] bg-white p-3 shadow-[0_10px_26px_rgba(10,63,158,0.05)] xl:block dark:border-white/10 dark:bg-[var(--card)]">
            <p className="px-2 text-xs font-extrabold tracking-[0.12em] text-[var(--sky-navy-500)] uppercase dark:text-slate-400">Browse sport</p>
            <div className="mt-2 space-y-1">
              {SKYBET_SPORTS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSport(item)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition ${
                    sport === item
                      ? "bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] dark:bg-white/10 dark:text-white"
                      : "text-[var(--sky-navy-700)] hover:bg-[var(--sky-ice-50)] dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  <Compass className="size-4" />
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 dark:border-white/10 dark:bg-white/5">
              <ShieldCheck className="size-5 text-[var(--sky-emerald-700)]" />
              <p className="mt-2 text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Play with clarity</p>
              <p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Account controls are always available from your Skybet profile.</p>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Match board</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">
                  {mode === "live" ? "Live centre" : "Upcoming events"}
                </h2>
              </div>
              <div className="flex rounded-xl border border-[var(--sky-blue-100)] bg-white p-1 dark:border-white/10 dark:bg-[var(--card)]">
                {(["live", "upcoming"] as const).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-bold capitalize transition ${
                      mode === item
                        ? "bg-[var(--sky-blue-600)] text-white shadow-sm"
                        : "text-[var(--sky-navy-600)] hover:text-[var(--sky-blue-700)] dark:text-slate-300 dark:hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {events.length > 0 ? (
                events.map(event => (
                  <SkybetEventCard
                    key={event.id}
                    event={event}
                    selectedMarket={selection?.event.id === event.id ? selection.label : undefined}
                    onMarketSelect={chooseSelection}
                  />
                ))
              ) : (
                <Card className="border-dashed border-[var(--sky-blue-200)] bg-white dark:border-white/15 dark:bg-[var(--card)]">
                  <CardContent className="p-7 text-center">
                    <LayoutGrid className="mx-auto size-7 text-[var(--sky-blue-500)]" />
                    <h3 className="mt-3 font-extrabold text-[var(--sky-navy-950)] dark:text-white">No events in this view</h3>
                    <p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Choose another sport or view upcoming events.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <aside className="hidden rounded-2xl border border-[var(--sky-blue-100)] bg-white p-4 shadow-[0_10px_26px_rgba(10,63,158,0.05)] xl:block dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Your selection</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-[-0.04em] text-[var(--sky-navy-950)] dark:text-white">Selection panel</h2>
              </div>
              <Ticket className="size-5 text-[var(--sky-blue-500)]" />
            </div>
            {selection ? (
              <div className="mt-5 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-400">{selection.event.competition}</p>
                <p className="mt-2 text-sm font-extrabold leading-5 text-[var(--sky-navy-950)] dark:text-white">{formatSelection(selection.event, selection.label)}</p>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--sky-blue-100)] pt-3 text-sm dark:border-white/10">
                  <span className="font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Market value</span>
                  <span className="font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{selection.value}</span>
                </div>
                <Button className="mt-4 h-10 w-full rounded-xl bg-[var(--sky-blue-600)] font-bold hover:bg-[var(--sky-blue-700)]" onClick={() => setSlipOpen(true)}>
                  Review selection
                </Button>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-[var(--sky-blue-200)] p-5 text-center dark:border-white/15">
                <Ticket className="mx-auto size-6 text-[var(--sky-blue-400)]" />
                <p className="mt-3 text-sm font-bold text-[var(--sky-navy-950)] dark:text-white">No selections yet</p>
                <p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Choose an event option to review its preview details.</p>
              </div>
            )}
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--sky-emerald-600)]/10 p-3 text-xs leading-5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              This interface does not accept deposits, wagers, or payouts.
            </div>
          </aside>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-[1.35fr_1fr]">
          <Card className="border-[var(--sky-blue-100)] bg-white shadow-[0_10px_24px_rgba(10,63,158,0.05)] dark:border-white/10 dark:bg-[var(--card)]">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--sky-emerald-600)]/10 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">Your Skybet controls should stay close.</p>
                <p className="mt-1 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Manage account security, safe-play preferences, and support from one straightforward place.</p>
              </div>
              <Button variant="outline" className="h-11 shrink-0 rounded-xl border-[var(--sky-emerald-600)]/30 font-bold text-[var(--sky-emerald-700)] hover:bg-[var(--sky-emerald-600)]/10 dark:text-[var(--sky-emerald-500)]" onClick={() => setAccountOpen(true)}>
                View controls
              </Button>
            </CardContent>
          </Card>
          <Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white shadow-[0_10px_24px_rgba(6,26,59,0.16)] dark:border-white/10">
            <CardContent className="flex h-full items-center gap-4 p-5 sm:p-6">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[var(--sky-blue-300)]"><CircleHelp className="size-5" /></div>
              <div>
                <p className="text-sm font-extrabold">Need a hand?</p>
                <button type="button" onClick={() => toast.message("Support channels will be connected after compliance approval.")} className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--sky-blue-300)] hover:text-white">
                  Visit the Skybet help centre <ChevronRight className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <MobileBottomNav activeItem={activeMobileNav} onNavigate={handleMobileNavigation} />
      <SelectionSheet open={slipOpen} onOpenChange={setSlipOpen} selection={selection} />
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}
