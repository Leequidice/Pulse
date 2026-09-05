import { API_BASE_URL } from './constants';
import { FeedCard, PortfolioStats, UserBetRecord } from '../types';

export async function fetchFeed(
  walletAddress?: string,
  page = 1,
  limit = 8
): Promise<{ cards: FeedCard[]; hasMore: boolean; page: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (walletAddress) {
    params.set('wallet', walletAddress);
  }

  const res = await fetch(`${API_BASE_URL}/feed?${params.toString()}`);
  if (!res.ok) throw new Error(`Feed request failed: ${res.statusText}`);
  const data = await res.json();
  return {
    cards: data.cards || [],
    hasMore: data.hasMore ?? true,
    page: data.page || page,
  };
}

export async function placeBet(params: {
  walletAddress: string;
  marketId: string;
  pool: string;
  asset: string;
  headline: string;
  direction: 'UP' | 'DOWN';
  amountUsdc: number;
  privateKey?: string;
  expiryTimestamp?: number;
}): Promise<{ success: boolean; txHash: string; betId: string; fillPrice: number }> {
  const res = await fetch(`${API_BASE_URL}/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to place bet');
  }

  return await res.json();
}

export async function fetchPortfolio(walletAddress: string): Promise<{
  stats: PortfolioStats;
  positions: UserBetRecord[];
}> {
  const res = await fetch(`${API_BASE_URL}/portfolio/${encodeURIComponent(walletAddress)}`);
  if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.statusText}`);
  const data = await res.json();
  return {
    stats: data.stats,
    positions: data.positions || [],
  };
}

export async function redeemBet(params: {
  walletAddress: string;
  betId: string;
  marketId: string;
  outcomeIdx: number;
  amount: number;
  privateKey?: string;
}): Promise<{ success: boolean; txHash: string }> {
  const res = await fetch(`${API_BASE_URL}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Redemption failed');
  }

  return await res.json();
}
