import { useAppStore } from '../../store';
import { recentWinners } from '../../data/mock';
import { calculateTotalOdds, calculatePotentialReturn } from '../../utils';
import { useCountry } from '../../hooks/useCountry';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function RightSidebar() {
  // Reactive currency: re-renders if the registered country changes,
  // which the plain formatCurrency() helper could not do.
  const { fmt: formatCurrency } = useCountry();
  const { betSlip, removeFromBetSlip, clearBetSlip, placeBet, mainWalletBalance, bets } = useAppStore();
  const [activeTab, setActiveTab] = useState<'slip' | 'bets'>('slip');
  const [stake, setStake] = useState('');
  const [detailModal, setDetailModal] = useState<number | null>(null);

  const totalOdds = calculateTotalOdds(betSlip.map((s) => s.odd));
  const potentialReturn = calculatePotentialReturn(parseFloat(stake) || 0, totalOdds);
  const quickStakes = [10, 20, 50, 100];

  const recentBets = bets.slice(0, 5);

  return (
    <aside className="hidden xl:block w-80 shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4">
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
          <button
            onClick={() => setActiveTab('slip')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'slip' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'
            }`}
          >
            <ReceiptLongIcon fontSize="small" />
            Bet Slip ({betSlip.length})
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bets' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'
            }`}
          >
            <HistoryIcon fontSize="small" />
            My Bets
          </button>
        </div>

        {activeTab === 'slip' && (
          <div>
            {betSlip.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <ReceiptLongIcon className="mx-auto mb-2" fontSize="large" />
                <p className="text-sm">No selections yet</p>
                <p className="text-xs mt-1">Click odds to add selections</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {betSlip.map((sel, i) => (
                    <div
                      key={`${sel.matchId}-${sel.market}-${sel.selection}`}
                      onClick={() => setDetailModal(i)}
                      className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{sel.matchName}</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{sel.market}: {sel.selection}</p>
                        <p className="text-sm font-bold text-primary">{sel.odd.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromBetSlip(sel.matchId, sel.market, sel.selection); }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex gap-1.5 mb-3">
                    {quickStakes.map((qs) => (
                      <button
                        key={qs}
                        onClick={() => setStake((prev) => (parseFloat(prev || '0') + qs).toString())}
                        className="flex-1 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        +{qs}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder="Stake (GH\u20B5)"
                    className="input-field mb-3"
                    min="0"
                    step="0.01"
                  />
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Total Odds</span>
                    <span className="font-bold">{totalOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-500 dark:text-slate-400">Potential Return</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(potentialReturn)}</span>
                  </div>
                  <button
                    onClick={() => { placeBet(parseFloat(stake)); setStake(''); }}
                    disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > mainWalletBalance}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Place Bet
                  </button>
                  <button
                    onClick={clearBetSlip}
                    className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}

            {detailModal !== null && betSlip[detailModal] && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailModal(null)}>
                <div className="card p-6 m-4 max-w-sm w-full animate-slide-up" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-heading text-lg font-bold mb-3">Selection Details</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{betSlip[detailModal].matchName}</p>
                  <p className="text-sm font-medium mt-1">Market: {betSlip[detailModal].market}</p>
                  <p className="text-sm font-medium mt-1">Selection: {betSlip[detailModal].selection}</p>
                  <p className="text-lg font-bold text-primary mt-2">Odd: {betSlip[detailModal].odd.toFixed(2)}</p>
                  {stake && (
                    <p className="text-sm mt-2 text-green-600 dark:text-green-400">
                      Potential return: {formatCurrency(parseFloat(stake) * betSlip[detailModal].odd)}
                    </p>
                  )}
                  <button onClick={() => setDetailModal(null)} className="btn-primary w-full mt-4">Close</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bets' && (
          <div className="space-y-2">
            {recentBets.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No bets yet</p>
            ) : (
              recentBets.map((bet) => (
                <div key={bet.id} className={`p-3 rounded-lg border ${
                  bet.status === 'won' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                  bet.status === 'lost' ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' :
                  'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">{bet.selections.length} selections</span>
                    <span className={`badge ${
                      bet.status === 'won' ? 'badge-green' : bet.status === 'lost' ? 'badge-gray' : 'badge-amber'
                    }`}>
                      {bet.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(bet.stake)} @ {bet.totalOdds.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Return: {formatCurrency(bet.potentialReturn)}</p>
                </div>
              ))
            )}
            <Link to="/betslip" className="block text-center text-sm text-primary font-medium mt-2 hover:underline">
              View all bets
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
          <EmojiEventsIcon className="text-yellow-500" fontSize="small" />
          Recent Winners
        </h3>
        <div className="space-y-2">
          {recentWinners.slice(0, 5).map((winner, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">{winner.userId}</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(winner.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
