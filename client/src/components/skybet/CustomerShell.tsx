import { Moon, Search, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { MobileBottomNav } from "./MobileBottomNav";
import { CustomerAccountMenu } from "./CustomerAccountMenu";
import { SkybetBrandMark } from "./SkybetBrandMark";

const desktopLinks = [
  { label: "Sports", href: "/sports" },
  { label: "Live", href: "/live" },
  { label: "Games", href: "/games" },
  { label: "My activity", href: "/activity" },
];

const mobileRoutes: Record<string, string> = {
  Home: "/",
  Sports: "/sports",
  Live: "/live",
  Rewards: "/activity",
  Account: "/account",
};

type CustomerShellProps = {
  activeMobileNav: string;
  children: ReactNode;
};

export function CustomerShell({ activeMobileNav, children }: CustomerShellProps) {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-[var(--sky-white-50)] pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-[var(--sky-navy-950)] dark:bg-[var(--background)] dark:text-white md:pb-0">
      <header className="sticky top-0 z-40 border-b border-[var(--sky-blue-100)] bg-[color-mix(in_oklab,var(--sky-white-50)_94%,transparent)] backdrop-blur-xl dark:border-white/10 dark:bg-[color-mix(in_oklab,var(--background)_94%,transparent)]">
        <div className="container flex h-[4.5rem] items-center gap-3">
          <Link href="/"><SkybetBrandMark /></Link>
          <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {desktopLinks.map(item => <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--sky-navy-700)] transition hover:bg-[var(--sky-ice-100)] hover:text-[var(--sky-blue-700)] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">{item.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="size-10 rounded-xl text-[var(--sky-navy-700)] dark:text-slate-200" aria-label="Search SKYBET events" onClick={() => setLocation("/search")}><Search className="size-[18px]" /></Button>
            <Button variant="ghost" size="icon" className="hidden size-10 rounded-xl text-[var(--sky-navy-700)] sm:inline-flex dark:text-slate-200" aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>{theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</Button>
            <CustomerAccountMenu />
          </div>
        </div>
      </header>
      {children}
      <MobileBottomNav activeItem={activeMobileNav} onNavigate={label => setLocation(mobileRoutes[label] ?? "/")} />
    </div>
  );
}
