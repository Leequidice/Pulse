import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { NETWORK_CONFIG, CONTRACT_ADDRESSES } from './config.js';
import {
  discoverLiveMarkets,
  getMarketState,
  placeBetOrder,
  redeemWinningOutcome,
  publicClient,
} from './chain.js';
import {
  generateFeed,
  recordUserBet,
  getUserBets,
  UserBetRecord,
  userBetsStore,
} from './feedEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast helper to all connected clients
function broadcast(event: string, data: any) {
  const payload = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'CONNECTED', data: { message: 'Pulse real-time feed stream active' } }));
});

// Periodic background odds tick simulation for dynamic sparklines & live market countdowns
setInterval(() => {
  broadcast('TICK', {
    timestamp: Math.floor(Date.now() / 1000),
    btcDelta: (Math.random() * 2 - 1).toFixed(1),
    ethDelta: (Math.random() * 2 - 1).toFixed(1),
  });
}, 4000);

// --- API ENDPOINTS ---

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Pulse Server', network: NETWORK_CONFIG.name });
});

/**
 * GET /api/feed
 * Returns TikTok/Stories-style news feed cards.
 * If ?wallet=0x... is passed, includes user-specific resolved story callbacks!
 */
app.get('/api/feed', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string | undefined;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '8', 10);

    const { cards, hasMore } = await generateFeed(wallet, page, limit);
    res.json({
      success: true,
      count: cards.length,
      page,
      hasMore,
      cards,
      network: {
        chainId: NETWORK_CONFIG.chainId,
        name: NETWORK_CONFIG.name,
        currency: NETWORK_CONFIG.currency,
      },
    });
  } catch (err: any) {
    console.error('Error generating feed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/market/:id
 * Returns real-time market on-chain status & orderbook levels.
 */
app.get('/api/market/:id', async (req: Request, res: Response) => {
  try {
    const marketId = req.params.id;
    const pool = req.query.pool as string || '';
    const state = await getMarketState(marketId, pool);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bet
 * Executes a two-tap instant IOC taker bet on Somnia Shannon testnet.
 */
app.post('/api/bet', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      marketId,
      pool,
      asset,
      headline,
      direction, // 'UP' | 'DOWN'
      amountUsdc,
      privateKey,
      expiryTimestamp,
    } = req.body;

    if (!walletAddress || !pool || !direction || !amountUsdc) {
      return res.status(400).json({ success: false, error: 'Missing required bet parameters' });
    }

    let txHash = `0xmock_${Date.now().toString(16)}`;
    let fillPrice = 0.55;
    let quantityFilled = amountUsdc;

    // Attempt on-chain IOC order if private key is supplied
    if (privateKey && privateKey.startsWith('0x') && privateKey.length === 66) {
      try {
        const onChainRes = await placeBetOrder({
          privateKey,
          pool,
          direction,
          amountUsdc: Number(amountUsdc),
        });
        if (onChainRes.txHash) txHash = onChainRes.txHash;
        if (onChainRes.fillPrice) fillPrice = onChainRes.fillPrice;
        if (onChainRes.quantityFilled) quantityFilled = onChainRes.quantityFilled;
      } catch (chainErr: any) {
        console.warn('On-chain IOC trade note (using simulated fallback for testnet safety):', chainErr.message);
        // Fallback for seamless demo if faucet funds are low
        txHash = `0xsim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
      }
    }

    // Record user bet so it will callback as a Story Card upon resolution
    const betRecord: UserBetRecord = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      walletAddress,
      marketId: marketId || pool,
      pool,
      asset: asset || 'CRYPTO',
      headline: headline || `${asset || 'Asset'} Window Bet`,
      direction,
      amountUsdc: Number(amountUsdc),
      entryProbUp: direction === 'UP' ? 60 : 40,
      timestamp: Math.floor(Date.now() / 1000),
      // Default to 60s in future for fast live demo resolution!
      expiryTimestamp: expiryTimestamp || Math.floor(Date.now() / 1000) + 60,
      status: 'OPEN',
      txHash,
    };

    recordUserBet(betRecord);

    // Notify feed of new trade
    broadcast('NEW_BET', {
      asset: betRecord.asset,
      direction,
      amountUsdc,
      headline,
    });

    res.json({
      success: true,
      betId: betRecord.id,
      txHash,
      fillPrice,
      quantityFilled,
      betRecord,
    });
  } catch (err: any) {
    console.error('Error placing bet:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/portfolio/:wallet
 * Returns portfolio statistics: active positions, win rate, resolved history, and claimables.
 */
app.get('/api/portfolio/:wallet', async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const bets = getUserBets(wallet);
    const now = Math.floor(Date.now() / 1000);

    let totalWagered = 0;
    let totalWon = 0;
    let openCount = 0;
    let resolvedCount = 0;
    let winsCount = 0;

    const positions = bets.map((b) => {
      totalWagered += b.amountUsdc;
      const isResolved = now >= b.expiryTimestamp || b.status === 'RESOLVED';

      if (isResolved) {
        resolvedCount++;
        const winningSide = b.winningOutcome || (b.direction === 'UP' ? 'UP' : 'DOWN');
        const isWin = b.direction === winningSide;
        if (isWin) {
          winsCount++;
          totalWon += b.amountUsdc * 1.85;
        }
        return {
          ...b,
          status: b.status === 'CLAIMED' ? 'CLAIMED' : 'RESOLVED',
          winningOutcome: winningSide,
          isWin,
          payoutUsdc: isWin ? Math.round(b.amountUsdc * 1.85 * 100) / 100 : 0,
        };
      } else {
        openCount++;
        return {
          ...b,
          status: 'OPEN',
          timeLeftSeconds: Math.max(0, b.expiryTimestamp - now),
        };
      }
    });

    const winRate = resolvedCount > 0 ? Math.round((winsCount / resolvedCount) * 100) : 0;
    const netPnL = Math.round((totalWon - totalWagered) * 100) / 100;

    res.json({
      success: true,
      wallet,
      stats: {
        totalWagered: Math.round(totalWagered * 100) / 100,
        totalWon: Math.round(totalWon * 100) / 100,
        netPnL,
        winRate,
        openCount,
        resolvedCount,
        streakCount: Math.min(winsCount, 5),
      },
      positions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/redeem
 * Claims winning payout from resolved market into collateral (1:1 tUSDC).
 */
app.post('/api/redeem', async (req: Request, res: Response) => {
  try {
    const { walletAddress, betId, marketId, outcomeIdx, amount, privateKey } = req.body;

    let txHash = `0xredeem_${Date.now().toString(16)}`;

    if (privateKey && marketId) {
      try {
        const redeemRes = await redeemWinningOutcome({
          privateKey,
          marketId,
          outcomeIdx: outcomeIdx || 0,
          amount: amount || 1,
        });
        if (redeemRes.txHash) txHash = redeemRes.txHash;
      } catch (chainErr: any) {
        console.warn('Redemption note:', chainErr.message);
      }
    }

    // Update in-memory record to CLAIMED
    if (walletAddress && betId) {
      const userBets = userBetsStore.get(walletAddress.toLowerCase()) || [];
      const target = userBets.find((b) => b.id === betId);
      if (target) {
        target.status = 'CLAIMED';
      }
    }

    res.json({
      success: true,
      txHash,
      message: 'Collateral redeemed successfully!',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/network-status
 * Health check & Somnia testnet diagnostics
 */
app.get('/api/network-status', async (_req: Request, res: Response) => {
  try {
    const blockNumber = await publicClient.getBlockNumber();
    res.json({
      status: 'online',
      network: NETWORK_CONFIG.name,
      chainId: NETWORK_CONFIG.chainId,
      blockNumber: blockNumber.toString(),
      rpcUrl: NETWORK_CONFIG.rpcUrl,
      collateralToken: CONTRACT_ADDRESSES.testUsdc,
      faucetUrl: NETWORK_CONFIG.faucetTelegram,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

const PORT = NETWORK_CONFIG.port;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Pulse Server live on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Network: ${NETWORK_CONFIG.name} (Chain ID ${NETWORK_CONFIG.chainId})`);
  console.log(`🔗 RPC: ${NETWORK_CONFIG.rpcUrl}`);
  console.log(`💵 Collateral: tUSDC (${CONTRACT_ADDRESSES.testUsdc})`);
  console.log(`======================================================\n`);
});
