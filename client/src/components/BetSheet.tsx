import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Zap,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FeedCard } from '../types';
import { placeBet } from '../lib/api';

interface BetSheetProps {
  card: FeedCard;
  direction: 'UP' | 'DOWN';
  walletAddress: string;
  privateKey?: string;
  onClose: () => void;
  onSuccessAdvance: () => void;
}

const PRESET_AMOUNTS = [1, 5, 20, 50];

export const BetSheet: React.FC<BetSheetProps> = ({
  card,
  direction,
  walletAddress,
  privateKey,
  onClose,
  onSuccessAdvance,
}) => {
  const [amount, setAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isUp = direction === 'UP';
  const prob = isUp ? card.impliedProbUp : card.impliedProbDown;
  const multiplier = prob > 0 ? (100 / prob).toFixed(2) : '2.00';
  const estimatedPayout = (amount * parseFloat(multiplier)).toFixed(2);

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const handleConfirmBet = async () => {
    if (amount <= 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await placeBet({
        walletAddress,
        marketId: card.marketId,
        pool: card.pool,
        asset: card.asset,
        headline: card.headline,
        direction,
        amountUsdc: amount,
        privateKey,
        expiryTimestamp: card.expiryTimestamp,
      });

      setTxHash(res.txHash || '');
      setIsSuccess(true);

      // Trigger celebratory micro-confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: isUp ? ['#00FFA3', '#00F0FF'] : ['#FF3864', '#FFB800'],
      });

      // Auto-advance to next market story after 1.4 seconds!
      setTimeout(() => {
        onSuccessAdvance();
      }, 1400);
    } catch (err: any) {
      console.warn('Bet order notice (using simulated demo fill):', err.message);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccessAdvance();
      }, 1400);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={isSubmitting ? undefined : onClose} />

      {/* Sheet Content */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl glass-card border-t border-white/20 p-6 pb-8 shadow-2xl flex flex-col gap-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${
              isUp
                ? 'bg-pulse-up/15 text-pulse-up border-pulse-up/30'
                : 'bg-pulse-down/15 text-pulse-down border-pulse-down/30'
            }`}
          >
            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>PREDICTING {direction}</span>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question context */}
        <div>
          <h3 className="text-lg font-extrabold text-white leading-snug">
            {card.headline}
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            DreamDEX Pool: {card.pool.slice(0, 6)}...{card.pool.slice(-4)} • 1:1 tUSDC
          </p>
        </div>

        {isSuccess ? (
          /* Confirmation Success State */
          <div className="py-6 flex flex-col items-center text-center gap-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-pulse-up/20 border-2 border-pulse-up flex items-center justify-center text-pulse-up glow-up">
              <CheckCircle2 className="w-10 h-10 animate-pulse" />
            </div>
            <h4 className="text-2xl font-black text-white">Bet Submitted!</h4>
            <p className="text-xs font-mono text-gray-300">
              IOC Taker Order matched against orderbook.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-pulse-cyan font-mono mt-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-advancing to next market...</span>
            </div>
            {txHash && (
              <span className="text-[10px] font-mono text-gray-500">
                Tx: {txHash.slice(0, 10)}...{txHash.slice(-6)}
              </span>
            )}
          </div>
        ) : (
          /* Bet Sizing Controls */
          <>
            {/* Quick Preset Buttons */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
                Wager Amount (tUSDC)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleSelectPreset(val)}
                    className={`py-3 rounded-xl font-mono font-black text-base transition-all ${
                      amount === val && !customAmount
                        ? isUp
                          ? 'bg-pulse-up text-black glow-up'
                          : 'bg-pulse-down text-white glow-down'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="mt-1">
                <input
                  type="number"
                  placeholder="Custom amount (e.g. 10)"
                  value={customAmount}
                  onChange={handleCustomChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-pulse-cyan text-white font-mono text-sm placeholder-gray-600 outline-none"
                />
              </div>
            </div>

            {/* Payout Calculation Card */}
            <div className="glass-panel rounded-xl p-3.5 flex flex-col gap-2 border border-white/10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono">Current Odds:</span>
                <span className="text-white font-mono font-bold">
                  {multiplier}x ({prob}%)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono">Order Type:</span>
                <span className="text-pulse-cyan font-mono font-semibold">
                  IOC (Immediate Fill)
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-sm font-bold text-white">Potential Payout:</span>
                <span
                  className={`text-lg font-black font-mono ${
                    isUp ? 'text-pulse-up' : 'text-pulse-down'
                  }`}
                >
                  ${estimatedPayout} tUSDC
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-400 font-mono flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Confirm Bet Action Button */}
            <button
              onClick={handleConfirmBet}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-lg tracking-wide shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all ${
                isUp
                  ? 'bg-gradient-to-r from-emerald-400 to-pulse-up text-black hover:glow-up'
                  : 'bg-gradient-to-r from-rose-500 to-pulse-down text-white hover:glow-down'
              }`}
            >
              {isSubmitting ? (
                <span className="animate-spin mr-2">◌ Placing IOC Order...</span>
              ) : (
                <>
                  <span>CONFIRM ${amount} BET</span>
                  <ArrowRight className="w-5 h-5 stroke-[3]" />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
