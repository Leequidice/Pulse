# ⚡ Pulse — Prediction Markets as a News Feed

[![Somnia Shannon Testnet](https://img.shields.io/badge/Somnia_Shannon-Chain_50312-00FFA3?style=for-the-badge&logo=ethereum)](https://shannon-explorer.somnia.network)
[![DreamDEX Event Contracts](https://img.shields.io/badge/DreamDEX-Event_Contracts-7928CA?style=for-the-badge)](https://docs.dreamdex.io/developers/event-contracts)
[![Collateral tUSDC](https://img.shields.io/badge/Collateral-tUSDC-00F0FF?style=for-the-badge)](https://shannon-explorer.somnia.network/token/0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E)

**Pulse** turns **DreamDEX Event Contracts** into a scrollable, TikTok/Instagram Stories-style news feed on the **Somnia Shannon Testnet**. 

Instead of a complex trading terminal with dense order books and candlestick charts, each prediction market appears as an engaging headline story card — complete with implied probability percentages, live odds-history sparklines, countdown clocks, and a seamless two-tap **UP / DOWN** bet flow.

Built for the **Somnia × DreamDEX Event Contracts Hackathon**.

---

## 🌟 Why Pulse?

- **Innovation**: Reframes prediction market discovery from financial trading into **content consumption**. Users scroll through breaking events and price trends just like a social news feed.
- **Frictionless UX**: Two-tap betting without order-book jargon. Tapping UP or DOWN opens a clean bet sheet ($1 / $5 / $20 / custom) and executes an instant **IOC (Immediate-or-Cancel)** taker order against the on-chain book.
- **Feed Story Callbacks**: When an event a user bet on resolves, it resurfaces into their feed as an interactive celebration story (*"🎉 You called it! Won $9.25 (+85% ROI)"*) with 1-tap payout redemption.
- **Embedded Burner Wallet**: Users can bet instantly on every swipe without annoying wallet signature popups interrupting their feed flow (with full support for MetaMask/Injected wallets as well).

---

## 🔄 Core Product Loop

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Open Feed    │ ────▶ │ 2. Read Story   │ ────▶ │ 3. Two-Tap Bet  │
│ Full-screen     │       │ Headline, odds  │       │ Preset $1/$5/$20│
│ story cards     │       │ sparkline, timer│       │ Instant IOC fill│
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
┌─────────────────┐       ┌─────────────────┐                │
│ 6. Round Settled│ ◀───│ 5. Market Settles│ ◀──────────────┘
│ Won/lost card   │       │ On-chain 1:1    │       4. User swipes up
│ 1-tap redemption│       │ tUSDC collateral│       when ready!
└─────────────────┘       └─────────────────┘
```

1. **Scroll Live Markets**: Users swipe vertically through continuous live event contract windows (BTC, ETH, SOL, Macro, Ecosystem) using pure CSS scroll-snap.
2. **Read Odds at a Glance**: Punchy headlines, implied probability percentage (`64% UP`), and live SVG odds sparklines.
3. **Two-Tap Betting**: Tap UP or DOWN → choose amount ($1, $5, $20) → confirm instant IOC taker order.
4. **User-Paced Flow**: Order confirms with celebration in place; users swipe up whenever they are ready without artificial timers.
5. **Portfolio & Win Rate**: Bottom nav provides access to open positions, win rate %, and settled history.
6. **Interleaved Round Callbacks**: When a wagered window closes, a celebratory card appears directly in the feed with a 1-tap "Claim Payout" button.

---

## 🏗️ Architecture

```
                          ┌─────────────────────────────┐
                          │   Pulse Client (React/Vite) │
                          │  - Vertical Snap Feed       │
                          │  - Story Cards & Sparklines │
                          │  - 2-Tap Bet Sheet (IOC)    │
                          │  - Story Callbacks & Claim  │
                          │  - Burner / MetaMask Wallet │
                          └──────────────┬──────────────┘
                                         │ HTTP & WebSocket
                                         ▼
                          ┌─────────────────────────────┐
                          │   Pulse Server (Node/TS)    │
                          │  - MarketCreated Log Scanner│
                          │  - News Headline Transformer│
                          │  - Implied Odds Engine      │
                          │  - User Bet & Callback Hub  │
                          └──────────────┬──────────────┘
                                         │ @somnia-chain/markets-sdk
                                         ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                     Somnia Shannon Testnet (Chain 50312)                │
    │  - BinaryModule: 0x3ecC694Cef705358864a646142ac17A90E29e388           │
    │  - Collateral: tUSDC (0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E)      │
    │  - Gas Token: STT (Sub-second finality, Cancun + EIP-1559)             │
    └────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Technical Foundation & Somnia Gotchas Built-In

Pulse adheres strictly to the official starter template and DreamDEX SDK guidelines:

1. **Independent On-Chain Discovery**: Discovers markets by scanning `MarketCreated` logs via `publicClient.getLogs` in 1,000-block windows backwards. Pulse operates seamlessly even when the GraphQL indexer is offline.
2. **Strict Collateral Scoping**: Filters markets by testnet `tUSDC` (`0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`), ensuring users only see markets they can fund and trade.
3. **Status & Expiry Verification**: Validates `mo.status === 1` and `finalized === false` on-chain before accepting any order.
4. **Instant IOC Taker Orders**: Two-tap bets use `orderType = 2` (IOC) priced to immediately cross resting book asks, eliminating waiting periods for feed users.
5. **Somnia Gas Headroom**: Accounts for Somnia’s ~6 gwei base fee floor and Cancun transient storage dynamics by setting dynamic gas headroom.
6. **Price & Quantity Precision**: Enforces 1e6 scaling factor (`1 USDC = 1_000_000n`, probability `0.90 = 900000n`).

---

## 🚀 Quick Start

### Prerequisites
- Node.js `v20.0+` or `v24.0+`
- npm `v10.0+`

### 1. Clone & Install

```bash
git clone <your-repo-url> Pulse
cd Pulse

# Install root, server, and client dependencies
npm run install:all
```

### 2. Configure Environment

The repository includes pre-configured `.env` files for Somnia Shannon testnet:

```bash
# Server configuration (server/.env)
RPC_URL=https://api.infra.testnet.somnia.network
WS_RPC_URL=wss://api.infra.testnet.somnia.network/ws
INDEXER_URL=https://dev.smk.somnia.host/v1/graphql
PORT=3001
```

### 3. Run Locally

```bash
# Run both Backend and Frontend concurrently
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`

---

## 💧 Faucet Instructions (STT Gas + tUSDC Collateral)

To place live on-chain bets on Shannon testnet:

1. Join the official **SomniaHacks Dev Group**: [https://t.me/+XHq0F0JXMyhmMzM0](https://t.me/+XHq0F0JXMyhmMzM0).
2. Navigate to the **#faucet topic**.
3. Send your wallet address (from the Pulse app's top bar or Wallet modal).
4. You will receive **testnet STT** (for gas) and **tUSDC** (for collateral).
5. In Pulse, you can also import a funded private key via the **Wallet modal** (`Wallet → Export / Import Private Key`).

---

## 🎬 2–3 Minute Demo Video Walkthrough Script

| Scene | Duration | Visual | Voiceover / Action |
|-------|----------|--------|---------------------|
| **1. Intro** | 0:00 - 0:30 | Pulse opening on mobile viewport. Vertical feed displaying live BTC story card with sparkline. | *"Welcome to Pulse — prediction markets reimagined as a news feed for Somnia. Instead of order books, each market is a full-screen story card with live odds, countdowns, and instant two-tap betting."* |
| **2. Feed & Odds** | 0:30 - 1:00 | Swiping up/down between BTC, ETH, and Ecosystem cards. Ticking expiry timer and odds sparkline. | *"Users scroll vertically just like TikTok or Instagram Stories. Real-time probabilities are sourced directly from on-chain DreamDEX Event Contracts on Somnia Shannon testnet."* |
| **3. Two-Tap Bet** | 1:00 - 1:40 | Tap 'UP' on BTC card → Bet sheet slides up → Tap '$5' → Tap 'CONFIRM BET'. Micro-confetti fires and card auto-advances. | *"Tapping UP opens our lightweight bet sheet. We select $5 and confirm. Under the hood, Pulse submits an IOC taker order that crosses the book immediately without MetaMask signature fatigue."* |
| **4. Portfolio Tab** | 1:40 - 2:05 | Tap 'Portfolio' in bottom nav. Show active open positions, win rate %, and streak counter. | *"In the Portfolio tab, users track active wagers, win streaks, and net PnL backed 1:1 by tUSDC collateral."* |
| **5. Story Callback** | 2:05 - 2:45 | Switch back to feed. A 'STORY UPDATE' card surfaces at the top celebrating a win. Tap '1-TAP CLAIM'. Confetti explosion! | *"When a wagered market resolves, it doesn't get buried in a dashboard — it surfaces back into the feed as a story! Tap Claim to execute on-chain redemption back into tUSDC."* |

---

## 📝 Optional SDK & DX Feedback Report

During development of Pulse on Somnia Shannon testnet (`chain 50312`) using `@somnia-chain/markets-sdk`:

1. **DNS Resolution on Node 20+ / 24+**: Under Windows and certain Linux environments, Node’s native `fetch` (undici) defaults to IPv6, causing `getaddrinfo EAI_AGAIN` on `dream-rpc.somnia.network`. Setting `dns.setDefaultResultOrder('ipv4first')` or using `https://api.infra.testnet.somnia.network` resolved the issue completely.
2. **`MarketCreated` Venue Filtering**: Because `MarketCreated` event logs do not index `venueId`, filtering by collateral address (`CONTRACT_ADDRESSES.testUsdc`) was the most reliable way to scope open markets. Documenting this pattern in `SKILL.md` was tremendously helpful.
3. **`eventsAbi` Export**: The event ABI definitions (`marketCreatorEventsAbi`, `binaryModuleEventsAbi`) are located in `@somnia-chain/markets-sdk/dist/eventsAbi.js`, which is not exported under the main `package.json` `exports` map. Exposing `eventsAbi` in package exports would simplify client-side log watchers.
4. **Somnia Sub-Second Finality**: Somnia's ultra-fast block times made IOC taker order execution feel virtually instantaneous in the feed UI, perfectly validating the two-tap consumer thesis.

---

## 📄 License
MIT License. Built for the Somnia × DreamDEX Event Contracts Hackathon.
