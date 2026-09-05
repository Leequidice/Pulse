import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, Zap, Radio } from 'lucide-react';
import { FeedCard } from '../types';
import { StoryCard } from './StoryCard';
import { ResolvedStoryCard } from './ResolvedStoryCard';
import { BetSheet } from './BetSheet';

interface FeedViewProps {
  cards: FeedCard[];
  walletAddress: string;
  privateKey?: string;
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  cards,
  walletAddress,
  privateKey,
  isLoading,
  isLoadingMore = false,
  hasMore = true,
  onLoadMore,
  onRefresh,
}) => {
  const [selectedBet, setSelectedBet] = useState<{
    card: FeedCard;
    direction: 'UP' | 'DOWN';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTriggeredRef = useRef(false);

  // Keyboard navigation (pure user-paced: ArrowDown / j / ArrowUp / k)
  const scrollDown = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        top: containerRef.current.clientHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  const scrollUp = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        top: -containerRef.current.clientHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedBet) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollDown();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollUp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollDown, scrollUp, selectedBet]);

  // Infinite Scroll Trigger (detect when user approaches the end of loaded cards)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = el.clientHeight * 2.5; // Within 2-3 cards of the bottom
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceToBottom < threshold && hasMore && !isLoadingMore && !loadingTriggeredRef.current) {
      loadingTriggeredRef.current = true;
      if (onLoadMore) {
        onLoadMore();
      }
    } else if (distanceToBottom >= threshold) {
      loadingTriggeredRef.current = false;
    }
  };

  if (isLoading && cards.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-pulse-bg">
        <div className="w-12 h-12 rounded-full border-2 border-pulse-up border-t-transparent animate-spin" />
        <span className="text-sm font-mono text-gray-400">Loading Live Market Feed...</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-pulse-bg">
        <Zap className="w-12 h-12 text-pulse-cyan animate-bounce" />
        <h3 className="text-xl font-bold text-white">No Live Markets Found</h3>
        <p className="text-xs text-gray-400 max-w-xs">
          Scanning Somnia Shannon testnet block logs. Tap refresh to query latest blocks.
        </p>
        <button
          onClick={onRefresh}
          className="px-5 py-2.5 rounded-full bg-pulse-up/20 border border-pulse-up text-pulse-up font-bold text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Feed</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full max-w-md mx-auto bg-pulse-bg overflow-hidden shadow-2xl">
      {/* Pure Continuous TikTok-Style Scroll-Snap Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {cards.map((card, idx) => (
          <section
            key={card.id || idx}
            data-index={idx}
            className="w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 relative overflow-hidden"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            {card.type === 'resolved_story' ? (
              <ResolvedStoryCard
                card={card}
                walletAddress={walletAddress}
                privateKey={privateKey}
              />
            ) : (
              <StoryCard
                card={card}
                onSelectBet={(c, direction) => setSelectedBet({ card: c, direction })}
              />
            )}
          </section>
        ))}

        {/* Lightweight Infinite-Loading Card Indicator */}
        {isLoadingMore && (
          <section
            className="w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col items-center justify-center gap-3 bg-pulse-bg/80 backdrop-blur-sm"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            <div className="w-10 h-10 rounded-full border-2 border-pulse-cyan border-t-transparent animate-spin" />
            <div className="flex items-center gap-2 text-xs font-mono text-pulse-cyan">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Fetching Next Markets...</span>
            </div>
          </section>
        )}
      </div>

      {/* Desktop & Tablet Navigation Helpers (User-Paced Only) */}
      <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 flex-col gap-2">
        <button
          onClick={scrollUp}
          className="w-10 h-10 rounded-full glass-panel border border-white/10 hover:border-white/30 flex items-center justify-center text-white transition-all shadow-lg active:scale-95"
          title="Scroll Up (k / ↑)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={scrollDown}
          className="w-10 h-10 rounded-full glass-panel border border-white/10 hover:border-white/30 flex items-center justify-center text-white transition-all shadow-lg active:scale-95"
          title="Scroll Down (j / ↓)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Two-Tap Bet Sizing Sheet */}
      {selectedBet && (
        <BetSheet
          card={selectedBet.card}
          direction={selectedBet.direction}
          walletAddress={walletAddress}
          privateKey={privateKey}
          onClose={() => setSelectedBet(null)}
        />
      )}
    </div>
  );
};
