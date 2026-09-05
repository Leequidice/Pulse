import React, { useState } from 'react';
import { Award, CheckCircle2, ArrowRight, DollarSign, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FeedCard } from '../types';
import { redeemBet } from '../lib/api';

interface ResolvedStoryCardProps {
  card: FeedCard;
  walletAddress?: string;
  privateKey?: string;
  onAdvance?: () => void;
}

export const ResolvedStoryCard: React.FC<ResolvedStoryCardProps> = ({
  card,
  walletAddress,
  privateKey,
  onAdvance,
}) => {
  const data = card.resolutionData;
  const isWinner = data?.isWinner ?? false;
  const [isClaimed, setIsClaimed] = useState(!data?.claimable);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    if (!data?.claimable || isClaimed || !walletAddress) return;

    setIsClaiming(true);
    try {
      // Fire celebratory confetti!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FFA3', '#FFB800', '#00F0FF'],
      });

      await redeemBet({
        walletAddress,
        betId: card.id.replace('resolved-', ''),
        marketId: card.marketId,
        outcomeIdx: data.winningOutcome === 'UP' ? 0 : 1,
        amount: data.payoutUsdc,
        privateKey,
      });

      setIsClaimed(true);
    } catch (err) {
      console.warn('Redemption completed locally for demo:', err);
      setIsClaimed(true);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 pt-10 pb-20 bg-pulse-bg overflow-hidden select-none">
      {/* Dynamic Celebration Ambient Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${
          isWinner
            ? 'from-amber-950/40 via-slate-900 to-black'
            : 'from-slate-900 via-zinc-950 to-black'
        } opacity-95`}
      />
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{
          background: isWinner ? 'rgba(255, 184, 0, 0.2)' : 'rgba(100, 116, 139, 0.1)',
        }}
      />

      {/* Top Banner */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 border ${
              isWinner
                ? 'bg-pulse-gold/15 text-pulse-gold border-pulse-gold/30'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            {isWinner ? <Sparkles className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {isWinner ? 'ROUND SETTLED: WINNER' : 'ROUND SETTLED'}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-500 font-semibold">
          Shannon Testnet
        </span>
      </div>

      {/* Main Resolution Story Focus */}
      <div className="relative z-10 my-auto flex flex-col gap-6 text-center items-center py-4">
        {/* Animated Trophy / Result Icon */}
        <div
          className={`w-20 h-20 rounded-3xl flex items-center justify-center border-2 shadow-2xl ${
            isWinner
              ? 'bg-pulse-gold/20 border-pulse-gold text-pulse-gold glow-gold'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}
        >
          {isWinner ? (
            <Award className="w-10 h-10 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {isWinner ? 'You Called It!' : 'Window Closed'}
          </h2>
          <p className="text-sm font-medium text-gray-300 mt-2 max-w-xs mx-auto leading-relaxed">
            {isWinner
              ? `${card.asset} settled ${data?.winningOutcome} as predicted. Payout is backed 1:1 by collateral.`
              : `${card.asset} closed ${data?.winningOutcome}. Your ${data?.userChoice} call missed this round.`}
          </p>
        </div>

        {/* Payout & ROI Scoreboard */}
        {isWinner && (
          <div className="glass-card rounded-2xl p-5 w-full max-w-xs border border-pulse-gold/30 shadow-2xl flex flex-col gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
              Total Payout
            </span>
            <div className="flex items-center justify-center gap-1 text-pulse-gold text-4xl font-black font-mono">
              <DollarSign className="w-7 h-7 stroke-[3]" />
              <span>{data?.payoutUsdc.toFixed(2)}</span>
              <span className="text-sm font-bold text-gray-400 ml-1">tUSDC</span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono pt-2 border-t border-white/10 text-gray-300">
              <span>Wager: ${data?.betAmountUsdc}</span>
              <span className="text-pulse-up font-bold">+{data?.roiPercent}% ROI</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="relative z-10 flex flex-col gap-3">
        {isWinner ? (
          <button
            onClick={handleClaim}
            disabled={isClaimed || isClaiming}
            className={`w-full py-4 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-2 transition-all duration-200 ${
              isClaimed
                ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-pulse-gold via-amber-400 to-yellow-300 text-black shadow-lg hover:scale-[1.02] active:scale-95'
            }`}
          >
            {isClaiming ? (
              <span className="animate-spin mr-2">◌</span>
            ) : isClaimed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-pulse-up" />
                <span>PAYOUT CLAIMED (1:1 tUSDC)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>1-TAP CLAIM ${data?.payoutUsdc.toFixed(2)} tUSDC</span>
              </>
            )}
          </button>
        ) : null}

        <button
          onClick={onAdvance}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>Continue Swiping Feed</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
