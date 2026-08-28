import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ChevronLeft,
  ArrowRight,
  ChevronRight,
  CircleHelp,
  Compass,
  Gamepad2,
  Gift,
  LayoutGrid,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  Ticket,
  Trophy,
} from "lucide-react";
import {
  filterSkybetEvents,
  findSkybetEventByPreviewCode,
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
import { CustomerAccountMenu } from "@/components/skybet/CustomerAccountMenu";
import { GamesFeedPreview } from "@/components/skybet/GamesFeedPreview";
import { MobileBottomNav } from "@/components/skybet/MobileBottomNav";
import { MobileMatchRail } from "@/components/skybet/MobileMatchRail";
import { PreviewSlipFab } from "@/components/skybet/PreviewSlipFab";
import { SelectionSheet } from "@/components/skybet/SelectionSheet";
import { SkybetBrandMark } from "@/components/skybet/SkybetBrandMark";
import { SkybetEventCard } from "@/components/skybet/SkybetEventCard";

type Selection = {
  event: SkybetEvent;
  label: string;
  value: string;
};

const discoveryItems = [
  { label: "Live centre", icon: Activity, description: "Events happening now", href: "/live" },
  { label: "Today’s football", icon: Trophy, description: "Curated match cards", href: "/sports" },
  { label: "Games hub", icon: Gamepad2, description: "Preview content lists", href: "/games" },
  { label: "Rewards", icon: Gift, description: "Referral progress", href: "/activity#rewards" },
];

const heroSlides = [
  { src: "/manus-storage/skybet-live-match-hero_97d12259.png", position: "object-center" },
  { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663566567757/a2XEPPgreLmSs8S3Uu5nPF/skybet-hero-rotation-01-fCqUHQP59xAaAspgYvGJHN.webp", position: "object-center" },
  { src: "/manus-storage/skybet-live-match-hero_97d12259.png", position: "object-[62%_center]" },
  { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663566567757/a2XEPPgreLmSs8S3Uu5nPF/skybet-hero-rotation-01-fCqUHQP59xAaAspgYvGJHN.webp", position: "object-[70%_center]" },
  { src: "/manus-storage/skybet-live-match-hero_97d12259.png", position: "object-[42%_center]" },
  { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663566567757/a2XEPPgreLmSs8S3Uu5nPF/skybet-hero-rotation-01-fCqUHQP59xAaAspgYvGJHN.webp", position: "object-[80%_center]" },
  { src: "/manus-storage/skybet-live-match-hero_97d12259.png", position: "object-[78%_center]" },
  { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663566567757/a2XEPPgreLmSs8S3Uu5nPF/skybet-hero-rotation-01-fCqUHQP59xAaAspgYvGJHN.webp", position: "object-[58%_center]" },
  { src: "/manus-storage/skybet-live-match-hero_97d12259.png", position: "object-[55%_center]" },
  { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663566567757/a2XEPPgreLmSs8S3Uu5nPF/skybet-hero-rotation-01-fCqUHQP59xAaAspgYvGJHN.webp", position: "object-[88%_center]" },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<SkybetMode>("live");
  const [sport, setSport] = useState("All");
  const [selections, setSelections] = useState<Selection[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("skybet-preview-slip") ?? "[]") as Selection[]; } catch { return []; }
  });
  const [slipOpen, setSlipOpen] = useState(false);
  const [activeMobileNav, setActiveMobileNav] = useState("Home");
  const [eventCodeMessage, setEventCodeMessage] = useState("");
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setHeroSlide(current => (current + 1) % heroSlides.length), 4500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("skybet-preview-slip", JSON.stringify(selections));
  }, [selections]);

  const events = useMemo(
    () => filterSkybetEvents(SKYBET_EVENTS, mode, sport),
    [mode, sport]
  );

  const chooseSelection = (event: SkybetEvent, label: string, value: string) => {
    setSelections(current => [...current.filter(item => item.event.id !== event.id), { event, label, value }]);
    setSlipOpen(true);
  };

  const removeSelection = (eventId: string, label: string) => setSelections(current => current.filter(item => !(item.event.id === eventId && item.label === label)));
  const clearSelections = () => setSelections([]);

  const handleEventCodeLookup = (code: string) => {
    const normalizedCode = code.trim().toLowerCase();
    if (!normalizedCode) {
      setEventCodeMessage("Enter an authored preview code, for example SKY-LIVE-01.");
      return;
    }

    const event = findSkybetEventByPreviewCode(SKYBET_EVENTS, normalizedCode);
    if (!event) {
      setEventCodeMessage(`No preview event was found for “${code.trim()}”. Try SKY-LIVE-01.`);
      return;
    }

    const market = event.markets[0];
    chooseSelection(event, market.label, market.value);
    setEventCodeMessage(`Loaded ${event.teams[0]} into your local Preview slip. No real-money action occurs.`);
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

  const handleMobileDiscovery = (item: "All" | "Live" | "Football" | "Basketball" | "Tennis" | "Virtuals") => {
    if (item === "Live") {
      setLocation("/live");
      return;
    }
    setMode("upcoming");
    setSport(item);
    document.getElementById("skybet-events")?.scrollIntoView?.({ behavior: "smooth" });
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
            <div className="sky-preview-wallet">
              <button type="button" aria-label="Preview balance" onClick={() => setLocation("/account")} className="sky-preview-wallet-balance">
                <span className="sky-preview-wallet-amount">GH₵ 0.00</span>
                <span className="sky-preview-wallet-bonus">Bonus: GH₵ 0.00</span>
              </button>
              <CustomerAccountMenu compact />
            </div>
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
      <MobileMatchRail onSelect={handleMobileDiscovery} />

      <main className="container py-5 md:py-8">
        <section className="sky-hero relative min-h-[16.75rem] overflow-hidden rounded-[1.5rem] border border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] px-4 py-4 shadow-[0_16px_50px_rgba(10,63,158,0.14)] dark:border-white/10 sm:min-h-[22rem] sm:rounded-[2rem] sm:px-8 sm:py-9">
          <div className="absolute inset-0" aria-hidden="true">
            {heroSlides.map((slide, index) => <img key={`${slide.src}-${index}`} src={slide.src} alt="" className={`absolute inset-0 size-full object-cover ${slide.position} sky-hero-slide ${index === heroSlide ? "sky-hero-slide-active" : ""}`} />)}
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,19,51,0.98)_0%,rgba(3,19,51,0.87)_45%,rgba(3,19,51,0.18)_100%)]" aria-hidden="true" />
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-white/15 bg-[rgba(3,19,51,0.58)] p-1 backdrop-blur-sm sm:top-5 sm:right-5">
            <button type="button" aria-label="Previous hero image" onClick={() => setHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)} className="grid size-8 place-items-center rounded-full text-white transition hover:bg-white/15 focus-visible:bg-white/15"><ChevronLeft className="size-4" /></button>
            <span aria-live="polite" className="min-w-11 text-center text-[10px] font-extrabold tabular-nums text-white">{heroSlide + 1}/{heroSlides.length}</span>
            <button type="button" aria-label="Next hero image" onClick={() => setHeroSlide(current => (current + 1) % heroSlides.length)} className="grid size-8 place-items-center rounded-full text-white transition hover:bg-white/15 focus-visible:bg-white/15"><ChevronRight className="size-4" /></button>
          </div>
          <div className="relative max-w-xl">
            <Badge className="mb-2 rounded-full bg-[var(--sky-ice-100)] px-3 py-1 text-[10px] font-extrabold tracking-[0.12em] text-[var(--sky-blue-700)] uppercase hover:bg-[var(--sky-ice-100)] sm:mb-4 sm:text-[11px]">
              Match day preview
            </Badge>
            <h1 className="max-w-xl text-2xl font-extrabold tracking-[-0.06em] text-white sm:text-5xl">
              Your match day, in view.
            </h1>
            <p className="mt-2 max-w-md text-[13px] leading-5 text-slate-200 sm:mt-3 sm:text-base sm:leading-7">
              Live match states, virtual-game previews, and a clear route to the event board.
            </p>
            <div className="mt-3 flex sm:mt-5">
              <Button
                className="h-10 rounded-xl bg-[var(--sky-blue-600)] px-4 text-sm font-bold text-white shadow-[0_10px_20px_rgba(15,87,199,0.2)] hover:bg-[var(--sky-blue-700)] sm:h-12 sm:px-5 sm:text-base"
                onClick={() => setLocation("/live")}
              >
                Open live board
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-4 gap-1 border-t border-white/15 pt-2.5 sm:mt-7 sm:gap-2 sm:pt-5">
            {discoveryItems.map(({ label, icon: Icon, description, href }) => (
              <button
                key={label}
                type="button"
                onClick={() => setLocation(href)}
                className="group flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center transition hover:bg-white/10 sm:min-h-14 sm:flex-row sm:justify-start sm:gap-3 sm:rounded-2xl sm:px-3 sm:text-left"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)] transition group-hover:bg-[var(--sky-blue-600)] group-hover:text-white">
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-white sm:text-sm">{label}</span>
                  <span className="hidden truncate text-xs text-slate-300 sm:block">{description}</span>
                </span>
                <ChevronRight className="ml-auto hidden size-4 text-[var(--sky-blue-400)] sm:block" />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 -mr-4 overflow-x-auto pb-1 pr-4 sm:mr-0 sm:pr-0" aria-label="SKYBET quick filters">
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
          <GamesFeedPreview />
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
              <p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Account controls are always available from your SKYBET profile.</p>
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

            <div className="mt-3 space-y-2">
              {events.length > 0 ? (
                events.map(event => (
                  <SkybetEventCard
                    key={event.id}
                    event={event}
                    selectedMarket={selections.find(item => item.event.id === event.id)?.label}
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
            {selections.length ? (
              <div className="mt-5 rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-bold text-[var(--sky-navy-600)] dark:text-slate-400">{selections.length} selection{selections.length === 1 ? "" : "s"}</p>
                <p className="mt-2 text-sm font-extrabold leading-5 text-[var(--sky-navy-950)] dark:text-white">{formatSelection(selections[0].event, selections[0].label)}{selections.length > 1 ? ` + ${selections.length - 1} more` : ""}</p>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--sky-blue-100)] pt-3 text-sm dark:border-white/10">
                  <span className="font-semibold text-[var(--sky-navy-600)] dark:text-slate-400">Market value</span>
                  <span className="font-extrabold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]">{selections.reduce((total, item) => total * Number(item.value), 1).toFixed(2)}</span>
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

        <section className="mt-6">
          <Card className="border-[var(--sky-blue-100)] bg-[var(--sky-navy-950)] text-white shadow-[0_10px_24px_rgba(6,26,59,0.16)] dark:border-white/10">
            <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[var(--sky-blue-300)]"><CircleHelp className="size-5" /></div>
              <div>
                <p className="text-sm font-extrabold">Need a hand?</p>
                <a href="mailto:Skybet0553@gmail.com" aria-label="Email SKYBET customer service" className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--sky-emerald-500)] hover:text-white">
                  <Mail className="size-4" /> Skybet0553@gmail.com
                </a>
                <button type="button" onClick={() => setLocation("/account#support")} className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--sky-blue-300)] hover:text-white">
                  Visit the SKYBET help centre <ChevronRight className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <PreviewSlipFab selection={selections[0] ?? null} selectionCount={selections.length} onOpen={() => setSlipOpen(true)} />
      <MobileBottomNav activeItem={activeMobileNav} onNavigate={handleMobileNavigation} />
      <SelectionSheet open={slipOpen} onOpenChange={setSlipOpen} selection={selections[0] ?? null} selections={selections} onRemoveSelection={removeSelection} onClearSelections={clearSelections} onLoadCode={handleEventCodeLookup} codeMessage={eventCodeMessage} />
    </div>
  );
}
