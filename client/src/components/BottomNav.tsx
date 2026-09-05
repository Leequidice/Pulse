import React from 'react';
import { Compass, PieChart, Wallet } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'feed' | 'portfolio';
  resolvedCount: number;
  onTabChange: (tab: 'feed' | 'portfolio') => void;
  onOpenWallet: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  resolvedCount,
  onTabChange,
  onOpenWallet,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center p-3 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-sm h-14 rounded-2xl glass-card border border-white/15 px-4 flex items-center justify-around shadow-2xl backdrop-blur-xl">
        {/* Feed Tab */}
        <button
          onClick={() => onTabChange('feed')}
          className={`relative flex flex-col items-center justify-center w-14 h-11 rounded-xl transition-all ${
            currentTab === 'feed'
              ? 'text-pulse-up bg-white/10 shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Market News Feed"
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Feed</span>
          {resolvedCount > 0 && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-pulse-gold animate-ping" />
          )}
        </button>

        {/* Portfolio Tab */}
        <button
          onClick={() => onTabChange('portfolio')}
          className={`relative flex flex-col items-center justify-center w-14 h-11 rounded-xl transition-all ${
            currentTab === 'portfolio'
              ? 'text-pulse-cyan bg-white/10 shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Portfolio & PnL"
        >
          <PieChart className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Portfolio</span>
        </button>

        {/* Wallet Trigger */}
        <button
          onClick={onOpenWallet}
          className="relative flex flex-col items-center justify-center w-14 h-11 rounded-xl text-gray-400 hover:text-white transition-all hover:bg-white/5"
          title="Wallet & Balances"
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Wallet</span>
        </button>
      </nav>
    </div>
  );
};
