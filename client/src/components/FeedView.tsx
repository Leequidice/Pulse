import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, RefreshCw, Zap } from 'lucide-react';
import { FeedCard } from '../types';
import { StoryCard } from './StoryCard';
import { ResolvedStoryCard } from './ResolvedStoryCard';
import { BetSheet } from './BetSheet';

interface FeedViewProps {
  cards: FeedCard[];
  walletAddress: string;
  privateKey?: string;
  isLoading: boolean;
  onRefresh: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  cards,
  walletAddress,
  privateKey,
  isLoading,
  onRefresh,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedBet, setSelectedBet] = useState<{
    card: FeedCard;
    direction: 'UP' | 'DOWN';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const totalCards = cards.length;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalCards - 1));
  }, [totalCards]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedBet) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, selectedBet]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 45) {
      // Swiped Up -> Go to Next
      goToNext();
    } else if (diff < -45) {
      // Swiped Down -> Go to Prev
      goToPrev();
    }
    touchStartY.current = null;
  };

  const currentCard = cards[currentIndex];

  if (isLoading && cards.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-pulse-bg">
        <div className="w-12 h-12 rounded-full border-2 border-pulse-up border-t-transparent animate-spin" />
        <span className="text-sm font-mono text-gray-400">Scanning Somnia Testnet Markets...</span>
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
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-full max-w-md mx-auto bg-pulse-bg flex flex-col overflow-hidden shadow-2xl"
    >
      {/* Stories Progress Bar Header (Instagram/TikTok style) */}
      <div className="absolute top-2 inset-x-3 z-30 flex items-center gap-1">
        {cards.map((card, idx) => (
          <div
            key={card.id || idx}
            onClick={() => setCurrentIndex(idx)}
            className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden cursor-pointer"
          >
            <div
              className={`h-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'bg-pulse-up w-full'
                  : idx < currentIndex
                  ? 'bg-white/70 w-full'
                  : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Main Active Card Area */}
      <div className="relative w-full h-full flex-1">
        {currentCard?.type === 'resolved_story' ? (
          <ResolvedStoryCard
            key={currentCard.id}
            card={currentCard}
            walletAddress={walletAddress}
            privateKey={privateKey}
            onAdvance={goToNext}
          />
        ) : (
          <StoryCard
            key={currentCard?.id || currentIndex}
            card={currentCard}
            onSelectBet={(card, direction) => setSelectedBet({ card, direction })}
            isActive={true}
          />
        )}
      </div>

      {/* Desktop & Tablet Floating Navigation Arrows */}
      <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 flex-col gap-2">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="w-10 h-10 rounded-full glass-panel border border-white/10 hover:border-white/30 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Previous Story (Up Arrow)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={goToNext}
          disabled={currentIndex === totalCards - 1}
          className="w-10 h-10 rounded-full glass-panel border border-white/10 hover:border-white/30 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Next Story (Down Arrow)"
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
          onSuccessAdvance={() => {
            setSelectedBet(null);
            goToNext();
          }}
        />
      )}
    </div>
  );
};
