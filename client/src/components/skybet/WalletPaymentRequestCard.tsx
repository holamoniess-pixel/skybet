import { ChangeEvent, useMemo, useState } from "react";
import { CheckCircle2, Copy, FileImage, Landmark, ShieldCheck, Smartphone, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { DEPOSIT_PRESET_AMOUNTS } from "@shared/payments";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

type UploadProof = { mimeType: "image/jpeg" | "image/png"; dataUrl: string } | null;

const TRC20_WALLET_ADDRESS = "TQCHL828z5VyKGRkw3jUThrURnG9tpsS6G";

export function WalletPaymentRequestCard() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"deposit" | "withdrawal">("deposit");
  const [method, setMethod] = useState<"crypto_trc20" | "aquapay">("crypto_trc20");
  const [amount, setAmount] = useState("200");
  const [reference, setReference] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [proof, setProof] = useState<UploadProof>(null);
  const methods = trpc.payments.methods.useQuery(undefined, { enabled: isAuthenticated });
  const gatewayStatus = trpc.payments.gatewayStatus.useQuery(undefined, { enabled: isAuthenticated });
  const requests = trpc.payments.myRequests.useQuery(undefined, { enabled: isAuthenticated });
  const availableDepositMethods = useMemo(() => methods.data?.filter(item => item.status === "enabled") ?? [], [methods.data]);
  const selectedMethod = methods.data?.find(item => item.method === method);
  const cryptoMethod = methods.data?.find(item => item.method === "crypto_trc20");
  const walletAddress = cryptoMethod?.destination ?? TRC20_WALLET_ADDRESS;
  const walletNetwork = cryptoMethod?.network ?? "TRC20";

  const submitDeposit = trpc.payments.submitDeposit.useMutation({
    onSuccess: request => {
      toast.success(`Deposit request ${request.publicReference} submitted for review.`);
      setReference("");
      setProof(null);
      utils.payments.myRequests.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const submitWithdrawal = trpc.payments.submitWithdrawal.useMutation({
    onSuccess: request => {
      toast.success(`Mobile Money withdrawal request ${request.publicReference} submitted for review.`);
      setMobileMoneyNumber("");
      utils.payments.myRequests.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const selectMode = (next: "deposit" | "withdrawal") => {
    setMode(next);
    setAmount(next === "withdrawal" ? "" : "200");
  };
  const onProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use a PNG or JPEG screenshot of 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof({ mimeType: file.type as "image/jpeg" | "image/png", dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success("TRC20 address copied.");
    } catch {
      toast.error("Copy is not available in this browser. Please copy the address manually.");
    }
  };
  const submit = () => {
    if (!isAuthenticated) return toast.error("Sign in before creating a payment request.");
    if (mode === "deposit") {
      if (!proof) return toast.error("Upload a payment screenshot before submitting a deposit request.");
      submitDeposit.mutate({ method, amount, customerPaymentReference: reference, proof });
      return;
    }
    submitWithdrawal.mutate({ amount, mobileMoneyNumber });
  };

  const pendingGateway = gatewayStatus.data?.status !== "awaiting_contract";
  const submitDisabled = mode === "deposit" ? submitDeposit.isPending || availableDepositMethods.length === 0 : submitWithdrawal.isPending;

  return (
    <div className="mt-5 space-y-5">
      <div className="flex gap-2">
        <Button type="button" onClick={() => selectMode("deposit")} className={mode === "deposit" ? "h-10 rounded-xl bg-[var(--sky-blue-600)] px-4 text-xs font-extrabold hover:bg-[var(--sky-blue-700)]" : "h-10 rounded-xl bg-[var(--sky-ice-50)] px-4 text-xs font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)] dark:bg-white/5 dark:text-[var(--sky-blue-300)]"}>
          <WalletCards className="mr-1.5 size-3.5" />Deposit
        </Button>
        <Button type="button" onClick={() => selectMode("withdrawal")} className={mode === "withdrawal" ? "h-10 rounded-xl bg-[var(--sky-blue-600)] px-4 text-xs font-extrabold hover:bg-[var(--sky-blue-700)]" : "h-10 rounded-xl bg-[var(--sky-ice-50)] px-4 text-xs font-extrabold text-[var(--sky-blue-700)] hover:bg-[var(--sky-ice-100)] dark:bg-white/5 dark:text-[var(--sky-blue-300)]"}>
          <Landmark className="mr-1.5 size-3.5" />Withdraw
        </Button>
      </div>

      {!isAuthenticated ? <div className="rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-4 text-sm leading-6 text-[var(--sky-navy-700)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">Sign in to continue with your payment request.</div> : null}

      {isAuthenticated && mode === "withdrawal" ? <div className="space-y-5">
        <div className="rounded-xl border border-[var(--sky-blue-100)] bg-[var(--sky-ice-50)] p-4 dark:border-white/10 dark:bg-white/5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--sky-blue-600)] text-white"><Smartphone className="size-5" /></span><div><p className="font-extrabold text-[var(--sky-navy-950)] dark:text-white">Mobile Money withdrawal</p><p className="mt-1 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Enter the Ghana Mobile Money number that should receive your approved payout. No screenshot or crypto withdrawal method is required.</p></div></div></div>
        <div className="space-y-2"><Label htmlFor="withdraw-amount">Withdrawal amount (GHS)</Label><Input id="withdraw-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Enter amount" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div>
        <div className="space-y-2"><Label htmlFor="mobile-money-number">Mobile Money number</Label><Input id="mobile-money-number" inputMode="tel" autoComplete="tel" value={mobileMoneyNumber} onChange={event => setMobileMoneyNumber(event.target.value)} placeholder="024 123 4567 or +233 24 123 4567" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /><p className="text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">Use a valid Ghana Mobile Money number. Your request will be reviewed before payout.</p></div>
        <Button type="button" disabled={submitDisabled} onClick={submit} className="h-12 w-full rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]">{submitWithdrawal.isPending ? "Submitting…" : "Submit Mobile Money withdrawal request"}</Button>
      </div> : null}

      {isAuthenticated && mode === "deposit" ? <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {methods.data?.map(item => <button key={item.method} type="button" disabled={item.status !== "enabled"} onClick={() => setMethod(item.method)} className={`rounded-xl border p-3 text-left transition ${method === item.method ? "border-[var(--sky-blue-600)] bg-[var(--sky-ice-50)]" : "border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-white/5"} ${item.status !== "enabled" ? "cursor-not-allowed opacity-55" : "hover:border-[var(--sky-blue-400)]"}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-extrabold text-[var(--sky-navy-950)] dark:text-white">{item.method === "aquapay" ? "Automatic Mobile Money" : item.displayName}</span><Badge className={item.status === "enabled" ? "bg-[var(--sky-emerald-600)] hover:bg-[var(--sky-emerald-600)]" : "bg-slate-400 hover:bg-slate-400"}>{item.status === "enabled" ? "Available" : "Coming soon"}</Badge></div><p className="mt-2 text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400">{item.method === "crypto_trc20" ? "Send USDT on the TRC20 network, then upload your payment screenshot for review." : pendingGateway ? "Automatic Mobile Money deposits for supported networks are coming soon." : "Automatic Mobile Money deposits for supported networks are coming soon."}</p></button>)}
        </div>
        {method === "crypto_trc20" ? <div className="rounded-xl border border-[var(--sky-emerald-600)]/25 bg-[var(--sky-emerald-600)]/10 p-4"><p className="text-xs font-extrabold tracking-[0.1em] text-[var(--sky-emerald-700)] uppercase">Crypto wallet address</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><code className="break-all text-sm font-bold text-[var(--sky-navy-950)] dark:text-white">{walletAddress}</code><Button type="button" variant="outline" onClick={copyAddress} aria-label="Copy TRC20 wallet address" className="h-9 shrink-0 rounded-lg border-[var(--sky-emerald-600)]/30 text-xs font-extrabold text-[var(--sky-emerald-700)]"><Copy className="mr-1.5 size-3.5" />Copy address</Button></div><p className="mt-2 text-xs leading-5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]">Network: {walletNetwork}. Send only USDT over the TRC20 network.</p></div> : null}
        <div><Label className="font-bold text-[var(--sky-navy-950)] dark:text-white">Select GHS request amount</Label><div className="mt-2 flex flex-wrap gap-2">{DEPOSIT_PRESET_AMOUNTS.map(value => <Button key={value} type="button" variant={amount === String(value) ? "default" : "outline"} onClick={() => setAmount(String(value))} className={amount === String(value) ? "h-10 rounded-lg bg-[var(--sky-blue-600)] px-3 text-xs font-extrabold" : "h-10 rounded-lg border-[var(--sky-blue-200)] px-3 text-xs font-extrabold text-[var(--sky-blue-700)]"}>GH₵ {value.toLocaleString()}</Button>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="payment-reference">Your transfer reference</Label><Input id="payment-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="Transaction ID or reference" className="h-11 rounded-xl border-[var(--sky-blue-200)] dark:border-white/15 dark:bg-white/5" /></div><div className="space-y-2"><Label htmlFor="payment-proof">Payment screenshot</Label><div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--sky-blue-200)] px-3 dark:border-white/15"><FileImage className="size-4 text-[var(--sky-blue-700)]" /><input id="payment-proof" type="file" accept="image/png,image/jpeg" onChange={onProofChange} className="min-w-0 text-xs" /></div></div></div>
        {proof ? <p className="flex items-center gap-2 text-xs text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><CheckCircle2 className="size-4" />Screenshot ready for upload.</p> : null}
        <Button type="button" disabled={submitDisabled} onClick={submit} className="h-12 w-full rounded-xl bg-[var(--sky-blue-600)] font-extrabold hover:bg-[var(--sky-blue-700)]">{submitDeposit.isPending ? "Submitting…" : "Submit deposit request for review"}</Button>
      </div> : null}

      <div className="flex items-start gap-2 rounded-xl bg-[var(--sky-emerald-600)]/10 p-3 text-xs leading-5 text-[var(--sky-emerald-700)] dark:text-[var(--sky-emerald-500)]"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Payment status and balance updates follow the review outcome.</div>
      {requests.data?.length ? <div className="border-t border-[var(--sky-blue-100)] pt-4 dark:border-white/10"><p className="text-xs font-extrabold tracking-[0.1em] text-[var(--sky-blue-600)] uppercase">Recent requests</p><div className="mt-3 space-y-2">{requests.data.slice(0, 5).map(request => <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--sky-ice-50)] px-3 py-2 text-xs dark:bg-white/5"><span className="font-bold text-[var(--sky-navy-950)] dark:text-white">{request.publicReference} · GH₵ {Number(request.amount).toFixed(2)}</span><span className="capitalize text-[var(--sky-navy-600)] dark:text-slate-300">{request.status.replace("_", " ")}</span></div>)}</div></div> : null}
    </div>
  );
}
