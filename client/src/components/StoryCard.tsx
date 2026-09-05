import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { FeedCard } from '../types';
import { Sparkline } from './Sparkline';
import { SOMNIA_SHANNON_CONFIG } from '../lib/constants';

interface StoryCardProps {
  card: FeedCard;
  onSelectBet: (card: FeedCard, direction: 'UP' | 'DOWN') => void;
  isActive?: boolean;
}

export const StoryCard: React.FC<StoryCardProps> = ({ card, onSelectBet }) => {
  const [timeLeft, setTimeLeft] = useState(card.timeRemainingSeconds);

  // Real-time ticking countdown
  useEffect(() => {
    setTimeLeft(Math.max(0, card.expiryTimestamp - Math.floor(Date.now() / 1000)));
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, card.expiryTimestamp - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [card.expiryTimestamp]);

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return 'Settling...';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const isBullish = card.impliedProbUp >= 50;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 pt-8 pb-20 bg-pulse-bg overflow-hidden select-none">
      {/* Dynamic Background Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${card.theme.gradient} opacity-90 transition-opacity duration-700`}
      />
      <div
        className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{ background: card.theme.glowColor }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: isBullish ? 'rgba(0, 255, 163, 0.12)' : 'rgba(255, 56, 100, 0.12)' }}
      />

      {/* Top Meta Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-white/10 text-white border border-white/15 backdrop-blur-md">
            {card.category}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-wide bg-pulse-cyan/15 text-pulse-cyan border border-pulse-cyan/30 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {card.asset}
          </span>
        </div>

        {/* Expiry Countdown Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-tight border backdrop-blur-md ${
            timeLeft < 180
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              : 'bg-black/40 text-gray-300 border-white/10'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{formatCountdown(timeLeft)}</span>
        </div>
      </div>

      {/* Middle Headline & Implied Odds Section */}
      <div className="relative z-10 my-auto py-4 flex flex-col gap-5">
        {/* Punchy Headline */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
            {card.headline}
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 mt-2 font-medium leading-relaxed line-clamp-2">
            {card.summary}
          </p>
        </div>

        {/* Probability Metric & Sparkline Box */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono tracking-widest text-gray-400 uppercase">
                Implied Probability
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                    isBullish ? 'text-pulse-up' : 'text-pulse-down'
                  }`}
                >
                  {card.impliedProbUp}%
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {isBullish ? 'UP' : 'DOWN'} Favor
                </span>
              </div>
            </div>

            {/* Sparkline Visualizer */}
            <div className="flex flex-col items-end">
              <Sparkline
                data={card.sparkline}
                color={isBullish ? '#00FFA3' : '#FF3864'}
                width={130}
                height={44}
              />
              <span className="text-[10px] font-mono text-gray-500 mt-1">
                Odds Trend (60m)
              </span>
            </div>
          </div>

          {/* Visual Sentiment Probability Split Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden flex p-0.5 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-pulse-up rounded-l-full transition-all duration-700"
                style={{ width: `${card.impliedProbUp}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-pulse-down to-rose-400 rounded-r-full transition-all duration-700"
                style={{ width: `${card.impliedProbDown}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono font-semibold text-gray-400">
              <span className="text-pulse-up">{card.impliedProbUp}% UP</span>
              <span className="text-pulse-down">{card.impliedProbDown}% DOWN</span>
            </div>
          </div>
        </div>

        {/* Somnia Shannon Contract Proof Badge */}
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-pulse-up" />
            <span>Shannon 50312</span>
            <span className="text-gray-600">•</span>
            <span>Collateral: tUSDC</span>
          </div>
          <a
            href={`${SOMNIA_SHANNON_CONFIG.blockExplorerUrls[0]}/address/${card.pool}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-pulse-cyan transition-colors"
          >
            <span>Pool</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Two-Tap Tap Targets (UP and DOWN) */}
      <div className="relative z-10 grid grid-cols-2 gap-3 pt-2">
        {/* UP BUTTON */}
        <button
          onClick={() => onSelectBet(card, 'UP')}
          className="group relative overflow-hidden flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-emerald-500/25 to-emerald-600/15 border-2 border-pulse-up/50 hover:border-pulse-up hover:glow-up active:scale-95 transition-all duration-150"
        >
          <div className="flex items-center gap-2 text-pulse-up font-extrabold text-lg sm:text-xl">
            <TrendingUp className="w-6 h-6 stroke-[3] group-hover:-translate-y-0.5 transition-transform" />
            <span>UP</span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-emerald-300/80 mt-0.5">
            {card.impliedProbUp}% Chance
          </span>
        </button>

        {/* DOWN BUTTON */}
        <button
          onClick={() => onSelectBet(card, 'DOWN')}
          className="group relative overflow-hidden flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-rose-500/25 to-rose-600/15 border-2 border-pulse-down/50 hover:border-pulse-down hover:glow-down active:scale-95 transition-all duration-150"
        >
          <div className="flex items-center gap-2 text-pulse-down font-extrabold text-lg sm:text-xl">
            <TrendingDown className="w-6 h-6 stroke-[3] group-hover:translate-y-0.5 transition-transform" />
            <span>DOWN</span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-rose-300/80 mt-0.5">
            {card.impliedProbDown}% Chance
          </span>
        </button>
      </div>
    </div>
  );
};
