import { CreditCard, History, Landmark, ListChecks, LogIn, LogOut, Settings2, UserRound, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { CustomerAuthDialog } from "@/components/CustomerAuthDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CustomerAccountMenuProps = {
  compact?: boolean;
};

export function CustomerAccountMenu({ compact = false }: CustomerAccountMenuProps) {
  const [, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const accountName = user?.name || "SKYBET member";

  const goTo = (path: string) => setLocation(path);

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button type="button" className="sky-preview-wallet-account" aria-label="Open account menu" disabled={loading}>
            <UserRound className="size-[18px]" />
          </button>
        ) : (
          <Button variant="outline" className="hidden h-10 rounded-xl border-[var(--sky-blue-200)] px-3 font-bold text-[var(--sky-blue-700)] md:inline-flex dark:border-white/15 dark:text-white" disabled={loading}>
            <UserRound className="size-4" />{user ? accountName : "Account"}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl border-[var(--sky-blue-100)] bg-[var(--sky-white-50)] p-2 shadow-[0_18px_44px_rgba(6,26,59,0.18)] dark:border-white/10 dark:bg-[var(--card)]">
        <DropdownMenuLabel className="px-2 py-2">
          <p className="text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{user ? accountName : "Welcome to SKYBET"}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--sky-navy-600)] dark:text-slate-400">{user?.email || "Sign in to manage your account"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--sky-blue-100)] dark:bg-white/10" />
        {!user ? <>
          <DropdownMenuItem onSelect={() => setAuthOpen(true)} className="min-h-10 rounded-xl font-bold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"><LogIn className="size-4" />Sign in</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAuthOpen(true)} className="min-h-10 rounded-xl font-bold text-[var(--sky-blue-700)] dark:text-[var(--sky-blue-300)]"><UserRound className="size-4" />Create account</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--sky-blue-100)] dark:bg-white/10" />
        </> : null}
        <DropdownMenuItem onSelect={() => goTo("/profile")} className="min-h-10 rounded-xl font-semibold"><UserRound className="size-4" />Profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/settings")} className="min-h-10 rounded-xl font-semibold"><Settings2 className="size-4" />Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/bets")} className="min-h-10 rounded-xl font-semibold"><ListChecks className="size-4" />Bets list</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/bets/running")} className="min-h-10 rounded-xl font-semibold"><History className="size-4" />Running bets</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/bets/history")} className="min-h-10 rounded-xl font-semibold"><History className="size-4" />Bet history</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--sky-blue-100)] dark:bg-white/10" />
        <DropdownMenuItem onSelect={() => goTo("/wallet#deposit")} className="min-h-10 rounded-xl font-extrabold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><WalletCards className="size-4" />Deposit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/wallet#withdraw")} className="min-h-10 rounded-xl font-extrabold text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><Landmark className="size-4" />Withdraw</DropdownMenuItem>
        <p className="px-2 py-2 text-[11px] leading-4 text-[var(--sky-navy-600)] dark:text-slate-400"><CreditCard className="mr-1 inline size-3.5" />Manage your payment options from your account.</p>
        {user ? <>
          <DropdownMenuSeparator className="bg-[var(--sky-blue-100)] dark:bg-white/10" />
          <DropdownMenuItem onSelect={() => void logout()} variant="destructive" className="min-h-10 rounded-xl font-bold"><LogOut className="size-4" />Log out</DropdownMenuItem>
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
      <CustomerAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
