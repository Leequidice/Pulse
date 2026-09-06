import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { SomniaMarkets, probabilityToPrice, } from '@somnia-chain/markets-sdk';
import { createPublicClient, http, fallback } from 'viem';
import { NETWORK_CONFIG, CONTRACT_ADDRESSES, } from './config.js';
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
};
// Read-only public client directly against Somnia Shannon testnet with RPC fallback
export const publicClient = createPublicClient({
    chain: NETWORK_CONFIG.chain,
    transport: fallback([
        http(NETWORK_CONFIG.rpcUrl, { retryCount: 2, timeout: 10_000 }),
        http('https://50312.rpc.thirdweb.com', { retryCount: 2, timeout: 10_000 }),
    ]),
});
// Fallback key if no private key provided in env (used strictly for read instances)
const DEFAULT_READ_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export function getMarketsSdk(privateKey) {
    const key = privateKey && privateKey.startsWith('0x') && privateKey.length === 66
        ? privateKey
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
let cachedDiscoveredMarkets = [];
let lastDiscoveryTime = 0;
const DISCOVERY_CACHE_TTL_MS = 15_000;
/**
 * Discover live binary markets by scanning on-chain `MarketCreated` logs.
 * Walks backwards in windows of 1,000 blocks to comply with Somnia RPC limits.
 * Filters strictly by testnet tUSDC collateral.
 */
export async function discoverLiveMarkets(maxWindows = 25) {
    const now = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();
    if (cachedDiscoveredMarkets.length > 0 && nowMs - lastDiscoveryTime < DISCOVERY_CACHE_TTL_MS) {
        return cachedDiscoveredMarkets.filter((m) => m.expiry > now);
    }
    const head = await publicClient.getBlockNumber();
    const foundLogs = [];
    for (let i = 0; i < maxWindows; i++) {
        const to = head - BigInt(i * 1000);
        if (to <= 0n)
            break;
        const from = to > 999n ? to - 999n : 0n;
        try {
            const logs = await publicClient.getLogs({
                event: MARKET_CREATED_EVENT,
                fromBlock: from,
                toBlock: to,
            });
            foundLogs.push(...logs.map((l) => l.args));
        }
        catch {
            // Best-effort scan continuation if a block range fails
        }
    }
    const targetCollateral = CONTRACT_ADDRESSES.testUsdc.toLowerCase();
    // Deduplicate and filter by expiry and collateral
    const marketMap = new Map();
    for (const m of foundLogs) {
        if (!m || !m.marketId)
            continue;
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
export async function getMarketState(marketId, poolAddress) {
    try {
        const mo = await readSdk.client.getMarketOnchain(marketId);
        const pool = (poolAddress || mo.pool);
        let bestBid = 0;
        let bestAsk = 1;
        let totalLiquidity = 0;
        try {
            const [bids, asks] = await Promise.all([
                readSdk.client.getAllOpenOrdersOnchain(pool, { isBid: true }),
                readSdk.client.getAllOpenOrdersOnchain(pool, { isBid: false }),
            ]);
            const bidPrices = (bids.orders || []).map((o) => Number(o.price) / 1e6);
            const askPrices = (asks.orders || []).map((o) => Number(o.price) / 1e6);
            if (bidPrices.length > 0) {
                bestBid = Math.max(...bidPrices);
            }
            if (askPrices.length > 0) {
                bestAsk = Math.min(...askPrices);
            }
            for (const o of [...(bids.orders || []), ...(asks.orders || [])]) {
                totalLiquidity += Number(o.quantityRemaining || 0) / 1e6;
            }
        }
        catch (orderErr) {
            // Orderbook read fallback
        }
        // Determine implied probability
        let impliedProb = 0.5;
        if (bestBid > 0 && bestAsk < 1 && bestAsk >= bestBid) {
            impliedProb = (bestBid + bestAsk) / 2;
        }
        else if (bestBid > 0) {
            impliedProb = Math.min(0.95, bestBid + 0.05);
        }
        else if (bestAsk < 1) {
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
    }
    catch (err) {
        throw new Error(`Failed to read market ${marketId}: ${err.message}`);
    }
}
const ERC20_BALANCE_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
];
/**
 * Pre-flight on-chain verification that wallet holds sufficient tUSDC and STT gas.
 */
export async function checkWalletCanBet(walletAddress, amountUsdc) {
    try {
        const [sttWei, usdcUnits] = await Promise.all([
            publicClient.getBalance({ address: walletAddress }),
            publicClient.readContract({
                address: CONTRACT_ADDRESSES.testUsdc,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [walletAddress],
            }),
        ]);
        const sttBalance = Number(sttWei) / 1e18;
        const usdcBalance = Number(usdcUnits) / 1e6;
        if (usdcBalance < amountUsdc) {
            return {
                canBet: false,
                usdcBalance,
                sttBalance,
                error: `Insufficient tUSDC balance. You have ${usdcBalance.toFixed(2)} tUSDC, but the bet requires ${amountUsdc.toFixed(2)} tUSDC. Please fund your wallet.`,
            };
        }
        if (sttBalance < 0.0005) {
            return {
                canBet: false,
                usdcBalance,
                sttBalance,
                error: `Insufficient STT for gas. You have ${sttBalance.toFixed(4)} STT. Please claim STT from the Somnia faucet to pay network gas fees.`,
            };
        }
        return {
            canBet: true,
            usdcBalance,
            sttBalance,
        };
    }
    catch (err) {
        return {
            canBet: false,
            usdcBalance: 0,
            sttBalance: 0,
            error: `Failed to verify on-chain balances: ${err.message}`,
        };
    }
}
/**
 * Authoritatively check if a market has been resolved by the oracle on-chain.
 */
export async function checkMarketResolutionOnChain(marketId, walletAddress) {
    const mo = await readSdk.client.getMarketOnchain(marketId);
    const isResolved = Boolean(mo.isResolved);
    const winningOutcomeIdx = Number(mo.winningOutcome || 0);
    const winningOutcome = isResolved
        ? (winningOutcomeIdx === 0 ? 'UP' : 'DOWN')
        : null;
    let userWinningBalance = 0;
    if (walletAddress && isResolved) {
        try {
            const targetId = winningOutcomeIdx === 0 ? mo.yesId : mo.noId;
            const bal = await readSdk.client.getOutcomeBalance({
                outcomeToken: mo.outcomeToken,
                account: walletAddress,
                id: targetId,
            });
            userWinningBalance = Number(bal) / 1e6;
        }
        catch {
            userWinningBalance = 0;
        }
    }
    return {
        marketId,
        isResolved,
        isVoided: Boolean(mo.isVoided),
        winningOutcome,
        winningOutcomeIdx,
        outcomeToken: mo.outcomeToken,
        yesId: String(mo.yesId),
        noId: String(mo.noId),
        userWinningBalance,
    };
}
/**
 * Read outcome token balances for a wallet
 */
export async function getWalletBalances(walletAddress, outcomeToken, yesId, noId) {
    try {
        const [yesBal, noBal] = await Promise.all([
            readSdk.client.getOutcomeBalance({
                outcomeToken: outcomeToken,
                account: walletAddress,
                id: BigInt(yesId),
            }),
            readSdk.client.getOutcomeBalance({
                outcomeToken: outcomeToken,
                account: walletAddress,
                id: BigInt(noId),
            }),
        ]);
        return {
            yesBalance: Number(yesBal) / 1e6,
            noBalance: Number(noBal) / 1e6,
        };
    }
    catch {
        return { yesBalance: 0, noBalance: 0 };
    }
}
/**
 * Place an instant IOC (Immediate-or-Cancel) taker order for the two-tap feed bet.
 */
export async function placeBetOrder(params) {
    const sdk = getMarketsSdk(params.privateKey);
    const side = params.direction === 'UP' ? 'BUY_YES' : 'BUY_NO';
    // For immediate taker fill in a feed, price aggressively so it crosses the resting asks
    const takerPriceProb = params.maxSlippagePrice || 0.99;
    const price = probabilityToPrice(takerPriceProb);
    const quantity = BigInt(Math.round(params.amountUsdc * 1e6));
    try {
        // orderType: 2 = IOC (taker, must cross immediately)
        const orderRes = await sdk.trader.placeOrder({
            pool: params.pool,
            side,
            price,
            quantity,
            orderType: 2,
        });
        if (!orderRes.hash) {
            throw new Error('On-chain order transaction did not return a valid transaction hash');
        }
        const fill = (orderRes.fills || [])[0];
        return {
            txHash: orderRes.hash,
            fillPrice: fill ? Number(fill.fillPrice) / 1e6 : undefined,
            quantityFilled: fill ? Number(fill.quantityFilled) / 1e6 : undefined,
            orderId: orderRes.orderId ? String(orderRes.orderId) : undefined,
        };
    }
    catch (err) {
        const msg = err.shortMessage || err.message || 'Trade execution failed';
        throw new Error(`Bet order failed: ${msg}`);
    }
}
/**
 * Redeem winning outcome tokens for collateral (1:1 tUSDC) after market resolution.
 */
export async function redeemWinningOutcome(params) {
    const sdk = getMarketsSdk(params.privateKey);
    const baseAmount = BigInt(Math.round(params.amount * 1e6));
    const res = await sdk.trader.redeem({
        marketId: params.marketId,
        outcomeIdx: (params.outcomeIdx === 1 ? 1 : 0),
        amount: baseAmount,
    });
    if (!res.hash) {
        throw new Error('On-chain redemption transaction did not return a valid transaction hash');
    }
    return { txHash: res.hash };
}
/**
 * Mint outcome token pairs (1 tUSDC -> 1 UP + 1 DOWN)
 */
export async function mintOutcomeSet(params) {
    const sdk = getMarketsSdk(params.privateKey);
    const amount = BigInt(Math.round(params.amountUsdc * 1e6));
    const res = await sdk.trader.mintSet({
        pool: params.pool,
        amount,
    });
    return { txHash: res.hash };
}
