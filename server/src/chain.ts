import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import {
  SomniaMarkets,
  probabilityToPrice,
  priceToProbability,
} from '@somnia-chain/markets-sdk';
import { createPublicClient, http, parseAbiItem, type Hex } from 'viem';
import {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  ONE_CONTRACT,
  SOMNIA_GAS_SETTINGS,
} from './config.js';

// MarketCreated event definition from DreamDEX BinaryModule
export const MARKET_CREATED_EVENT = {
  type: 'event',
  name: 'MarketCreated',
  inputs: [
    { name: 'marketId', type: 'bytes32', indexed: true },
    { name: 'market', type: 'address', indexed: true },
    { name: 'pool', type: 'address', indexed: true },
    { name: 'oracleQuestionId', type: 'uint256', indexed: false },
    { name: 'operatorId', type: 'uint32', indexed: false },
    { name: 'venueId', type: 'bytes32', indexed: false },
    { name: 'creator', type: 'address', indexed: false },
    { name: 'collateral', type: 'address', indexed: false },
    { name: 'yesId', type: 'uint256', indexed: false },
    { name: 'noId', type: 'uint256', indexed: false },
    { name: 'nonce', type: 'uint64', indexed: false },
    { name: 'outcomeSlotCount', type: 'uint8', indexed: false },
    { name: 'marketType', type: 'uint8', indexed: false },
    { name: 'tradingStart', type: 'uint64', indexed: false },
    { name: 'expiry', type: 'uint64', indexed: false },
    { name: 'voidPolicy', type: 'uint8', indexed: false },
    { name: 'asset', type: 'string', indexed: false },
    { name: 'strike', type: 'uint256', indexed: false },
    { name: 'question', type: 'string', indexed: false },
    { name: 'context', type: 'bytes', indexed: false },
  ],
  anonymous: false,
} as const;

// Read-only public client directly against Somnia Shannon testnet
export const publicClient = createPublicClient({
  chain: NETWORK_CONFIG.chain,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

// Cache for markets and orderbook
export interface DiscoveredMarket {
  marketId: string;
  marketAddress: string;
  pool: string;
  asset: string;
  question: string;
  collateral: string;
  yesId: string;
  noId: string;
  expiry: number; // Unix seconds
  intervalSec?: number;
  strike?: string;
}

export interface OnChainMarketState {
  marketId: string;
  pool: string;
  status: number; // 0 Listed, 1 Trading, 2 Locked, 3 Settling, 4 Resolved, 5 Voided
  finalized: boolean;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: number; // 0 = Yes/Up, 1 = No/Down
  outcomeToken: string;
  yesId: string;
  noId: string;
  expiry: number;
  bestBid: number; // probability (0 - 1)
  bestAsk: number; // probability (0 - 1)
  impliedProbYes: number; // 0 - 100%
  totalLiquidity: number;
}

// Fallback key if no private key provided in env (used strictly for read instances)
const DEFAULT_READ_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export function getMarketsSdk(privateKey?: string): SomniaMarkets {
  const key = privateKey && privateKey.startsWith('0x') && privateKey.length === 66
    ? (privateKey as Hex)
    : DEFAULT_READ_KEY;

  return new SomniaMarkets({
    chain: NETWORK_CONFIG.chain,
    addresses: CONTRACT_ADDRESSES,
    privateKey: key,
    wsRpcUrl: NETWORK_CONFIG.wsRpcUrl,
    indexerUrl: NETWORK_CONFIG.indexerUrl,
  });
}

// Singleton read-only SDK client
export const readSdk = getMarketsSdk();

let cachedDiscoveredMarkets: DiscoveredMarket[] = [];
let lastDiscoveryTime = 0;
const DISCOVERY_CACHE_TTL_MS = 15_000;

/**
 * Discover live binary markets by scanning on-chain `MarketCreated` logs.
 * Walks backwards in windows of 1,000 blocks to comply with Somnia RPC limits.
 * Filters strictly by testnet tUSDC collateral.
 */
export async function discoverLiveMarkets(maxWindows = 25): Promise<DiscoveredMarket[]> {
  const now = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  if (cachedDiscoveredMarkets.length > 0 && nowMs - lastDiscoveryTime < DISCOVERY_CACHE_TTL_MS) {
    return cachedDiscoveredMarkets.filter((m) => m.expiry > now);
  }

  const head = await publicClient.getBlockNumber();
  const foundLogs: any[] = [];

  for (let i = 0; i < maxWindows; i++) {
    const to = head - BigInt(i * 1000);
    if (to <= 0n) break;
    const from = to > 999n ? to - 999n : 0n;

    try {
      const logs = await publicClient.getLogs({
        event: MARKET_CREATED_EVENT as any,
        fromBlock: from,
        toBlock: to,
      });
      foundLogs.push(...logs.map((l: any) => l.args));
    } catch {
      // Best-effort scan continuation if a block range fails
    }
  }

  const targetCollateral = CONTRACT_ADDRESSES.testUsdc.toLowerCase();

  // Deduplicate and filter by expiry and collateral
  const marketMap = new Map<string, DiscoveredMarket>();
  for (const m of foundLogs) {
    if (!m || !m.marketId) continue;
    const marketIdStr = String(m.marketId);
    const collateralStr = (m.collateral || '').toLowerCase();
    const expiryNum = Number(m.expiry || 0);

    if (collateralStr === targetCollateral && expiryNum > now) {
      if (!marketMap.has(marketIdStr)) {
        marketMap.set(marketIdStr, {
          marketId: marketIdStr,
          marketAddress: m.market,
          pool: m.pool,
          asset: m.asset || 'CRYPTO',
          question: m.question || `Will ${m.asset || 'Asset'} be up at window expiry?`,
          collateral: m.collateral,
          yesId: String(m.yesId),
          noId: String(m.noId),
          expiry: expiryNum,
          strike: m.strike ? String(m.strike) : undefined,
        });
      }
    }
  }

  // Sort by expiry ascending (shortest window first for quick resolution demo)
  const sorted = Array.from(marketMap.values()).sort((a, b) => a.expiry - b.expiry);
  cachedDiscoveredMarkets = sorted;
  lastDiscoveryTime = Date.now();
  return sorted;
}

/**
 * Read real-time on-chain state and orderbook for a specific market.
 */
export async function getMarketState(marketId: string, poolAddress: string): Promise<OnChainMarketState> {
  try {
    const mo = await readSdk.client.getMarketOnchain(marketId as Hex);
    const pool = (poolAddress || mo.pool) as Hex;

    let bestBid = 0;
    let bestAsk = 1;
    let totalLiquidity = 0;

    try {
      const [bids, asks] = await Promise.all([
        readSdk.client.getAllOpenOrdersOnchain(pool, { isBid: true }),
        readSdk.client.getAllOpenOrdersOnchain(pool, { isBid: false }),
      ]);

      const bidPrices = (bids.orders || []).map((o: any) => Number(o.price) / 1e6);
      const askPrices = (asks.orders || []).map((o: any) => Number(o.price) / 1e6);

      if (bidPrices.length > 0) {
        bestBid = Math.max(...bidPrices);
      }
      if (askPrices.length > 0) {
        bestAsk = Math.min(...askPrices);
      }

      for (const o of [...(bids.orders || []), ...(asks.orders || [])]) {
        totalLiquidity += Number(o.quantityRemaining || 0) / 1e6;
      }
    } catch (orderErr) {
      // Orderbook read fallback
    }

    // Determine implied probability
    let impliedProb = 0.5;
    if (bestBid > 0 && bestAsk < 1 && bestAsk >= bestBid) {
      impliedProb = (bestBid + bestAsk) / 2;
    } else if (bestBid > 0) {
      impliedProb = Math.min(0.95, bestBid + 0.05);
    } else if (bestAsk < 1) {
      impliedProb = Math.max(0.05, bestAsk - 0.05);
    }

    return {
      marketId,
      pool,
      status: mo.status,
      finalized: !!mo.finalized,
      isResolved: !!mo.isResolved,
      isVoided: !!mo.isVoided,
      winningOutcome: Number(mo.winningOutcome || 0),
      outcomeToken: mo.outcomeToken,
      yesId: String(mo.yesId),
      noId: String(mo.noId),
      expiry: Number(mo.expiry),
      bestBid,
      bestAsk,
      impliedProbYes: Math.round(impliedProb * 100),
      totalLiquidity,
    };
  } catch (err: any) {
    throw new Error(`Failed to read market ${marketId}: ${err.message}`);
  }
}

/**
 * Read outcome token balances for a wallet
 */
export async function getWalletBalances(
  walletAddress: string,
  outcomeToken: string,
  yesId: string,
  noId: string
): Promise<{ yesBalance: number; noBalance: number }> {
  try {
    const [yesBal, noBal] = await Promise.all([
      readSdk.client.getOutcomeBalance({
        outcomeToken: outcomeToken as Hex,
        account: walletAddress as Hex,
        id: BigInt(yesId),
      }),
      readSdk.client.getOutcomeBalance({
        outcomeToken: outcomeToken as Hex,
        account: walletAddress as Hex,
        id: BigInt(noId),
      }),
    ]);

    return {
      yesBalance: Number(yesBal) / 1e6,
      noBalance: Number(noBal) / 1e6,
    };
  } catch {
    return { yesBalance: 0, noBalance: 0 };
  }
}

/**
 * Place an instant IOC (Immediate-or-Cancel) taker order for the two-tap feed bet.
 */
export async function placeBetOrder(params: {
  privateKey: string;
  pool: string;
  direction: 'UP' | 'DOWN'; // UP = BUY_YES, DOWN = BUY_NO
  amountUsdc: number; // Bet size in USDC (e.g., 1, 5, 20)
  maxSlippagePrice?: number; // Target price probability threshold
}): Promise<{ txHash?: string; fillPrice?: number; quantityFilled?: number; orderId?: string }> {
  const sdk = getMarketsSdk(params.privateKey);
  const side = params.direction === 'UP' ? 'BUY_YES' : 'BUY_NO';

  // For immediate taker fill in a feed, price aggressively so it crosses the resting asks
  const takerPriceProb = params.maxSlippagePrice || 0.99;
  const price = probabilityToPrice(takerPriceProb);
  const quantity = BigInt(Math.round(params.amountUsdc * 1e6));

  try {
    // orderType: 2 = IOC (taker, must cross immediately)
    const orderRes = await sdk.trader.placeOrder({
      pool: params.pool as Hex,
      side,
      price,
      quantity,
      orderType: 2,
    });

    const fill = (orderRes.fills || [])[0];
    return {
      txHash: orderRes.hash,
      fillPrice: fill ? Number(fill.fillPrice) / 1e6 : undefined,
      quantityFilled: fill ? Number(fill.quantityFilled) / 1e6 : undefined,
      orderId: orderRes.orderId ? String(orderRes.orderId) : undefined,
    };
  } catch (err: any) {
    const msg = err.shortMessage || err.message || 'Trade execution failed';
    throw new Error(`Bet order failed: ${msg}`);
  }
}

/**
 * Redeem winning outcome tokens for collateral (1:1 tUSDC) after market resolution.
 */
export async function redeemWinningOutcome(params: {
  privateKey: string;
  marketId: string;
  outcomeIdx: number; // 0 for UP/YES, 1 for DOWN/NO
  amount: number; // Outcome amount in whole tokens
}): Promise<{ txHash?: string }> {
  const sdk = getMarketsSdk(params.privateKey);
  const baseAmount = BigInt(Math.round(params.amount * 1e6));

  const res = await sdk.trader.redeem({
    marketId: params.marketId as Hex,
    outcomeIdx: (params.outcomeIdx === 1 ? 1 : 0) as 0 | 1,
    amount: baseAmount,
  });

  return { txHash: res.hash };
}

/**
 * Mint outcome token pairs (1 tUSDC -> 1 UP + 1 DOWN)
 */
export async function mintOutcomeSet(params: {
  privateKey: string;
  pool: string;
  amountUsdc: number;
}): Promise<{ txHash?: string }> {
  const sdk = getMarketsSdk(params.privateKey);
  const amount = BigInt(Math.round(params.amountUsdc * 1e6));

  const res = await sdk.trader.mintSet({
    pool: params.pool as Hex,
    amount,
  });

  return { txHash: res.hash };
}
