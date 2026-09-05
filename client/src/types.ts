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
  impliedProbDown: number; // 0 - 100%
  sparkline: number[];
  expiryTimestamp: number;
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
  timeLeftSeconds?: number;
  isWin?: boolean;
  payoutUsdc?: number;
}

export interface PortfolioStats {
  totalWagered: number;
  totalWon: number;
  netPnL: number;
  winRate: number;
  openCount: number;
  resolvedCount: number;
  streakCount: number;
}

export interface WalletState {
  address: string | null;
  type: 'burner' | 'injected' | 'none';
  privateKey?: string; // Only stored in localStorage for burner wallet
  sttBalance: number;
  usdcBalance: number;
  isConnected: boolean;
}
