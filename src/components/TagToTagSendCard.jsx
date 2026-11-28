import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Polyfill BigInt serialization for JSON.stringify across all RPC/wallet calls
if (typeof BigInt !== 'undefined' && !('toJSON' in BigInt.prototype)) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}
import {
  Send,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Zap,
  ShieldCheck,
  Clock,
  ChevronDown,
  Sliders,
  X,
  UserCheck,
  Check,
} from 'lucide-react';
import {
  SUPPORTED_CELO_STABLECOINS,
  prepareDirectSend,
  executeDirectSend,
  isValidEvmAddress,
} from '../services/unifiedPaymentEngine.js';
import {
  getLiveCorridorRate,
  getCorridorBalances,
  getIndicativePreview,
  requestFirmQuote,
  toAtomicUnits,
} from '../services/corridorService.js';
import {
  CELO_ATTRIBUTION_TAG,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  CELO_CUSD_ADDRESS,
} from '../config/celo.js';
import { resolveTag } from '../services/nairatagResolver.js';
import { getEthereumProvider } from '../services/celoPayment.js';
import { checkSelfHumanGate, enforceSharedHumanRewardQuota } from '../services/selfAgentIdService.js';
import { getAgentControlStatus, listAllAgentLifecycleRecords } from '../services/agentLifecycleService.js';
import SelfAgentIdBadge, { SelfIcon } from './SelfAgentIdBadge.jsx';
import './swap/SwapWidget.css';

// ── Official Token SVG Icons & Assets ──
export function TokenIcon({ symbol, size = 24 }) {
  if (symbol === 'USD₮' || symbol === 'USDT') {
    return (
      <img
        src="/tokens/usdt.svg"
        alt="USD₮"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/usdt.svg';
        }}
      />
    );
  }
  if (symbol === 'cNGN') {
    return (
      <img
        src="/tokens/cngn.png"
        alt="cNGN"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: '50%', objectFit: 'contain', flexShrink: 0 }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'https://celo-org.github.io/celo-token-list/assets/cngn.png';
        }}
      />
    );
  }
  if (symbol === 'USDC') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#2775CA" />
        <text
          x="16"
          y="21"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="14"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          $
        </text>
      </svg>
    );
  }
  if (symbol === 'CELO') {
    return (
      <img
        src="/tokens/celo.svg"
        alt="CELO"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'https://celo-org.github.io/celo-token-list/assets/celo_logo.svg';
        }}
      />
    );
  }
  if (symbol === 'cUSD') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#35D07F" />
        <text
          x="16"
          y="21"
          textAnchor="middle"
          fill="#064E3B"
          fontSize="14"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          $
        </text>
      </svg>
    );
  }
  if (symbol === 'IDRX') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#DC2626" />
        <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">
          Rp
        </text>
      </svg>
    );
  }
  return (
    <img
      src="/tokens/celo.svg"
      alt={symbol}
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
    />
  );
}

const TOKEN_LIST = [
  { symbol: 'USD₮', name: 'Tether USD', address: CELO_USDT_ADDRESS, decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6 },
  { symbol: 'CELO', name: 'Celo', address: '0x471EcE3750Da237f93B8E339c536989b8978a438', decimals: 18 },
  { symbol: 'cNGN', name: 'Celo Naira', address: CELO_CNGN_ADDRESS, decimals: 6 },
  { symbol: 'cUSD', name: 'Celo Dollar', address: CELO_CUSD_ADDRESS, decimals: 18 },
  { symbol: 'IDRX', name: 'Indonesian Rupiah', address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', decimals: 6 },
  { symbol: 'wARS', name: 'Argentine Peso', address: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D', decimals: 6 },
  { symbol: 'wBRL', name: 'Brazilian Real', address: '0xD76f5Faf6888e24D9F04bF92a0c8B921FE4390e0', decimals: 6 },
  { symbol: 'wMXN', name: 'Mexican Peso', address: '0x337E7456B420bD3481e7FA61fA9850343d610d34', decimals: 6 },
  { symbol: 'wCOP', name: 'Colombian Peso', address: '0x8a1D45e102e886510e891d2Ec656a708991e2D76', decimals: 6 },
];

export default function TagToTagSendCard({
  walletAddress,
  onConnectWallet,
  onOpenSelfVerification,
  initialRecipient = '',
  initialAmount = '20.00',
  onPaymentSuccess = () => {},
}) {
  const [selfGate, setSelfGate] = useState({ checking: false, allowed: true, reason: null, agentId: null });
  const [recipientSelfGate, setRecipientSelfGate] = useState({ checking: false, allowed: false, agentId: null });
  const [altanaGate, setAltanaGate] = useState({ hasWallet: false, hasActiveSession: true, sessionStatus: 'unprovisioned' });
  const [recentAgents, setRecentAgents] = useState([]);

  useEffect(() => {
    let active = true;
    listAllAgentLifecycleRecords()
      .then((records) => {
        if (!active || !Array.isArray(records)) return;
        const latest = records
          .filter((r) => r?.tag && !/^track\d*test_/i.test(r.tag))
          .sort((a, b) => Number(b.createdAt || b.updatedAt || 0) - Number(a.createdAt || a.updatedAt || 0))
          .slice(0, 3);
        setRecentAgents(latest);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [walletAddress]);

  useEffect(() => {
    let active = true;
    if (!walletAddress) {
      setSelfGate({ checking: false, allowed: false, reason: 'Connect wallet first.', agentId: null });
      setAltanaGate({ hasWallet: false, hasActiveSession: false, sessionStatus: 'unprovisioned' });
      return () => { active = false; };
    }
    setSelfGate((prev) => ({ ...prev, checking: true }));
    getAgentControlStatus(walletAddress)
      .then((c) => {
        if (!active) return;
        if (c) setAltanaGate(c);
        if (c?.selfVerified) {
          setSelfGate({ checking: false, allowed: true, agentId: c.selfAgentId ?? null, status: 'verified' });
          return;
        }
        return checkSelfHumanGate({ agentAddress: c?.selfAgentAddress || walletAddress, chainId: c?.selfChainId || 42220 })
          .then((res) => { if (active) setSelfGate({ checking: false, ...res }); });
      })
      .catch(() => {
        checkSelfHumanGate({ agentAddress: walletAddress })
          .then((res) => { if (active) setSelfGate({ checking: false, ...res }); })
          .catch(() => { if (active) setSelfGate({ checking: false, allowed: false, reason: 'Self Agent ID check failed.', agentId: null }); });
      });
    return () => { active = false; };
  }, [walletAddress]);
  // ── Form State ──
  const [recipientInput, setRecipientInput] = useState(initialRecipient);
  useEffect(() => {
    if (initialRecipient) {
      setRecipientInput(initialRecipient);
    }
  }, [initialRecipient]);
  const [amountIn, setAmountIn] = useState(initialAmount);
  const [sourceToken, setSourceToken] = useState('USD₮');
  const [targetToken, setTargetToken] = useState('USD₮');
  useEffect(() => {
    setTargetToken(sourceToken);
  }, [sourceToken]);
  const [memoInput, setMemoInput] = useState('');
  const [showMemoField, setShowMemoField] = useState(false);

  // ── Resolution State ──
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState('');

  useEffect(() => {
    let active = true;
    if (!resolvedRecipient?.address) {
      setRecipientSelfGate({ checking: false, allowed: false, agentId: null });
      return () => { active = false; };
    }
    setRecipientSelfGate((prev) => ({ ...prev, checking: true }));
    getAgentControlStatus(resolvedRecipient.tag || resolvedRecipient.address)
      .then((c) => {
        if (!active) return;
        if (c?.walletAddress && resolvedRecipient.tag && resolvedRecipient.address?.toLowerCase() !== c.walletAddress.toLowerCase()) {
          setResolvedRecipient((prev) => (prev ? { ...prev, address: c.walletAddress, ownerAddress: prev.ownerAddress || prev.address, isAltanaWallet: true } : prev));
        }
        if (c?.selfVerified) {
          setRecipientSelfGate({ checking: false, allowed: true, agentId: c.selfAgentId ?? null });
          return;
        }
        return checkSelfHumanGate({ agentAddress: c?.selfAgentAddress || resolvedRecipient.address, chainId: c?.selfChainId || 42220 })
          .then((res) => { if (active) setRecipientSelfGate({ checking: false, allowed: Boolean(res.allowed), agentId: res.agentId ?? null }); });
      })
      .catch(() => {
        checkSelfHumanGate({ agentAddress: resolvedRecipient.address })
          .then((res) => { if (active) setRecipientSelfGate({ checking: false, allowed: Boolean(res.allowed), agentId: res.agentId ?? null }); })
          .catch(() => { if (active) setRecipientSelfGate({ checking: false, allowed: false, agentId: null }); });
      });
    return () => { active = false; };
  }, [resolvedRecipient?.address]);

  // ── Pricing & Balances ──
  const [rates, setRates] = useState({ rateUsdtToCngn: 1445.5, rateCngnToUsdt: 0.000692 });
  const [balances, setBalances] = useState({ usdt: '0.00', cngn: '0.00', celo: '0.00' });
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // ── Quote State (Textile FX) ──
  const [indicativeData, setIndicativeData] = useState(null);
  const [firmQuote, setFirmQuote] = useState(null);
  const [isRequestingFirmQuote, setIsRequestingFirmQuote] = useState(false);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(null);

  // ── Settings & Micro-interactions ──
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [tokenModalMode, setTokenModalMode] = useState(null); // 'source' | 'target' | null
  const [copiedKey, setCopiedKey] = useState(null);

  // ── Execution State ──
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState(null);

  const isCrossToken = useMemo(() => {
    return sourceToken !== targetToken;
  }, [sourceToken, targetToken]);

  // Dynamic Recipient Label for Received Card
  const recipientReceivesLabel = useMemo(() => {
    if (resolvedRecipient?.displayName) {
      return `${resolvedRecipient.displayName} Receives`;
    }
    const clean = (recipientInput || '').trim().replace(/^[$@#]/, '');
    if (clean) {
      const formatted = clean.startsWith('₦') ? clean : `₦${clean.toUpperCase()}`;
      return `${formatted} Receives`;
    }
    return 'Recipient Receives';
  }, [resolvedRecipient, recipientInput]);

  // Active Sender Balance
  const activeSenderBalance = useMemo(() => {
    if (sourceToken === 'USD₮' || sourceToken === 'USDT') return balances.usdt;
    if (sourceToken === 'USDC') return balances.usdc || '0.00';
    if (sourceToken === 'CELO') return balances.celo || '0.00';
    if (sourceToken === 'cNGN') return balances.cngn;
    return '0.00';
  }, [sourceToken, balances]);

  const activeSenderBalanceNum = useMemo(() => {
    const clean = String(activeSenderBalance).replace(/,/g, '');
    return parseFloat(clean) || 0;
  }, [activeSenderBalance]);

  // ── Fetch Corridor Balances & Rate ──
  const fetchRatesAndBalances = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      const liveRates = await getLiveCorridorRate();
      setRates(liveRates);
      if (walletAddress) {
        const liveBals = await getCorridorBalances(walletAddress);
        setBalances(liveBals);
      }
    } catch (err) {
      console.warn('Error fetching corridor data:', err);
    } finally {
      setIsLoadingRates(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchRatesAndBalances();
    const interval = setInterval(fetchRatesAndBalances, 25000);
    return () => clearInterval(interval);
  }, [fetchRatesAndBalances]);

  // ── Real-time Recipient Resolution ──
  useEffect(() => {
    const raw = recipientInput.trim();
    if (!raw) {
      setResolvedRecipient(null);
      setResolutionError('');
      setIsResolving(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      setResolutionError('');
      try {
        if (isValidEvmAddress(raw)) {
          setResolvedRecipient({
            address: raw,
            tag: null,
            displayName: `${raw.slice(0, 6)}...${raw.slice(-4)}`,
            preferredToken: 'cNGN',
          });
        } else {
          const cleanTag = raw.replace(/^[₦@#]/, '').toLowerCase();
          const res = await resolveTag(cleanTag);
          if (res.success && res.resolvedAddress) {
            setResolvedRecipient({
              address: res.resolvedAddress,
              tag: `₦${cleanTag.toUpperCase()}`,
              displayName: `₦${cleanTag.toUpperCase()}`,
              preferredToken: sourceToken,
            });
          } else {
            setResolvedRecipient(null);
            setResolutionError(res.error || `₦${cleanTag} is not registered`);
          }
        }
      } catch (err) {
        setResolvedRecipient(null);
        setResolutionError(err.message || 'Unable to resolve tag');
      } finally {
        setIsResolving(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [recipientInput]);

  // ── Debounced Textile FX Indicative Preview on Cross-Token ──
  useEffect(() => {
    setFirmQuote(null);
    setQuoteSecondsLeft(null);
    setError('');

    const clean = String(amountIn).trim();
    if (!clean || isNaN(Number(clean)) || Number(clean) <= 0 || !isCrossToken) {
      setIndicativeData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const sellDesc = TOKEN_LIST.find((t) => t.symbol === sourceToken) || TOKEN_LIST[0];
        const buyDesc = TOKEN_LIST.find((t) => t.symbol === targetToken) || TOKEN_LIST[1];
        const sellAmountAtomic = toAtomicUnits(clean, sellDesc.decimals);

        const preview = await getIndicativePreview({
          sellToken: sellDesc.address,
          buyToken: buyDesc.address,
          sellAmount: sellAmountAtomic,
        });
        setIndicativeData(preview);
      } catch (err) {
        console.warn('[Indicative preview error]', err.message);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [amountIn, sourceToken, targetToken, isCrossToken]);

  // ── Quote Expiry Timer ──
  useEffect(() => {
    if (!firmQuote?.expiresAtTimestamp) return;

    const tick = () => {
      const msLeft = firmQuote.expiresAtTimestamp - Date.now();
      const secLeft = Math.max(0, Math.floor(msLeft / 1000));
      setQuoteSecondsLeft(secLeft);
      if (secLeft <= 0) {
        setError('Firm quote expired. Please refresh quote before sending.');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [firmQuote]);

  // ── Request Firm Quote with EIP-712 TakerControl ──
  const handleRequestFirmQuote = async () => {
    if (!walletAddress) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    const clean = String(amountIn).trim();
    if (!clean || Number(clean) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!resolvedRecipient) {
      setError('Please provide a valid recipient ₦Tag or Celo address.');
      return;
    }

    setIsRequestingFirmQuote(true);
    setError('');
    setStatusMessage('Sign proof of wallet control in your wallet...');

    try {
      const provider = getEthereumProvider(null, walletAddress);
      if (!provider) throw new Error('No EVM wallet detected.');

      // Proactively ensure accounts are authorized on this provider
      let authorizedAccounts = [];
      try {
        if (typeof provider.request === 'function') {
          authorizedAccounts = await provider.request({ method: 'eth_accounts' });
          if (!authorizedAccounts || authorizedAccounts.length === 0) {
            authorizedAccounts = await provider.request({ method: 'eth_requestAccounts' });
          }
        }
      } catch (authReqErr) {
        console.warn('[handleRequestFirmQuote] eth_requestAccounts check:', authReqErr);
      }

      // Detect account mismatch if user switched accounts in their wallet extension
      if (authorizedAccounts && authorizedAccounts.length > 0) {
        const hasMatch = authorizedAccounts.some(
          (a) => a.toLowerCase() === walletAddress.toLowerCase()
        );
        if (!hasMatch) {
          throw new Error(
            `Wallet account mismatch: Your wallet is currently set to ${authorizedAccounts[0].slice(0, 6)}...${authorizedAccounts[0].slice(-4)}, but this app is connected to ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}. Please switch to your connected account in your wallet extension.`
          );
        }
      }

      const { createWalletClient, custom, getAddress } = await import('viem');
      const { celoMainnet } = await import('../config/celo.js');
      const activeAccount = getAddress(walletAddress);
      const walletClient = createWalletClient({
        chain: celoMainnet,
        transport: custom(provider),
      });

      const sellDesc = TOKEN_LIST.find((t) => t.symbol === sourceToken) || TOKEN_LIST[0];
      const buyDesc = TOKEN_LIST.find((t) => t.symbol === targetToken) || TOKEN_LIST[1];
      const sellAmountAtomic = toAtomicUnits(clean, sellDesc.decimals);

      const quote = await requestFirmQuote({
        takerAddress: activeAccount,
        sellToken: sellDesc.address,
        buyToken: buyDesc.address,
        sellAmount: sellAmountAtomic,
        signTypedDataFn: async (args) => {
          try {
            return await walletClient.signTypedData({ ...args, account: activeAccount });
          } catch (signErr) {
            console.warn('[signTypedData] walletClient error, attempting direct RPC fallback:', signErr);
            if (provider && typeof provider.request === 'function') {
              try {
                const payload = JSON.stringify(
                  {
                    types: args.types,
                    domain: args.domain,
                    primaryType: args.primaryType,
                    message: args.message,
                  },
                  (key, value) => (typeof value === 'bigint' ? value.toString() : value)
                );
                const directSig = await provider.request({
                  method: 'eth_signTypedData_v4',
                  params: [activeAccount, payload],
                });
                if (directSig) return directSig;
              } catch (directErr) {
                console.error('[signTypedData] Direct fallback failed:', directErr);
                if (
                  directErr?.message?.includes('not been authorized') ||
                  directErr?.code === 4100 ||
                  directErr?.cause?.code === 4100
                ) {
                  throw new Error(
                    `Wallet authorization required: Please open your wallet (MetaMask / Rabby), approve the connection to this site for ${activeAccount.slice(0, 6)}...${activeAccount.slice(-4)}, and confirm the signature prompt.`
                  );
                }
                if (signErr?.message?.includes('onMessage') || directErr?.message?.includes('onMessage')) {
                  throw new Error('Wallet extension conflict. Please open your wallet (MetaMask / Rabby) and confirm the signature prompt.');
                }
                throw directErr;
              }
            }
            if (
              signErr?.message?.includes('not been authorized') ||
              signErr?.code === 4100 ||
              signErr?.cause?.code === 4100
            ) {
              throw new Error(
                `Wallet authorization required: Please open your wallet (MetaMask / Rabby), approve the connection to this site for ${activeAccount.slice(0, 6)}...${activeAccount.slice(-4)}, and confirm the signature prompt.`
              );
            }
            throw signErr;
          }
        },
      });

      if (!quote.isFirm) {
        setError(`Textile: ${quote.reason}`);
        setFirmQuote(null);
      } else {
        setFirmQuote(quote);
        setStatusMessage('Firm quote secured! Ready to convert & deliver.');
      }
    } catch (err) {
      console.error('Firm quote request failed:', err);
      setError(err.message || 'Failed to obtain firm quote from Textile FX.');
    } finally {
      setIsRequestingFirmQuote(false);
    }
  };

  // ── Execute Tag-to-Tag Send (Same-Token or 2-Step Textile Corridor) ──
  const handleExecuteSend = async () => {
    if (!walletAddress) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    if (!selfGate.allowed) {
      setError(selfGate.reason || 'Self Agent ID verification is required to send.');
      return;
    }

    if (altanaGate.hasWallet && !altanaGate.hasActiveSession) {
      setError(
        altanaGate.sessionStatus === 'revoked'
          ? 'Altana agent session key was revoked by the owner. Re-authorize in Wallet & Permissions to send.'
          : 'Altana agent session key is not authorized. Grant a scoped session key in Wallet & Permissions to send.'
      );
      return;
    }

    if (!recipientSelfGate.allowed) {
      setError('Recipient agent is unverified — Self Agent ID is required to receive payment.');
      return;
    }

    const quota = enforceSharedHumanRewardQuota({
      agentAddress: walletAddress,
      nullifier: selfGate.nullifier,
      action: 'send_swap',
      dailyLimit: 20,
    });
    if (!quota.allowed) {
      setError(quota.reason);
      return;
    }

    if (!resolvedRecipient) {
      setError('Please provide a valid recipient.');
      return;
    }

    if (isCrossToken && (!firmQuote || !firmQuote.isFirm)) {
      setError('A valid firm quote is required before authorizing cross-currency settlement.');
      return;
    }

    if (isCrossToken && quoteSecondsLeft !== null && quoteSecondsLeft <= 0) {
      setError('This quote has expired. Please refresh the quote.');
      return;
    }

    setIsExecuting(true);
    setError('');
    setStatusMessage(isCrossToken ? 'Step 1/2: Authorizing Textile FX conversion...' : 'Authorizing direct transfer...');

    try {
      const prepared = await prepareDirectSend({
        recipientTagOrAddress: resolvedRecipient.address,
        amount: String(amountIn).trim(),
        sourceToken,
        targetToken,
        senderAddress: walletAddress,
      });

      const receipt = await executeDirectSend({
        preparedSend: prepared,
        firmQuoteRecord: isCrossToken ? firmQuote : null,
        fromAddress: walletAddress,
        onStatusUpdate: ({ message }) => setStatusMessage(message),
      });

      setCompletedReceipt(receipt);
      setStatusMessage('Payment successfully delivered to recipient!');
      setFirmQuote(null);
      setAmountIn('');
      await fetchRatesAndBalances();
      if (onPaymentSuccess) onPaymentSuccess(receipt);
    } catch (err) {
      console.error('Execution failed:', err);
      setError(err.message || 'Transaction failed or was rejected.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Calculated Delivery Amount
  const estimatedDisplay = useMemo(() => {
    if (!isCrossToken) return amountIn || '0.00';
    if (firmQuote) return firmQuote.formattedBuyAmount;
    if (indicativeData) return indicativeData.formattedBuyAmount;
    if (amountIn && Number(amountIn) > 0) {
      const isUsdtIn = sourceToken === 'USD₮' || sourceToken === 'USDT';
      const num = Number(amountIn) * (isUsdtIn ? rates.rateUsdtToCngn : rates.rateCngnToUsdt);
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: isUsdtIn ? 2 : 4,
      });
    }
    return '0.00';
  }, [isCrossToken, amountIn, firmQuote, indicativeData, sourceToken, rates]);

  // Minimum Received after Slippage
  const minimumReceived = useMemo(() => {
    const rawOut = parseFloat(String(estimatedDisplay).replace(/,/g, '')) || 0;
    if (rawOut <= 0) return '0.00';
    const slip = parseFloat(slippageTolerance) || 0.5;
    const min = rawOut * (1 - slip / 100);
    return min.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [estimatedDisplay, slippageTolerance]);

  const isInsufficientBalance = useMemo(() => {
    const entered = parseFloat(amountIn) || 0;
    return entered > 0 && walletAddress && entered > activeSenderBalanceNum;
  }, [amountIn, walletAddress, activeSenderBalanceNum]);

  const copyText = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="swap-widget-card" style={{ maxWidth: '412px' }}>
      {/* ── Top Header: Send to ₦Tag ── */}
      <div className="swap-widget-header">
        <div className="swap-widget-title-wrap">
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={13} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--privy-color-foreground, #111111)' }}>
            Send to ₦Tag
          </span>
        </div>

        <div className="swap-header-controls">
          <span className="swap-route-badge" style={{ padding: '4px 6px' }} title="Celo Mainnet">
            <img src="/tokens/celo.svg" alt="Celo" style={{ width: 15, height: 15, borderRadius: '50%', display: 'block' }} />
          </span>
          {isCrossToken && (
            <button
              type="button"
              className={`swap-icon-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="Slippage settings"
            >
              <Sliders size={13} />
            </button>
          )}
          <button
            type="button"
            className="swap-icon-btn"
            onClick={fetchRatesAndBalances}
            title="Refresh rates & balances"
          >
            <RefreshCw size={13} className={isLoadingRates ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Slippage Drawer Popover (When Settings Open) ── */}
      {showSettings && isCrossToken && (
        <div className="swap-slippage-popover">
          <span style={{ fontWeight: 600, color: 'var(--privy-color-foreground-2, #6b7280)' }}>
            Slippage:
          </span>
          <div className="swap-slippage-pill-group">
            {['0.1', '0.5', '1.0'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setSlippageTolerance(val)}
                className={`swap-slippage-chip ${slippageTolerance === val ? 'active' : ''}`}
              >
                {val}% {val === '0.5' ? '(Auto)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 1: RECIPIENT ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">To</span>
          {resolvedRecipient && (
            <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={11} /> Resolved
            </span>
          )}
        </div>

        <div className="swap-recipient-input-wrap" style={{ marginTop: '2px' }}>
          <span className="swap-recipient-tag-prefix">₦</span>
          <input
            type="text"
            className="swap-recipient-input"
            placeholder="SEGUN, BLOOM, or 0x..."
            value={recipientInput.replace(/^[$₦]/, '')}
            onChange={(e) => setRecipientInput(e.target.value)}
            disabled={isExecuting}
            autoComplete="off"
            autoCorrect="off"
          />
          {isResolving && (
            <RefreshCw
              size={13}
              className="animate-spin"
              style={{ position: 'absolute', right: '10px' }}
              color="#10b981"
            />
          )}
        </div>

        {/* Latest 3 real claimed agents from PostgreSQL */}
        {!recipientInput && recentAgents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {recentAgents.map((agent) => {
              const cleanTag = String(agent.tag || '').replace(/^[₦$@#]/, '').toLowerCase();
              const isSelfVerified = Boolean(agent.self?.verified);
              const avatarSrc = agent.avatarUrl || agent.avatar || `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${encodeURIComponent(cleanTag)}`;
              return (
                <button
                  key={cleanTag}
                  type="button"
                  className="swap-slippage-chip"
                  style={{
                    position: 'relative',
                    overflow: 'visible',
                    padding: '4px 10px 4px 8px',
                    fontSize: '11px',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  onClick={() => setRecipientInput(`₦${cleanTag}`)}
                  title={isSelfVerified ? `Send to ₦${cleanTag} (Self Agent ID)` : `Send to ₦${cleanTag}`}
                >
                  {isSelfVerified && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        left: 'auto',
                        zIndex: 2,
                        width: '15px',
                        height: '15px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: '1px solid rgba(5, 150, 105, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                      }}
                    >
                      <SelfIcon size={9} color="#059669" />
                    </span>
                  )}
                  <img
                    src={avatarSrc}
                    alt=""
                    style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
                  />
                  <span>₦{cleanTag}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Verified Recipient Address Preview */}
        {resolvedRecipient && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.07)',
              marginTop: '3px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: '#047857' }}>{resolvedRecipient.displayName}</span>
              {!recipientSelfGate.checking && recipientSelfGate.allowed && (
                <span
                  title={recipientSelfGate.agentId != null ? `Self Agent ID #${recipientSelfGate.agentId} Verified` : 'Self Agent ID Verified'}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <SelfIcon size={13} color="#059669" />
                </span>
              )}
              <span style={{ color: 'var(--privy-color-foreground-3)', fontFamily: 'monospace', fontSize: '10.5px' }}>
                ({resolvedRecipient.isAltanaWallet ? 'Altana ' : ''}{resolvedRecipient.address.slice(0, 6)}...{resolvedRecipient.address.slice(-4)})
              </span>
            </div>
            <button
              type="button"
              className="swap-icon-btn"
              style={{ width: '22px', height: '22px' }}
              onClick={() => copyText('recip_addr', resolvedRecipient.address)}
              title="Copy address"
            >
              {copiedKey === 'recip_addr' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
            </button>
          </div>
        )}

        {resolvedRecipient && !recipientSelfGate.checking && !recipientSelfGate.allowed && (
          <div style={{ fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontWeight: 600 }}>
            <AlertCircle size={12} style={{ flexShrink: 0 }} />
            <span>Recipient agent is unverified — Self Agent ID is required to receive payment.</span>
          </div>
        )}

        {resolutionError && (
          <div style={{ fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <AlertCircle size={11} />
            <span>{resolutionError}</span>
          </div>
        )}
      </div>

      {/* ── SECTION 2: AMOUNT TO SEND ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">Amount to Send</span>
          <div className="swap-balance-row">
            <span>Bal: {activeSenderBalance}</span>
            {walletAddress && activeSenderBalanceNum > 0 && (
              <button
                type="button"
                className="swap-max-btn"
                onClick={() => setAmountIn(String(activeSenderBalanceNum))}
                title="Send max balance"
              >
                MAX
              </button>
            )}
          </div>
        </div>

        <div className="swap-card-main-row">
          <input
            type="number"
            step="any"
            placeholder="0.00"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            disabled={isExecuting || isRequestingFirmQuote}
            className="swap-number-input"
            autoComplete="off"
            autoCorrect="off"
          />

          <button
            type="button"
            className="swap-token-pill"
            onClick={() => setTokenModalMode('source')}
            title="Change currency to send"
          >
            <div className="swap-token-badge-icon">
              <TokenIcon symbol={sourceToken} size={22} />
            </div>
            <div className="swap-token-info-stack">
              <span className="swap-token-symbol">{sourceToken}</span>
            </div>
            <ChevronDown size={13} className="swap-token-chevron" />
          </button>
        </div>

        <div className="swap-card-bottom-row">
          <span>≈ ${parseFloat(amountIn || '0').toFixed(2)}</span>
          {isInsufficientBalance && (
            <span className="swap-card-warning">Exceeds balance</span>
          )}
        </div>
      </div>

      {/* ── Optional Memo / Note ── */}
      <div style={{ padding: '0 2px' }}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: '#059669',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
          onClick={() => setShowMemoField(!showMemoField)}
        >
          {showMemoField ? '− Remove memo' : '+ Add memo'}
        </button>
        {showMemoField && (
          <input
            type="text"
            className="swap-recipient-input"
            style={{ marginTop: '4px', paddingLeft: '8px', fontSize: '12px' }}
            placeholder="e.g. Design milestone / Lunch"
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
          />
        )}
      </div>

      {/* ── Primary Action Button ── */}
      {!walletAddress ? (
        <button type="button" className="swap-primary-action-btn" onClick={onConnectWallet}>
          <span>Connect Wallet</span>
        </button>
      ) : !selfGate.checking && !selfGate.allowed ? (
        <button
          type="button"
          className="swap-primary-action-btn"
          onClick={() => (onOpenSelfVerification ? onOpenSelfVerification() : setError(selfGate.reason))}
          style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff' }}
        >
          <ShieldCheck size={15} />
          <span>Verify Self Agent ID to Send</span>
        </button>
      ) : !recipientInput.trim() ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Enter Recipient</span>
        </button>
      ) : isResolving ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <RefreshCw size={14} className="animate-spin" />
          <span>Resolving ₦Tag...</span>
        </button>
      ) : !resolvedRecipient ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Invalid Recipient Tag</span>
        </button>
      ) : !recipientSelfGate.checking && !recipientSelfGate.allowed ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Recipient Unverified (Self ID Required)</span>
        </button>
      ) : !amountIn || Number(amountIn) <= 0 ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Enter Amount</span>
        </button>
      ) : isInsufficientBalance ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Insufficient {sourceToken} Balance</span>
        </button>
      ) : isCrossToken && !firmQuote ? (
        <button
          type="button"
          className="swap-primary-action-btn"
          disabled={isRequestingFirmQuote}
          onClick={handleRequestFirmQuote}
        >
          {isRequestingFirmQuote ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Getting Textile Quote…</span>
            </>
          ) : (
            <>
              <ShieldCheck size={15} />
              <span>Review Textile Quote</span>
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          className="swap-primary-action-btn"
          disabled={isExecuting || (isCrossToken && quoteSecondsLeft !== null && quoteSecondsLeft <= 0)}
          onClick={handleExecuteSend}
        >
          {isExecuting ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>{statusMessage || 'Settling on Celo…'}</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>
                {isCrossToken
                  ? `Send ${firmQuote?.formattedBuyAmount || estimatedDisplay} ${targetToken} to ${resolvedRecipient.displayName}`
                  : `Send ${amountIn} ${sourceToken} to ${resolvedRecipient.displayName}`}
              </span>
            </>
          )}
        </button>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'modalSlideUp 0.18s ease',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Verifiable Receipt Card ── */}
      {completedReceipt && (
        <div
          style={{
            padding: '12px',
            borderRadius: '14px',
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
            animation: 'modalSlideUp 0.22s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#059669" />
              <span style={{ fontWeight: 800, color: '#059669', fontSize: '13px' }}>
                Payment Settled to Recipient!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCompletedReceipt(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: '11.5px' }}>
            <span>Delivered:</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>
              {completedReceipt.amountDelivered || completedReceipt.amountSent}{' '}
              {completedReceipt.tokenDelivered || completedReceipt.tokenSent} to{' '}
              {completedReceipt.recipientTag || resolvedRecipient?.displayName}
            </span>
          </div>

          {completedReceipt.swapTxHash && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#6b7280' }}>1. Textile Conversion:</span>
              <a
                href={completedReceipt.swapExplorerUrl || `https://celoscan.io/tx/${completedReceipt.swapTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}
              >
                <span>CeloScan</span>
                <ExternalLink size={10} />
              </a>
            </div>
          )}

          {(completedReceipt.transferTxHash || completedReceipt.payoutTxHash) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#6b7280' }}>2. Recipient Payout:</span>
              <a
                href={completedReceipt.transferExplorerUrl || `https://celoscan.io/tx/${completedReceipt.transferTxHash || completedReceipt.payoutTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}
              >
                <span>CeloScan</span>
                <ExternalLink size={10} />
              </a>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed rgba(5, 150, 105, 0.2)', fontSize: '10px', color: '#6b7280' }}>
            <span>Attribution Tag:</span>
            <span style={{ fontWeight: 700, color: '#059669' }}>celo_9f7deabd99a6 (ERC-8021)</span>
          </div>
        </div>
      )}

      {/* ── Token Selector Modal ── */}
      {tokenModalMode && (
        <div className="swap-modal-backdrop" onClick={() => setTokenModalMode(null)}>
          <div className="swap-token-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="swap-token-modal-header">
              <span className="swap-token-modal-title">
                {tokenModalMode === 'source' ? 'Select Source Token' : 'Select Delivered Token'}
              </span>
              <button
                type="button"
                className="swap-icon-btn"
                onClick={() => setTokenModalMode(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="swap-token-list">
              {TOKEN_LIST.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  className={`swap-token-item ${
                    (tokenModalMode === 'source' && sourceToken === token.symbol) ||
                    (tokenModalMode === 'target' && targetToken === token.symbol)
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    if (tokenModalMode === 'source') setSourceToken(token.symbol);
                    else setTargetToken(token.symbol);
                    setTokenModalMode(null);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TokenIcon symbol={token.symbol} size={24} />
                    <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--privy-color-foreground, #111111)' }}>
                        {token.symbol}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3, #9ca3af)' }}>
                        {token.name}
                      </div>
                    </div>
                  </div>
                  {((tokenModalMode === 'source' && sourceToken === token.symbol) ||
                    (tokenModalMode === 'target' && targetToken === token.symbol)) && (
                    <Check size={14} color="#10b981" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
