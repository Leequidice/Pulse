import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  DollarSign,
  Flame,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PortfolioStats, UserBetRecord } from '../types';
import { redeemBet } from '../lib/api';

interface PortfolioViewProps {
  stats: PortfolioStats;
  positions: UserBetRecord[];
  walletAddress: string;
  privateKey?: string;
  sttBalance: number;
  usdcBalance: number;
  onRefresh: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  stats,
  positions,
  walletAddress,
  privateKey,
  sttBalance,
  usdcBalance,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [claimingBetId, setClaimingBetId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const resolvedPositions = positions.filter(
    (p) => p.status === 'RESOLVED' || p.status === 'CLAIMED'
  );

  const handleClaim = async (bet: UserBetRecord) => {
    setClaimingBetId(bet.id);
    setClaimError(null);
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#00FFA3', '#FFB800'],
      });

      await redeemBet({
        walletAddress,
        betId: bet.id,
        marketId: bet.marketId,
        outcomeIdx: bet.winningOutcome === 'UP' ? 0 : 1,
        amount: bet.payoutUsdc || 1,
        privateKey,
      });

      onRefresh();
    } catch (err: any) {
      console.error('On-chain redemption error:', err);
      setClaimError(err.message || 'On-chain redemption failed');
    } finally {
      setClaimingBetId(null);
    }
  };

  return (
    <div className="w-full h-full max-w-md mx-auto flex flex-col bg-pulse-bg text-white overflow-y-auto no-scrollbar p-5 pb-24 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Portfolio</h1>
          <p className="text-xs font-mono text-gray-400 mt-0.5">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>
        </div>

        {/* Live Balances Pill */}
        <div className="flex flex-col items-end gap-1">
          <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-mono font-bold text-pulse-cyan flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{usdcBalance.toFixed(2)} tUSDC</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500">
            Gas: {sttBalance.toFixed(3)} STT
          </span>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Net PnL Card */}
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-1 border border-white/10">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
            Net PnL
          </span>
          <div
            className={`text-2xl font-black font-mono ${
              stats.netPnL >= 0 ? 'text-pulse-up' : 'text-pulse-down'
            }`}
          >
            {stats.netPnL >= 0 ? `+$${stats.netPnL.toFixed(2)}` : `-$${Math.abs(stats.netPnL).toFixed(2)}`}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Wagered: ${stats.totalWagered.toFixed(2)}
          </span>
        </div>

        {/* Win Rate & Streak Card */}
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-1 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Win Rate
            </span>
            {stats.streakCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-pulse-gold flex items-center gap-0.5">
                <Flame className="w-3 h-3 text-pulse-gold" />
                <span>{stats.streakCount} Streak</span>
              </span>
            )}
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {stats.winRate}%
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Resolved: {stats.resolvedCount} trades
          </span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex rounded-xl bg-white/5 p-1 mb-4 border border-white/10">
        <button
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'open'
              ? 'bg-pulse-card text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Open Positions ({openPositions.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-pulse-card text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Settled History ({resolvedPositions.length})
        </button>
      </div>

      {/* Position List Content */}
      <div className="flex-1 flex flex-col gap-3">
        {claimError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{claimError}</span>
          </div>
        )}

        {activeTab === 'open' ? (
          openPositions.length === 0 ? (
            <div className="flex-1 py-12 flex flex-col items-center justify-center text-center gap-2 text-gray-400">
              <Clock className="w-10 h-10 text-gray-600" />
              <p className="text-sm font-bold text-gray-300">No Open Positions</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Scroll the feed to discover live prediction windows and place two-tap bets.
              </p>
            </div>
          ) : (
            openPositions.map((pos) => {
              const isUp = pos.direction === 'UP';
              return (
                <div
                  key={pos.id}
                  className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/10 text-pulse-cyan">
                        {pos.asset}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-black font-mono flex items-center gap-1 ${
                          isUp
                            ? 'bg-pulse-up/15 text-pulse-up'
                            : 'bg-pulse-down/15 text-pulse-down'
                        }`}
                      >
                        {isUp ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>{pos.direction}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        {pos.timeLeftSeconds !== undefined
                          ? `${Math.floor(pos.timeLeftSeconds / 60)}m left`
                          : 'Active'}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white leading-snug">
                    {pos.headline}
                  </h4>

                  {pos.txHash && (
                    <a
                      href={`https://shannon-explorer.somnia.network/tx/${pos.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-pulse-cyan hover:underline flex items-center gap-1 self-start"
                    >
                      <span>Tx: {pos.txHash.slice(0, 8)}...{pos.txHash.slice(-6)}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-mono">
                    <span className="text-gray-400">Wager: ${pos.amountUsdc} tUSDC</span>
                    <span className="text-pulse-cyan font-bold">
                      Est. Payout: ${(pos.amountUsdc * 1.85).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )
        ) : resolvedPositions.length === 0 ? (
          <div className="flex-1 py-12 flex flex-col items-center justify-center text-center gap-2 text-gray-400">
            <Award className="w-10 h-10 text-gray-600" />
            <p className="text-sm font-bold text-gray-300">No Settled Trades Yet</p>
            <p className="text-xs text-gray-500 max-w-xs">
              When a market expires, it will automatically resolve and report your result here.
            </p>
          </div>
        ) : (
          resolvedPositions.map((pos) => {
            const isWin = pos.isWin;
            const isClaimed = pos.status === 'CLAIMED';
            return (
              <div
                key={pos.id}
                className={`glass-card rounded-2xl p-4 border flex flex-col gap-2.5 shadow-lg ${
                  isWin ? 'border-pulse-gold/30' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/10 text-pulse-cyan">
                      {pos.asset}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black font-mono ${
                        isWin
                          ? 'bg-pulse-gold/20 text-pulse-gold'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {isWin ? 'WON (+85%)' : 'MISSED'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-gray-500">
                    Settled: {pos.winningOutcome}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">
                  {pos.headline}
                </h4>

                {pos.txHash && (
                  <a
                    href={`https://shannon-explorer.somnia.network/tx/${pos.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-pulse-cyan hover:underline flex items-center gap-1 self-start"
                  >
                    <span>Tx: {pos.txHash.slice(0, 8)}...{pos.txHash.slice(-6)}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs font-mono text-gray-400">
                    Wager: ${pos.amountUsdc}
                  </span>

                  {isWin ? (
                    <button
                      onClick={() => handleClaim(pos)}
                      disabled={isClaimed || claimingBetId === pos.id}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black transition-all ${
                        isClaimed
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : 'bg-pulse-gold text-black hover:scale-105 active:scale-95'
                      }`}
                    >
                      {claimingBetId === pos.id
                        ? 'Claiming...'
                        : isClaimed
                        ? 'CLAIMED'
                        : `CLAIM $${pos.payoutUsdc?.toFixed(2)}`}
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-gray-500">Settled 0</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
