import { Activity, Gift, Home, Trophy, UserRound } from "lucide-react";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Sports", icon: Trophy },
  { label: "Live", icon: Activity },
  { label: "Rewards", icon: Gift },
  { label: "Account", icon: UserRound },
];

type MobileBottomNavProps = {
  activeItem: string;
  onNavigate: (label: string) => void;
};

export function MobileBottomNav({ activeItem, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--sky-blue-100)] bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/10 dark:bg-[var(--card)]/95 md:hidden" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {navItems.map(({ label, icon: Icon }) => {
          const active = activeItem === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-extrabold transition ${active ? "text-[var(--sky-blue-700)]" : "text-[var(--sky-navy-500)] dark:text-slate-400"}`}
            >
              <span className={`grid size-7 place-items-center rounded-lg ${active ? "bg-[var(--sky-ice-100)]" : ""}`}>
                <Icon className="size-[17px]" />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
