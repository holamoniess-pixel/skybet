import { RefreshCw, Search, UserRound } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type AdminUserSearchProps = {
  onSelectUser: (userId: number) => void;
};

export function AdminUserSearch({ onSelectUser }: AdminUserSearchProps) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | "user" | "admin">("user");
  const results = trpc.referrals.searchUsers.useQuery({ query, role });

  return (
    <div className="rounded-2xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-extrabold tracking-[0.12em] text-[var(--sky-blue-600)] uppercase">Find customer</p><p className="mt-1 text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Search existing Skybet account records before selecting a referral exception.</p></div><div className="flex rounded-xl border border-[var(--sky-blue-100)] bg-white p-1 dark:border-white/10 dark:bg-[var(--card)]">{(["user", "all", "admin"] as const).map(item => <button key={item} type="button" onClick={() => setRole(item)} className={`min-h-9 rounded-lg px-2.5 text-xs font-extrabold capitalize transition ${role === item ? "bg-[var(--sky-blue-600)] text-white" : "text-[var(--sky-navy-600)] hover:text-[var(--sky-blue-700)] dark:text-slate-300"}`}>{item === "user" ? "Customers" : item}</button>)}</div></div>
      <div className="relative mt-4"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--sky-blue-600)]" /><Input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search Skybet users" placeholder="Search name, email, or account ID" className="h-11 rounded-xl border-[var(--sky-blue-200)] bg-white pl-10 dark:border-white/15 dark:bg-[var(--card)]" /></div>
      <div className="mt-3 space-y-2" aria-live="polite">
        {results.isLoading ? <p className="text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Searching account records…</p> : null}
        {results.isError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><span>Account search is unavailable. Check the connection and try again.</span><button type="button" onClick={() => results.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-destructive/25 px-3 text-xs font-extrabold transition hover:bg-destructive/10"><RefreshCw className="size-3.5" /> Retry</button></div> : null}
        {!results.isLoading && !results.isError && results.data?.length === 0 ? <p className="text-sm text-[var(--sky-navy-600)] dark:text-slate-400">No eligible account records matched this search.</p> : null}
        {results.data?.slice(0, 5).map(user => <button key={user.id} type="button" onClick={() => onSelectUser(user.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--sky-blue-100)] bg-white p-3 text-left transition hover:border-[var(--sky-blue-300)] hover:bg-white dark:border-white/10 dark:bg-[var(--card)] dark:hover:bg-white/10"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--sky-ice-100)] text-[var(--sky-blue-700)]"><UserRound className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{user.name || "Unnamed account"}</span><span className="block truncate text-xs text-[var(--sky-navy-600)] dark:text-slate-400">#{user.id} · {user.email || user.openId}</span></span><Badge variant="outline" className="rounded-md border-[var(--sky-blue-200)] text-[10px] font-extrabold capitalize text-[var(--sky-blue-700)] dark:border-white/15 dark:text-[var(--sky-blue-300)]">{user.role}</Badge></button>)}
      </div>
    </div>
  );
}
