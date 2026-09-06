import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { affiliate } from '../utils/api';
import type {
  AffiliateStatsDTO,
  ReferredUserDTO,
  ReferralLink,
  AffiliateWithdrawalRequest,
  WithdrawalRequestDTO,
  AccountDetailsDTO,
} from '../utils/api';

interface AffiliateBalance {
  balance: number;
  currency: string;
}

import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ShareIcon from '@mui/icons-material/Share';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddLinkIcon from '@mui/icons-material/AddLink';
import CircularProgress from '@mui/icons-material/Loop';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// ---------------------------------------------------------------------------
// Button primitives
// ---------------------------------------------------------------------------

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Primary — filled, brand colour. Use for the single most important action per region.
 */
function BtnPrimary({ children, loading, icon, size = 'md', className = '', disabled, ...rest }: BtnProps) {
  const sz = size === 'sm'
    ? 'px-3 py-1.5 text-xs rounded-lg'
    : 'px-4 py-2.5 text-sm rounded-xl';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold',
        'bg-primary text-white',
        'hover:brightness-90 active:scale-[0.97]',
        'transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        sz,
        className,
      ].join(' ')}
    >
      {loading
        ? <CircularProgress fontSize="small" className="animate-spin shrink-0" />
        : icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

/**
 * Ghost — outlined, no fill. Use for secondary / cancel actions.
 */
function BtnGhost({ children, loading, icon, size = 'md', className = '', disabled, ...rest }: BtnProps) {
  const sz = size === 'sm'
    ? 'px-3 py-1.5 text-xs rounded-lg'
    : 'px-4 py-2.5 text-sm rounded-xl';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium',
        'border border-slate-200 dark:border-slate-700',
        'text-slate-600 dark:text-slate-300',
        'hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97]',
        'transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        sz,
        className,
      ].join(' ')}
    >
      {loading
        ? <CircularProgress fontSize="small" className="animate-spin shrink-0" />
        : icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

/**
 * Icon — square ghost button for icon-only actions (copy, refresh, open).
 */
function BtnIcon({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        'p-2 rounded-lg',
        'text-slate-500 dark:text-slate-400',
        'hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97]',
        'transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'GHS') {
  return `${currency} ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PROCESSED: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
    REJECTED:  'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal modal
// ---------------------------------------------------------------------------

interface WithdrawModalProps {
  currency: string;
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

function WithdrawModal({ currency, maxAmount, onClose, onSuccess }: WithdrawModalProps) {
  const { showToast } = useAppStore();
  const [amount, setAmount]     = useState('');
  const [bankName, setBankName] = useState('');
  const [accNum, setAccNum]     = useState('');
  const [accName, setAccName]   = useState('');
  const [momo, setMomo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0)   { setError('Enter a valid amount.');             return; }
    if (parsed > maxAmount)       { setError('Amount exceeds available balance.'); return; }
    if (!bankName.trim())         { setError('Bank name is required.');            return; }
    if (!accNum.trim())           { setError('Account number is required.');       return; }
    if (!accName.trim())          { setError('Account name is required.');         return; }

    const accountDetails: AccountDetailsDTO = {
      bankName: bankName.trim(),
      accountNumber: accNum.trim(),
      accountName: accName.trim(),
      mobileMoneyNumber: momo.trim() || undefined,
    };

    const body: WithdrawalRequestDTO = { amount: parsed, accountDetails };

    setLoading(true);
    try {
      await affiliate.requestWithdrawal(body);
      showToast('Withdrawal request submitted!', 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit withdrawal.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-heading text-lg font-bold mb-1">Withdraw Earnings</h3>
        <p className="text-sm text-slate-500 mb-4">
          Available:{' '}
          <span className="font-bold text-green-600">{formatCurrency(maxAmount, currency)}</span>
        </p>

        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {[
            { label: `Amount (${currency})`, value: amount, set: setAmount, type: 'number', placeholder: '0.00' },
            { label: 'Bank Name',             value: bankName, set: setBankName, placeholder: 'e.g. GCB Bank' },
            { label: 'Account Number',        value: accNum,   set: setAccNum,   placeholder: '1234567890' },
            { label: 'Account Name',          value: accName,  set: setAccName,  placeholder: 'Full name on account' },
          ].map(({ label, value, set, type = 'text', placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => set(e.target.value)}
                className="input-field"
                disabled={loading}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Mobile Money Number{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="+233…"
              value={momo}
              onChange={e => setMomo(e.target.value)}
              className="input-field"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <BtnGhost onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </BtnGhost>
          <BtnPrimary onClick={handleSubmit} loading={loading} className="flex-1">
            {loading ? 'Submitting…' : 'Submit Request'}
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AffiliatePage() {
  const { showToast } = useAppStore();

  const [stats, setStats]                       = useState<AffiliateStatsDTO | null>(null);
  const [affiliateBalance, setAffiliateBalance] = useState<AffiliateBalance | null>(null);
  const [referredUsers, setReferredUsers]       = useState<ReferredUserDTO[]>([]);
  const [links, setLinks]                       = useState<ReferralLink[]>([]);
  const [withdrawals, setWithdrawals]           = useState<AffiliateWithdrawalRequest[]>([]);

  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [creatingLink, setCreatingLink]     = useState(false);
  const [newLinkLabel, setNewLinkLabel]     = useState('');
  const [showLinkForm, setShowLinkForm]     = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, balanceRes, usersRes, linksRes, wdRes] = await Promise.all([
        affiliate.getStats(),
        affiliate.getBalance(),
        affiliate.getReferredUsers(),
        affiliate.getLinks(),
        affiliate.getWithdrawals(0, 10),
      ]);

      if (statsRes.success)   setStats(statsRes.data);
      if (balanceRes.success) {
        const d = balanceRes.data as Record<string, unknown>;
        if (typeof d.balance === 'number' && typeof d.currency === 'string') {
          setAffiliateBalance({ balance: d.balance, currency: d.currency });
        }
      }
      if (usersRes.success)   setReferredUsers(usersRes.data);
      if (linksRes.success)   setLinks(linksRes.data);
      if (wdRes.success)      setWithdrawals(wdRes.data.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load affiliate data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Referral link copied!', 'success');
  };

  const createLink = async () => {
    setCreatingLink(true);
    try {
      const res = await affiliate.createLink({ label: newLinkLabel.trim() || undefined });
      if (res.success) {
        setLinks(prev => [res.data, ...prev]);
        setNewLinkLabel('');
        setShowLinkForm(false);
        showToast('Referral link created!', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create link.';
      showToast(msg, 'error');
    } finally {
      setCreatingLink(false);
    }
  };

  const buildUrl = (code: string) => `${window.location.origin}/register?ref=${code}`;

  const currency         = affiliateBalance?.currency ?? stats?.currency ?? 'GHS';
  const availableBalance = affiliateBalance?.balance  ?? stats?.availableBalance ?? 0;

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <CircularProgress fontSize="large" className="animate-spin text-primary" />
          <p className="text-sm">Loading affiliate data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="card p-6 text-center">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <BtnPrimary onClick={loadAll} icon={<RefreshIcon fontSize="small" />} className="mx-auto">
            Retry
          </BtnPrimary>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GroupAddIcon className="text-primary" fontSize="large" />
          <h1 className="font-heading text-2xl font-bold">Affiliate Program</h1>
        </div>
        <BtnIcon onClick={loadAll} title="Refresh data" aria-label="Refresh data">
          <RefreshIcon fontSize="small" />
        </BtnIcon>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Referrals',
            value: stats?.totalReferrals?.toString() ?? '0',
            icon: <GroupAddIcon className="text-primary" />,
          },
          {
            label: 'Active Players',
            value: referredUsers.filter(u => (u.lifetimeStake ?? 0) > 0).length.toString(),
            icon: <LeaderboardIcon className="text-green-500" />,
          },
          {
            label: 'Lifetime Commission',
            value: formatCurrency(stats?.lifetimeCommission ?? 0, currency),
            icon: <AccountBalanceWalletIcon className="text-blue-500" />,
          },
          {
            label: 'Lifetime Stake',
            value: formatCurrency(stats?.lifetimeStake ?? 0, currency),
            icon: <ShareIcon className="text-amber-500" />,
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="flex justify-center mb-2">{stat.icon}</div>
            <p className="font-heading text-lg font-bold leading-tight">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Affiliate Wallet ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-bold text-slate-500 uppercase tracking-wider">
              Affiliate Balance
            </h2>
            <span className="relative flex h-2 w-2" aria-label="Live">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <Link to="/affiliate" className="text-sm text-primary font-medium hover:underline">
            View Details
          </Link>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Earnings from referrals — separate from your main betting wallet
        </p>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-heading text-3xl font-bold text-green-600">
              {formatCurrency(availableBalance, currency)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Available to withdraw</p>
          </div>
          <BtnPrimary
            onClick={() => setShowWithdrawModal(true)}
            disabled={availableBalance <= 0}
          >
            Withdraw
          </BtnPrimary>
        </div>
      </div>

      {/* ── Referral Links ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-sm font-bold text-slate-500 uppercase tracking-wider">
            Your Referral Links
          </h2>
          <BtnGhost
            size="sm"
            icon={<AddLinkIcon fontSize="small" />}
            onClick={() => setShowLinkForm(v => !v)}
          >
            New Link
          </BtnGhost>
        </div>

        {/* New link form */}
        {showLinkForm && (
          <div className="flex gap-2 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <input
              type="text"
              placeholder="Label (optional)"
              value={newLinkLabel}
              onChange={e => setNewLinkLabel(e.target.value)}
              className="input-field flex-1"
              disabled={creatingLink}
            />
            <BtnPrimary
              size="sm"
              loading={creatingLink}
              icon={<AddLinkIcon fontSize="small" />}
              onClick={createLink}
            >
              Create
            </BtnPrimary>
          </div>
        )}

        {links.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No referral links yet. Create one above.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map(link => (
              <div
                key={link.id}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex-1 min-w-0">
                  {link.label && (
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      {link.label}
                    </p>
                  )}
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-200 truncate">
                    {buildUrl(link.code)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {link.commissionPercent != null && (
                      <span className="text-xs text-primary font-semibold">
                        {link.commissionPercent}% commission
                      </span>
                    )}
                    {link.expiresAt && (
                      <span className="text-xs text-slate-400">
                        Expires {formatDate(link.expiresAt)}
                      </span>
                    )}
                    {link.active === false && (
                      <span className="text-xs text-red-500 font-medium">Inactive</span>
                    )}
                  </div>
                </div>

                {/* Icon button group */}
                <div className="flex items-center gap-1 shrink-0">
                  <BtnIcon
                    onClick={() => copyLink(buildUrl(link.code))}
                    title="Copy link"
                    aria-label="Copy referral link"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </BtnIcon>
                  <a
                    href={buildUrl(link.code)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open link"
                    aria-label="Open referral link in new tab"
                    className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all duration-150 inline-flex items-center justify-center"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Referred Players ── */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Referred Players{' '}
          <span className="text-primary">({referredUsers.length})</span>
        </h2>

        {referredUsers.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No referred players yet. Share your link to get started!
          </p>
        ) : (
          <div className="space-y-1">
            {referredUsers.map((player) => {
              const name =
                [player.firstName, player.lastName].filter(Boolean).join(' ') ||
                player.email ||
                player.userId;
              const isActive = (player.lifetimeStake ?? 0) > 0;
              return (
                <div
                  key={player.userId}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-slate-500">
                      Joined: {formatDate(player.joinedAt)}
                      {player.lifetimeStake != null &&
                        ` · Stake: ${formatCurrency(player.lifetimeStake, currency)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.lifetimeCommission != null && player.lifetimeCommission > 0 && (
                      <span className="text-xs font-semibold text-primary">
                        +{formatCurrency(player.lifetimeCommission, currency)}
                      </span>
                    )}
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Withdrawal History ── */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Withdrawal History
        </h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No withdrawals yet.</p>
        ) : (
          <div className="space-y-1">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatCurrency(w.amount, w.currency ?? currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(w.requestedAt)}
                    {w.bankName && ` · ${w.bankName}`}
                    {w.accountNumber && ` ···${w.accountNumber.slice(-4)}`}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── How It Works ── */}
      <div className="card p-5">
        <h2 className="font-heading text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              step: 1,
              title: 'Share Your Link',
              desc: 'Send your unique referral link to friends via social media or messaging apps.',
            },
            {
              step: 2,
              title: 'They Register & Deposit',
              desc: "When your friend signs up and makes their first deposit, you start earning commission.",
            },
            {
              step: 3,
              title: 'Earn Commission',
              desc: "Earn commission on your referrals' betting activity. Withdraw anytime to your bank.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mx-auto mb-2">
                {item.step}
              </div>
              <h3 className="font-heading text-sm font-bold mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Withdrawal modal ── */}
      {showWithdrawModal && (
        <WithdrawModal
          currency={currency}
          maxAmount={availableBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={loadAll}
        />
      )}
    </div>
  );
}