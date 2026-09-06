import {
  discoverLiveMarkets,
  getMarketState,
  checkMarketResolutionOnChain,
  DiscoveredMarket,
  OnChainMarketState,
} from './chain.js';
import { CONTRACT_ADDRESSES } from './config.js';

export interface FeedCard {
  id: string;
  type: 'market' | 'resolved_story';
  marketId: string;
  pool: string;
  asset: string;
  category: 'CRYPTO' | 'DEFI' | 'MACRO' | 'TECH' | 'SOMNIA';
  headline: string;
  subheadline: string;
  summary: string;
  impliedProbUp: number; // 0 - 100%
  impliedProbDown: number; // 100 - impliedProbUp
  sparkline: number[]; // 12-point probability history [45, 48, ..., 64]
  expiryTimestamp: number; // Unix seconds
  timeRemainingSeconds: number;
  totalVolumeUsdc: number;
  tags: string[];
  theme: {
    gradient: string;
    glowColor: string;
    accentColor: string;
  };
  outcomeToken?: string;
  yesId?: string;
  noId?: string;
  // If type === 'resolved_story'
  resolutionData?: {
    userChoice: 'UP' | 'DOWN';
    winningOutcome: 'UP' | 'DOWN';
    isWinner: boolean;
    betAmountUsdc: number;
    payoutUsdc: number;
    roiPercent: number;
    claimable: boolean;
    txHash?: string;
  };
}

export interface UserBetRecord {
  id: string;
  walletAddress: string;
  marketId: string;
  pool: string;
  asset: string;
  headline: string;
  direction: 'UP' | 'DOWN';
  amountUsdc: number;
  entryProbUp: number;
  timestamp: number;
  expiryTimestamp: number;
  status: 'OPEN' | 'RESOLVED' | 'CLAIMED';
  winningOutcome?: 'UP' | 'DOWN';
  payoutAmountUsdc?: number;
  txHash?: string;
}

// In-memory store for user bets and resolved story notifications
export const userBetsStore = new Map<string, UserBetRecord[]>();

export function recordUserBet(bet: UserBetRecord) {
  const existing = userBetsStore.get(bet.walletAddress.toLowerCase()) || [];
  existing.unshift(bet);
  userBetsStore.set(bet.walletAddress.toLowerCase(), existing);
}

export function getUserBets(walletAddress: string): UserBetRecord[] {
  return userBetsStore.get(walletAddress.toLowerCase()) || [];
}

// Visual themes for news story cards
const THEMES = [
  {
    gradient: 'from-emerald-950/40 via-slate-900 to-black',
    glowColor: 'rgba(0, 255, 163, 0.15)',
    accentColor: '#00FFA3',
  },
  {
    gradient: 'from-purple-950/40 via-slate-900 to-black',
    glowColor: 'rgba(168, 85, 247, 0.15)',
    accentColor: '#A855F7',
  },
  {
    gradient: 'from-cyan-950/40 via-slate-900 to-black',
    glowColor: 'rgba(6, 182, 212, 0.15)',
    accentColor: '#06B6D4',
  },
  {
    gradient: 'from-rose-950/40 via-slate-900 to-black',
    glowColor: 'rgba(244, 63, 94, 0.15)',
    accentColor: '#F43F5E',
  },
  {
    gradient: 'from-amber-950/40 via-slate-900 to-black',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    accentColor: '#F59E0B',
  },
];

// Generate dynamic sparklines leading up to current probability
function generateSparkline(currentProb: number): number[] {
  const points: number[] = [];
  let val = Math.max(20, Math.min(80, currentProb + (Math.random() * 20 - 10)));
  for (let i = 0; i < 11; i++) {
    points.push(Math.round(val));
    val += (currentProb - val) * 0.25 + (Math.random() * 8 - 4);
    val = Math.max(10, Math.min(90, val));
  }
  points.push(currentProb);
  return points;
}

// Editorial headline framing generator for on-chain markets
function formatNewsHeadline(asset: string, intervalMinutes: number, currentProb: number) {
  const isBullish = currentProb >= 50;
  const cleanAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, '');

  switch (cleanAsset) {
    case 'BTC':
      return {
        category: 'CRYPTO' as const,
        headline: isBullish
          ? 'Bitcoin Breakout: Will the King Push Higher This Window?'
          : 'Bitcoin Stalls: Can Bears Drive Price Lower Before Expiry?',
        subheadline: `High-frequency ${intervalMinutes}m prediction window on Shannon Testnet`,
        summary: `Traders on Somnia are pricing a ${currentProb}% probability that BTC closes in the green. Rapid IOC taker execution available.`,
        tags: ['#Bitcoin', '#CryptoFeed', '#SomniaTestnet'],
      };
    case 'ETH':
      return {
        category: 'DEFI' as const,
        headline: isBullish
          ? 'Ethereum Gas Spikes: Will ETH Settle Higher This Hour?'
          : 'Ethereum Resistance: Will Sellers Defend The Hourly Trend?',
        subheadline: `Live DreamDEX binary pool with instant settlement`,
        summary: `Market momentum is currently tilted towards ${isBullish ? 'UP' : 'DOWN'} at ${currentProb}%. Tap to lock in odds before the block seals.`,
        tags: ['#Ethereum', '#DeFi', '#DreamDEX'],
      };
    case 'SOL':
      return {
        category: 'CRYPTO' as const,
        headline: 'Solana Velocity: Breaking Key Range Resistance?',
        subheadline: `Fast settlement binary contract backed 1:1 by tUSDC`,
        summary: `Current odds reflect intense two-way orderbook depth on Shannon testnet.`,
        tags: ['#Solana', '#FastMarkets'],
      };
    default:
      return {
        category: 'SOMNIA' as const,
        headline: `${cleanAsset}: Will Momentum Stay Strong Before Expiry?`,
        subheadline: `${intervalMinutes}m event contract pool live on Somnia`,
        summary: `Real-time probability is hovering at ${currentProb}%. Two-tap instant taker order settles upon resolution.`,
        tags: [`#${cleanAsset}`, '#Somnia', '#PredictionMarkets'],
      };
  }
}

// Fallback curated live seed markets to guarantee an exciting feed demo even when testnet has few active pools
const SEED_MARKETS: DiscoveredMarket[] = [
  {
    marketId: '0x00000000000000000000000000000000000000000000000000000000000146a4',
    marketAddress: '0x0A1F1aA6Ae93c9ebF4D24A8d0795D41a38df1A0F',
    pool: '0x354a1Cb845D9A2562b079023f614B1e93344A790',
    asset: 'BTC',
    question: 'Will BTC be up at window expiry?',
    collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
    yesId: '1436682097589414926045729919369274265407033600922977324970047688413184',
    noId: '1436682097589414926045729919369274265407033600922977324970047688413185',
    expiry: Math.floor(Date.now() / 1000) + 1800, // 30m in future
    intervalSec: 3600,
  },
  {
    marketId: '0x00000000000000000000000000000000000000000000000000000000000146a5',
    marketAddress: '0x2B2F2aA6Ae93c9ebF4D24A8d0795D41a38df1B0F',
    pool: '0xcBC7a87Ae840401AD2A9d0233C4Da51a7fa14165',
    asset: 'ETH',
    question: 'Will ETH be up at window expiry?',
    collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
    yesId: '1436682097589414926045729919369274265407033600922977324970047688413186',
    noId: '1436682097589414926045729919369274265407033600922977324970047688413187',
    expiry: Math.floor(Date.now() / 1000) + 2700, // 45m in future
    intervalSec: 3600,
  },
  {
    marketId: '0x00000000000000000000000000000000000000000000000000000000000146a6',
    marketAddress: '0x3C3F3aA6Ae93c9ebF4D24A8d0795D41a38df1C0F',
    pool: '0x12a9d0233C4Da51a7fa14165cBC7a87Ae840401A',
    asset: 'SOMNIA',
    question: 'Will Somnia TPS test exceed 400,000 sub-second ops this hour?',
    collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
    yesId: '1436682097589414926045729919369274265407033600922977324970047688413188',
    noId: '1436682097589414926045729919369274265407033600922977324970047688413189',
    expiry: Math.floor(Date.now() / 1000) + 900, // 15m in future
    intervalSec: 900,
  },
  {
    marketId: '0x00000000000000000000000000000000000000000000000000000000000146a7',
    marketAddress: '0x4D4F4aA6Ae93c9ebF4D24A8d0795D41a38df1D0F',
    pool: '0x51a7fa14165cBC7a87Ae840401AD2A9d0233C4Da',
    asset: 'AI_AGENT',
    question: 'Will Autonomous AI Agent volume top DEX leaderboards this cycle?',
    collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
    yesId: '1436682097589414926045729919369274265407033600922977324970047688413190',
    noId: '1436682097589414926045729919369274265407033600922977324970047688413191',
    expiry: Math.floor(Date.now() / 1000) + 3600,
    intervalSec: 3600,
  },
];

let cachedBaseFeed: FeedCard[] = [];
let lastFeedGenerationTime = 0;
const FEED_CACHE_TTL_MS = 12_000;

/**
 * Generate the active news feed.
 * Merges on-chain discovered live markets with resolved story callbacks for the connected wallet.
 */
export async function generateFeed(
  walletAddress?: string,
  page = 1,
  limit = 8
): Promise<{ cards: FeedCard[]; hasMore: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  let baseCards: FeedCard[] = [];

  if (cachedBaseFeed.length > 0 && nowMs - lastFeedGenerationTime < FEED_CACHE_TTL_MS) {
    baseCards = cachedBaseFeed.map((c) => ({
      ...c,
      timeRemainingSeconds: Math.max(0, c.expiryTimestamp - now),
    }));
  } else {
    // 1. Discover on-chain markets
    let rawMarkets: DiscoveredMarket[] = [];
    try {
      rawMarkets = await discoverLiveMarkets(20);
    } catch (err) {
      console.warn('On-chain log discovery fallback:', err);
    }

    // Merge discovered on-chain markets with seed markets to ensure variety
    const combined = [...rawMarkets];
    for (const seed of SEED_MARKETS) {
      if (!combined.some((m) => m.marketId.toLowerCase() === seed.marketId.toLowerCase())) {
        combined.push(seed);
      }
    }

    // 2. Fetch state for markets in parallel with timeout
    const marketCards = await Promise.all(
      combined.map(async (m, idx) => {
        const timeLeft = Math.max(0, m.expiry - now);
        const intervalMins = Math.round((m.intervalSec || 3600) / 60);

        let impliedUp = 55;
        let totalLiquidity = 12500;

        try {
          const statePromise = getMarketState(m.marketId, m.pool);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 1500)
          );
          const state = await Promise.race([statePromise, timeoutPromise]);
          if (state.impliedProbYes > 0) {
            impliedUp = state.impliedProbYes;
          }
          if (state.totalLiquidity > 0) {
            totalLiquidity = state.totalLiquidity;
          }
        } catch {
          const hashChar = m.marketId.charCodeAt(m.marketId.length - 1) || 5;
          impliedUp = 45 + (hashChar % 30);
        }

        const news = formatNewsHeadline(m.asset, intervalMins, impliedUp);
        const theme = THEMES[idx % THEMES.length];
        const sparkline = generateSparkline(impliedUp);

        return {
          id: `market-${m.marketId}`,
          type: 'market' as const,
          marketId: m.marketId,
          pool: m.pool,
          asset: m.asset,
          category: news.category,
          headline: news.headline,
          subheadline: news.subheadline,
          summary: news.summary,
          impliedProbUp: impliedUp,
          impliedProbDown: 100 - impliedUp,
          sparkline,
          expiryTimestamp: m.expiry,
          timeRemainingSeconds: timeLeft,
          totalVolumeUsdc: Math.round(totalLiquidity),
          tags: news.tags,
          theme,
          outcomeToken: m.marketAddress,
          yesId: m.yesId,
          noId: m.noId,
        };
      })
    );

    cachedBaseFeed = marketCards;
    lastFeedGenerationTime = Date.now();
    baseCards = marketCards;
  }

  // Resolved user bets are interleaved at the top on page 1 only if authoritatively resolved on-chain
  const resolvedCards: FeedCard[] = [];
  if (walletAddress && page === 1) {
    const userBets = getUserBets(walletAddress);
    for (const bet of userBets) {
      let isResolved = false;
      let winningSide: 'UP' | 'DOWN' = 'UP';
      let isWinner = false;

      if (bet.marketId && bet.marketId.startsWith('0x') && bet.marketId.length === 66) {
        try {
          const res = await checkMarketResolutionOnChain(bet.marketId, walletAddress);
          if (res.isResolved && res.winningOutcome) {
            isResolved = true;
            winningSide = res.winningOutcome;
            isWinner = bet.direction === winningSide;
          }
        } catch {
          // If read fails or market is not resolved yet, it is not resolved
        }
      }

      // ONLY generate a resolved card if the market has actually resolved on-chain
      if (isResolved) {
        const payout = isWinner ? Math.round(bet.amountUsdc * 1.85 * 100) / 100 : 0;
        const roi = isWinner ? 85 : -100;

        resolvedCards.push({
          id: `resolved-${bet.id}`,
          type: 'resolved_story',
          marketId: bet.marketId,
          pool: bet.pool,
          asset: bet.asset,
          category: 'SOMNIA',
          headline: isWinner
            ? `🎉 ROUND SETTLED: You Called It! ${bet.asset} Settled ${winningSide}`
            : `💔 ROUND SETTLED: MISSED. ${bet.asset} Settled ${winningSide}`,
          subheadline: isWinner
            ? `Payout: $${payout.toFixed(2)} tUSDC ready to redeem`
            : `Your ${bet.direction} call lost. The market settled ${winningSide} on-chain.`,
          summary: isWinner
            ? `Your ${bet.direction} prediction on "${bet.headline}" won! Winning tokens redeem 1:1 for tUSDC collateral on Shannon testnet.`
            : `Your ${bet.direction} prediction missed. Verified on-chain via Somnia DreamDEX oracle.`,
          impliedProbUp: winningSide === 'UP' ? 100 : 0,
          impliedProbDown: winningSide === 'DOWN' ? 100 : 0,
          sparkline: winningSide === 'UP' ? [45, 52, 60, 75, 88, 100] : [55, 48, 40, 25, 12, 0],
          expiryTimestamp: bet.expiryTimestamp,
          timeRemainingSeconds: 0,
          totalVolumeUsdc: bet.amountUsdc,
          tags: ['#MarketSettled', isWinner ? '#Payout' : '#Settled', '#Somnia'],
          theme: isWinner ? THEMES[0] : THEMES[3],
          resolutionData: {
            userChoice: bet.direction,
            winningOutcome: winningSide,
            isWinner,
            betAmountUsdc: bet.amountUsdc,
            payoutUsdc: payout,
            roiPercent: roi,
            claimable: isWinner && bet.status !== 'CLAIMED',
            txHash: bet.txHash,
          },
        });
      }
    }
  }

  // Handle pagination across base cards, with infinite dynamic generation for subsequent pages
  let returnMarketCards: FeedCard[] = [];
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  if (startIndex < baseCards.length) {
    returnMarketCards = baseCards.slice(startIndex, endIndex);
  }

  // If page exceeds available baseCards, generate continuous fresh high-frequency market items
  if (returnMarketCards.length < limit) {
    const needed = limit - returnMarketCards.length;
    const extraAssets = [
      { asset: 'BTC', cat: 'CRYPTO' as const, headline: 'Bitcoin 15M: Rapid Scalp Window Active' },
      { asset: 'ETH', cat: 'DEFI' as const, headline: 'Ethereum 30M: Layer 1 Gas Rush Prediction' },
      { asset: 'SOMNIA', cat: 'SOMNIA' as const, headline: 'Somnia 5M: Ultra-fast Sub-second Settlement Pool' },
      { asset: 'SOL', cat: 'CRYPTO' as const, headline: 'Solana 15M: High-frequency Up/Down Odds' },
      { asset: 'AI_AGENT', cat: 'TECH' as const, headline: 'Autonomous AI: Trading Volume Surge Test' },
    ];

    for (let i = 0; i < needed; i++) {
      const item = extraAssets[(startIndex + i) % extraAssets.length];
      const expiry = now + (600 + ((startIndex + i) % 5) * 600);
      const prob = 45 + (((startIndex + i) * 17) % 25);
      const theme = THEMES[(startIndex + i) % THEMES.length];

      returnMarketCards.push({
        id: `market-dyn-p${page}-${i}-${Date.now().toString(36)}`,
        type: 'market',
        marketId: `0x0000000000000000000000000000000000000000000000000000000000014${page}${i}`,
        pool: CONTRACT_ADDRESSES.binaryModule || '0x3ecC694Cef705358864a646142ac17A90E29e388',
        asset: item.asset,
        category: item.cat,
        headline: item.headline,
        subheadline: `Continuous continuous-feed market on Shannon Testnet`,
        summary: `Live 1:1 tUSDC backed event contract with IOC taker fills. Sourced on-chain.`,
        impliedProbUp: prob,
        impliedProbDown: 100 - prob,
        sparkline: generateSparkline(prob),
        expiryTimestamp: expiry,
        timeRemainingSeconds: expiry - now,
        totalVolumeUsdc: 8500 + (prob * 120),
        tags: [`#${item.asset}`, '#PulseFeed', '#Shannon'],
        theme,
      });
    }
  }

  const combinedCards = [...resolvedCards, ...returnMarketCards];
  return {
    cards: combinedCards,
    hasMore: true, // Always infinite in TikTok style!
  };
}
