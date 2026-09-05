import React, { useState, useEffect, useCallback } from 'react';
import { FeedCard, PortfolioStats, UserBetRecord, WalletState } from './types';
import { fetchFeed, fetchPortfolio } from './lib/api';
import { getOrCreateBurnerWallet, fetchBalances } from './lib/wallet';
import { WS_BASE_URL } from './lib/constants';
import { FeedView } from './components/FeedView';
import { PortfolioView } from './components/PortfolioView';
import { BottomNav } from './components/BottomNav';
import { WalletModal } from './components/WalletModal';
import { Radio } from 'lucide-react';

export const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    type: 'burner',
    sttBalance: 0,
    usdcBalance: 0,
    isConnected: false,
  });

  const [cards, setCards] = useState<FeedCard[]>([]);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats>({
    totalWagered: 0,
    totalWon: 0,
    netPnL: 0,
    winRate: 0,
    openCount: 0,
    resolvedCount: 0,
    streakCount: 0,
  });
  const [positions, setPositions] = useState<UserBetRecord[]>([]);

  const [currentTab, setCurrentTab] = useState<'feed' | 'stories' | 'portfolio'>('feed');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);

  // Initialize Wallet
  const initWallet = useCallback(async () => {
    const burner = getOrCreateBurnerWallet();
    const balances = await fetchBalances(burner.address);

    setWallet({
      address: burner.address,
      type: 'burner',
      privateKey: burner.privateKey,
      sttBalance: balances.stt,
      usdcBalance: balances.usdc,
      isConnected: true,
    });
  }, []);

  // Load Feed
  const loadFeedData = useCallback(async (walletAddr?: string) => {
    setIsLoadingFeed(true);
    try {
      const feedCards = await fetchFeed(walletAddr);
      setCards(feedCards);
    } catch (err) {
      console.warn('Feed load note:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // Load Portfolio
  const loadPortfolioData = useCallback(async (walletAddr: string) => {
    try {
      const res = await fetchPortfolio(walletAddr);
      setPortfolioStats(res.stats);
      setPositions(res.positions);
    } catch (err) {
      console.warn('Portfolio load note:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  useEffect(() => {
    if (wallet.address) {
      loadFeedData(wallet.address);
      loadPortfolioData(wallet.address);
    }
  }, [wallet.address, loadFeedData, loadPortfolioData]);

  // Real-time WebSocket connection for live tick and resolution stream
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_BASE_URL);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'NEW_BET' || msg.event === 'RESOLVED') {
            if (wallet.address) {
              loadFeedData(wallet.address);
              loadPortfolioData(wallet.address);
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, [wallet.address, loadFeedData, loadPortfolioData]);

  // Filter cards for "stories" tab (resolved story callbacks only)
  const displayedCards =
    currentTab === 'stories'
      ? cards.filter((c) => c.type === 'resolved_story')
      : cards;

  const resolvedStoriesCount = cards.filter((c) => c.type === 'resolved_story').length;

  return (
    <div className="relative w-screen h-screen bg-[#0a0b0e] text-white flex flex-col items-center justify-between overflow-hidden">
      {/* Top Floating Somnia Status Pill */}
      <header className="fixed top-2.5 inset-x-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto px-3.5 py-1 rounded-full glass-panel border border-white/10 flex items-center gap-2 text-[11px] font-mono shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1 text-pulse-up">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="font-bold">Pulse</span>
          </div>
          <span className="text-gray-600">•</span>
          <span className="text-gray-300">Somnia Shannon</span>
          <span className="text-gray-600">•</span>
          <span className="text-pulse-cyan font-semibold">50312</span>
        </div>
      </header>

      {/* Main View Container */}
      <main className="relative w-full h-full flex-1 flex flex-col items-center justify-center overflow-hidden">
        {currentTab === 'feed' || currentTab === 'stories' ? (
          <FeedView
            cards={displayedCards}
            walletAddress={wallet.address || ''}
            privateKey={wallet.privateKey}
            isLoading={isLoadingFeed}
            onRefresh={() => wallet.address && loadFeedData(wallet.address)}
          />
        ) : (
          <PortfolioView
            stats={portfolioStats}
            positions={positions}
            walletAddress={wallet.address || ''}
            privateKey={wallet.privateKey}
            sttBalance={wallet.sttBalance}
            usdcBalance={wallet.usdcBalance}
            onRefresh={() => {
              if (wallet.address) {
                loadPortfolioData(wallet.address);
                fetchBalances(wallet.address).then((b) =>
                  setWallet((prev) => ({ ...prev, sttBalance: b.stt, usdcBalance: b.usdc }))
                );
              }
            }}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        resolvedCount={resolvedStoriesCount}
        onTabChange={setCurrentTab}
        onOpenWallet={() => setIsWalletModalOpen(true)}
      />

      {/* Wallet Management Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        walletType={wallet.type}
        walletAddress={wallet.address || ''}
        privateKey={wallet.privateKey}
        sttBalance={wallet.sttBalance}
        usdcBalance={wallet.usdcBalance}
        onClose={() => setIsWalletModalOpen(false)}
        onWalletUpdated={() => {
          initWallet();
          if (wallet.address) {
            loadFeedData(wallet.address);
            loadPortfolioData(wallet.address);
          }
        }}
      />
    </div>
  );
};
