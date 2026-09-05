import React, { useState } from 'react';
import {
  X,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { SOMNIA_SHANNON_CONFIG } from '../lib/constants';
import { saveBurnerPrivateKey, connectInjectedWallet } from '../lib/wallet';

interface WalletModalProps {
  isOpen: boolean;
  walletType: 'burner' | 'injected' | 'none';
  walletAddress: string;
  privateKey?: string;
  sttBalance: number;
  usdcBalance: number;
  onClose: () => void;
  onWalletUpdated: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  walletType,
  walletAddress,
  privateKey,
  sttBalance,
  usdcBalance,
  onClose,
  onWalletUpdated,
}) => {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [importKeyVal, setImportKeyVal] = useState('');
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const handleCopyAddr = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleImportKey = () => {
    try {
      setImportError('');
      saveBurnerPrivateKey(importKeyVal.trim());
      onWalletUpdated();
      setImportKeyVal('');
      setShowKey(false);
    } catch (err: any) {
      setImportError(err.message || 'Failed to import key');
    }
  };

  const handleConnectInjected = async () => {
    try {
      await connectInjectedWallet();
      onWalletUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to connect MetaMask');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl glass-card border border-white/20 p-6 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pulse-up/20 border border-pulse-up flex items-center justify-center text-pulse-up">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Wallet & Balances</h3>
              <span className="text-[11px] font-mono text-pulse-cyan">
                Somnia Shannon (50312)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Wallet Pill */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2 border border-white/10">
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono text-gray-400 uppercase">
              {walletType === 'burner' ? '⚡ Burner Wallet (Fast)' : '🦊 Injected Wallet'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-pulse-up/15 text-pulse-up flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-xs text-white font-bold truncate max-w-[200px]">
              {walletAddress}
            </span>
            <button
              onClick={handleCopyAddr}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
              title="Copy Address"
            >
              {copiedAddr ? (
                <Check className="w-3.5 h-3.5 text-pulse-up" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Balances Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-gray-400">
              tUSDC (Collateral)
            </span>
            <span className="text-lg font-black font-mono text-pulse-cyan">
              ${usdcBalance.toFixed(2)}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-gray-400">
              STT (Gas)
            </span>
            <span className="text-lg font-black font-mono text-white">
              {sttBalance.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Telegram Faucet Link */}
        <a
          href={SOMNIA_SHANNON_CONFIG.faucetTelegram}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3.5 rounded-2xl bg-gradient-to-r from-pulse-cyan/15 to-blue-500/15 border border-pulse-cyan/30 flex items-center justify-between group hover:border-pulse-cyan transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-pulse-cyan/20 flex items-center justify-center text-pulse-cyan">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-pulse-cyan">
                Get Testnet STT + tUSDC
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                SomniaHacks Telegram Faucet
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-white" />
        </a>

        {/* Switch / Injected Option */}
        <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
          <button
            onClick={handleConnectInjected}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
          >
            <span>Connect MetaMask / Browser Wallet</span>
          </button>

          {/* Burner Key Management */}
          {walletType === 'burner' && (
            <div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="w-full py-2 text-center text-xs font-mono text-gray-500 hover:text-gray-300"
              >
                {showKey ? 'Hide Advanced Key Settings' : 'Export / Import Private Key'}
              </button>

              {showKey && (
                <div className="mt-2 p-3 rounded-xl bg-black/50 border border-white/10 flex flex-col gap-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                    <span>Export Key:</span>
                    <button
                      onClick={handleCopyKey}
                      className="text-pulse-cyan flex items-center gap-1 hover:underline"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 break-all p-1.5 bg-black/60 rounded">
                    {privateKey}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    <span className="text-[11px] font-mono text-gray-400">Import Key:</span>
                    <input
                      type="password"
                      placeholder="0x..."
                      value={importKeyVal}
                      onChange={(e) => setImportKeyVal(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white font-mono outline-none"
                    />
                    {importError && (
                      <span className="text-[10px] text-rose-400 font-mono">{importError}</span>
                    )}
                    <button
                      onClick={handleImportKey}
                      className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white font-mono"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
