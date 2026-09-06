import { SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { somniaTestnet } from 'viem/chains';
import dotenv from 'dotenv';
// Load .env
dotenv.config();
export const NETWORK_CONFIG = {
    chainId: 50312,
    chain: somniaTestnet,
    name: 'Somnia Shannon Testnet',
    currency: 'STT',
    rpcUrl: process.env.RPC_URL || 'https://api.infra.testnet.somnia.network',
    wsRpcUrl: process.env.WS_RPC_URL || 'wss://api.infra.testnet.somnia.network/ws',
    indexerUrl: process.env.INDEXER_URL || 'https://dev.smk.somnia.host/v1/graphql',
    explorerUrl: 'https://shannon-explorer.somnia.network',
    faucetTelegram: 'https://t.me/+XHq0F0JXMyhmMzM0',
    port: parseInt(process.env.PORT || '3001', 10),
};
// Official DreamDEX contract addresses on Somnia Shannon testnet
export const CONTRACT_ADDRESSES = {
    ...SOMNIA_TESTNET_ADDRESSES,
    // tUSDC testnet collateral (6 decimals)
    testUsdc: SOMNIA_TESTNET_ADDRESSES.testUsdc || '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
};
// Collateral & Contract Precision (6 decimals: 1 contract = 1e6 units = 1 USDC)
export const ONE_CONTRACT = 1000000n;
export const COLLATERAL_DECIMALS = 6;
export const PRICE_SCALE = 1000000n; // 900000 = 90% probability
// Somnia-specific Gas Settings (EIP-1559 base fee ~6 gwei minimum + headroom)
export const SOMNIA_GAS_SETTINGS = {
    maxPriorityFeePerGas: 2000000000n, // 2 gwei tip
    maxFeePerGas: 10000000000n, // 10 gwei max fee (safe headroom above 6 gwei base)
};
