export const SOMNIA_SHANNON_CONFIG = {
  chainId: 50312,
  chainIdHex: '0xc488',
  chainName: 'Somnia Shannon Testnet',
  nativeCurrency: {
    name: 'Somnia Testnet Token',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: [
    'https://api.infra.testnet.somnia.network',
    'https://50312.rpc.thirdweb.com',
  ],
  blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
  faucetTelegram: 'https://t.me/+XHq0F0JXMyhmMzM0',
  collateralAddress: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E', // tUSDC
  binaryModuleAddress: '0x3ecC694Cef705358864a646142ac17A90E29e388',
};

export const API_BASE_URL = window.location.origin.includes('5173')
  ? 'http://localhost:3001/api'
  : '/api';

export const WS_BASE_URL = window.location.origin.includes('5173')
  ? 'ws://localhost:3001'
  : `ws://${window.location.host}`;
