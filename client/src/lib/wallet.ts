import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import { SOMNIA_SHANNON_CONFIG } from './constants';

const BURNER_KEY_STORAGE = 'pulse_burner_private_key';

export const clientPub = createPublicClient({
  chain: somniaTestnet,
  transport: http(SOMNIA_SHANNON_CONFIG.rpcUrls[0]),
});

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Get or create an embedded burner wallet.
 * Fast, frictionless two-tap betting without wallet popups for every swipe!
 */
export function getOrCreateBurnerWallet(): { address: string; privateKey: string } {
  let key = localStorage.getItem(BURNER_KEY_STORAGE);
  if (!key || !key.startsWith('0x') || key.length !== 66) {
    key = generatePrivateKey();
    localStorage.setItem(BURNER_KEY_STORAGE, key);
  }

  const account = privateKeyToAccount(key as Hex);
  return {
    address: account.address,
    privateKey: key,
  };
}

export function saveBurnerPrivateKey(newKey: string): string {
  if (!newKey.startsWith('0x') || newKey.length !== 66) {
    throw new Error('Invalid private key format (must be 0x followed by 64 hex characters)');
  }
  localStorage.setItem(BURNER_KEY_STORAGE, newKey);
  const account = privateKeyToAccount(newKey as Hex);
  return account.address;
}

/**
 * Fetch live on-chain balances for STT (gas) and tUSDC (collateral)
 */
export async function fetchBalances(address: string): Promise<{ stt: number; usdc: number }> {
  try {
    const [sttWei, usdcUnits] = await Promise.all([
      clientPub.getBalance({ address: address as `0x${string}` }),
      clientPub.readContract({
        address: SOMNIA_SHANNON_CONFIG.collateralAddress as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }).catch(() => 0n),
    ]);

    return {
      stt: parseFloat(formatEther(sttWei)),
      usdc: parseFloat(formatUnits(usdcUnits as bigint, 6)),
    };
  } catch (err) {
    console.error('Failed to fetch on-chain balances:', err);
    return { stt: 0, usdc: 0 };
  }
}

/**
 * Connect to injected Web3 wallet (MetaMask, Rabby, etc.)
 * Automatically switches or adds Somnia Shannon testnet (50312)
 */
export async function connectInjectedWallet(): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('No Web3 wallet detected. Please install MetaMask or use the Burner Wallet.');
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts authorized');
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SOMNIA_SHANNON_CONFIG.chainIdHex }],
    });
  } catch (switchError: any) {
    // Chain has not been added to MetaMask
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: SOMNIA_SHANNON_CONFIG.chainIdHex,
            chainName: SOMNIA_SHANNON_CONFIG.chainName,
            nativeCurrency: SOMNIA_SHANNON_CONFIG.nativeCurrency,
            rpcUrls: SOMNIA_SHANNON_CONFIG.rpcUrls,
            blockExplorerUrls: SOMNIA_SHANNON_CONFIG.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw switchError;
    }
  }

  return accounts[0];
}
