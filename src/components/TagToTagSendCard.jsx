import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import './swap/SwapWidget.css';

// ── Official Token SVG Icons ──
export function TokenIcon({ symbol, size = 24 }) {
  if (symbol === 'USD₮' || symbol === 'USDT') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#26A17B" />
        <path
          d="M17.9 12.2V9.5H23V6.5H9V9.5H14.1V12.2C10.5 12.4 7.8 13.3 7.8 14.3C7.8 15.3 10.5 16.2 14.1 16.4V22H17.9V16.4C21.5 16.2 24.2 15.3 24.2 14.3C24.2 13.3 21.5 12.4 17.9 12.2ZM16 15.3C12.8 15.3 10.3 14.7 10.3 14C10.3 13.3 12.8 12.7 16 12.7C19.2 12.7 21.7 13.3 21.7 14C21.7 14.7 19.2 15.3 16 15.3Z"
          fill="white"
        />
        <path d="M16 22V25.5H16V22Z" fill="white" />
      </svg>
    );
  }
  if (symbol === 'cNGN') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#059669" />
        <circle cx="16" cy="16" r="14.5" stroke="#34D399" strokeWidth="1" strokeOpacity="0.4" />
        <text
          x="16"
          y="20.5"
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ₦
        </text>
      </svg>
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
  // CELO native
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#FCFF52" />
      <circle cx="12.5" cy="13.5" r="5.5" stroke="#1E1E1E" strokeWidth="2.5" fill="none" />
      <circle cx="19.5" cy="18.5" r="5.5" stroke="#1E1E1E" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

const TOKEN_LIST = [
  { symbol: 'USD₮', name: 'Tether USD', address: CELO_USDT_ADDRESS, decimals: 6 },
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
  initialRecipient = '',
  initialAmount = '20.00',
  onPaymentSuccess = () => {},
}) {
  // ── Form State ──
  const [recipientInput, setRecipientInput] = useState(initialRecipient);
  const [amountIn, setAmountIn] = useState(initialAmount);
  const [sourceToken, setSourceToken] = useState('USD₮');
  const [targetToken, setTargetToken] = useState('cNGN');
  const [memoInput, setMemoInput] = useState('');
  const [showMemoField, setShowMemoField] = useState(false);

  // ── Resolution State ──
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState('');

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
  const [showDetails, setShowDetails] = useState(true);
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

  // Active Sender Balance
  const activeSenderBalance = useMemo(() => {
    if (sourceToken === 'USD₮' || sourceToken === 'USDT') return balances.usdt;
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
              preferredToken: 'cNGN',
            });
            // Auto-align target token to recipient's local stablecoin
            setTargetToken('cNGN');
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

      const { createWalletClient, custom } = await import('viem');
      const { celoMainnet } = await import('../config/celo.js');
      const walletClient = createWalletClient({
        chain: celoMainnet,
        transport: custom(provider),
      });

      const sellDesc = TOKEN_LIST.find((t) => t.symbol === sourceToken) || TOKEN_LIST[0];
      const buyDesc = TOKEN_LIST.find((t) => t.symbol === targetToken) || TOKEN_LIST[1];
      const sellAmountAtomic = toAtomicUnits(clean, sellDesc.decimals);

      const quote = await requestFirmQuote({
        takerAddress: walletAddress,
        sellToken: sellDesc.address,
        buyToken: buyDesc.address,
        sellAmount: sellAmountAtomic,
        signTypedDataFn: async (args) => {
          try {
            return await walletClient.signTypedData({ ...args, account: walletAddress });
          } catch (signErr) {
            console.warn('[signTypedData] walletClient error, attempting direct RPC fallback:', signErr);
            if (provider && typeof provider.request === 'function') {
              try {
                const payload = JSON.stringify({
                  types: args.types,
                  domain: args.domain,
                  primaryType: args.primaryType,
                  message: args.message,
                });
                const directSig = await provider.request({
                  method: 'eth_signTypedData_v4',
                  params: [walletAddress, payload],
                });
                if (directSig) return directSig;
              } catch (directErr) {
                console.error('[signTypedData] Direct fallback failed:', directErr);
                if (signErr?.message?.includes('onMessage') || directErr?.message?.includes('onMessage')) {
                  throw new Error('Wallet extension conflict. Please open your wallet (MetaMask / Rabby) and confirm the signature prompt.');
                }
                throw directErr;
              }
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
      {/* ── Top Header: Send to ₦Tag (Zero Standalone Swap) ── */}
      <div className="swap-widget-header">
        <div className="swap-widget-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              <Send size={14} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--privy-color-foreground, #111111)', lineHeight: 1.1 }}>
                Send to ₦Tag
              </div>
              <div style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3, #9ca3af)', fontWeight: 600 }}>
                Textile FX Cross-Currency
              </div>
            </div>
          </div>
        </div>

        <div className="swap-header-controls">
          <span className="swap-route-badge" style={{ fontSize: '10px', padding: '3px 7px' }}>
            <span className="swap-pulse-dot" />
            <span>Celo Mainnet</span>
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
            Slippage Tolerance:
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

      {/* ── SECTION 1: RECIPIENT ₦TAG INPUT ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">Recipient (₦Tag or Address)</span>
          <span style={{ fontSize: '10.5px', color: 'var(--privy-color-foreground-3)' }}>
            Instant Resolution
          </span>
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

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
          <span style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3)' }}>Quick:</span>
          {['segun', 'bloom', 'alice', 'food', 'ride'].map((tag) => (
            <button
              key={tag}
              type="button"
              className="swap-slippage-chip"
              style={{ padding: '2px 6px', fontSize: '10px' }}
              onClick={() => setRecipientInput(`₦${tag}`)}
            >
              ₦{tag}
            </button>
          ))}
        </div>

        {/* Verified Recipient Card */}
        {resolvedRecipient && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '12px',
                }}
              >
                {resolvedRecipient.tag ? resolvedRecipient.tag.slice(1, 2) : '₦'}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{resolvedRecipient.displayName}</span>
                  <span style={{ fontSize: '9px', background: '#059669', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>
                    RESOLVED
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3)', fontFamily: 'monospace' }}>
                  {resolvedRecipient.address.slice(0, 8)}...{resolvedRecipient.address.slice(-6)}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="swap-icon-btn"
              style={{ width: '26px', height: '26px' }}
              onClick={() => copyText('recip_addr', resolvedRecipient.address)}
              title="Copy address"
            >
              {copiedKey === 'recip_addr' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {resolutionError && (
          <div style={{ fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <AlertCircle size={12} />
            <span>{resolutionError}</span>
          </div>
        )}
      </div>

      {/* ── SECTION 2: YOU SEND (SOURCE CURRENCY) ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">You Send (Source Asset)</span>
          <div className="swap-balance-row">
            <span>
              Bal: {activeSenderBalance} {sourceToken}
            </span>
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
            title="Change source token"
          >
            <div className="swap-token-badge-icon">
              <TokenIcon symbol={sourceToken} size={22} />
            </div>
            <div className="swap-token-info-stack">
              <span className="swap-token-network">Celo</span>
              <span className="swap-token-symbol">{sourceToken}</span>
            </div>
            <ChevronDown size={13} className="swap-token-chevron" />
          </button>
        </div>

        <div className="swap-card-bottom-row">
          <span>≈ ${parseFloat(amountIn || '0').toFixed(2)} USD</span>
          {isInsufficientBalance && (
            <span className="swap-card-warning">Exceeds available balance</span>
          )}
        </div>
      </div>

      {/* ── ROUTE CONNECTOR (Direct vs Textile FX Corridor) ── */}
      <div className="swap-flip-divider-wrap">
        <div
          style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            background: isCrossToken ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg, #f1f3f5)',
            border: isCrossToken ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color, #e5e7eb)',
            fontSize: '10.5px',
            fontWeight: 700,
            color: isCrossToken ? '#059669' : 'var(--privy-color-foreground-2, #6b7280)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
          }}
        >
          {isCrossToken ? (
            <>
              <Zap size={11} color="#059669" />
              <span>Textile FX Corridor ({sourceToken} ➔ {targetToken})</span>
            </>
          ) : (
            <>
              <ArrowDown size={11} />
              <span>Direct Same-Token Send</span>
            </>
          )}
        </div>
      </div>

      {/* ── SECTION 3: RECIPIENT RECEIVES (DELIVERED ASSET) ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">Recipient Receives (Delivered)</span>
          <div className="swap-balance-row">
            <span>Destination: {resolvedRecipient?.displayName || '₦TAG'}</span>
          </div>
        </div>

        <div className="swap-card-main-row">
          <div
            className={`swap-number-output ${
              !amountIn || Number(amountIn) <= 0 ? 'empty' : ''
            }`}
          >
            {estimatedDisplay}
          </div>

          <button
            type="button"
            className="swap-token-pill"
            onClick={() => setTokenModalMode('target')}
            title="Change delivered token"
          >
            <div className="swap-token-badge-icon">
              <TokenIcon symbol={targetToken} size={22} />
            </div>
            <div className="swap-token-info-stack">
              <span className="swap-token-network">Celo</span>
              <span className="swap-token-symbol">{targetToken}</span>
            </div>
            <ChevronDown size={13} className="swap-token-chevron" />
          </button>
        </div>

        <div className="swap-card-bottom-row">
          <span>
            {targetToken === 'cNGN' ? `₦${estimatedDisplay}` : `≈ $${parseFloat(amountIn || '0').toFixed(2)}`}
          </span>
          {firmQuote && quoteSecondsLeft !== null && (
            <div className={`swap-countdown-pill ${quoteSecondsLeft <= 10 ? 'urgent' : ''}`}>
              <Clock size={10} />
              <span>{quoteSecondsLeft}s left</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Centered Live Exchange Rate Pill (When Cross-Token) ── */}
      {isCrossToken && (
        <div className="swap-center-rate-pill-wrap">
          <div className="swap-center-rate-pill">
            <span className="swap-pulse-dot" />
            <span>
              1 {sourceToken} ≈{' '}
              {(firmQuote?.effectiveRate || rates.rateUsdtToCngn).toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}{' '}
              {targetToken}
            </span>
          </div>
        </div>
      )}

      {/* ── Textile FX Corridor Breakdown Drawer ── */}
      {isCrossToken && (
        <div className="swap-rate-intelligence-strip">
          <div
            className="swap-rate-summary-bar"
            onClick={() => setShowDetails(!showDetails)}
            title="Toggle corridor details"
          >
            <div className="swap-rate-text">
              <span>Route</span>
              <span className="swap-route-badge">Textile RFQ v2 · Best Rate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>&lt; 1s</span>
              <ChevronDown
                size={13}
                style={{
                  transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--privy-color-foreground-3, #9ca3af)',
                }}
              />
            </div>
          </div>

          {showDetails && (
            <div className="swap-breakdown-table">
              <div className="swap-breakdown-row">
                <span title="Guaranteed minimum received amount after slippage">
                  Guaranteed Minimum Delivered
                </span>
                <span>
                  {minimumReceived} {targetToken}
                </span>
              </div>
              <div className="swap-breakdown-row">
                <span title="Slippage tolerance threshold">Slippage Tolerance</span>
                <span>{slippageTolerance}% (Auto)</span>
              </div>
              <div className="swap-breakdown-row">
                <span title="Difference between market rate and execution rate">Price Impact</span>
                <span style={{ color: '#059669' }}>&lt; 0.01%</span>
              </div>
              <div className="swap-breakdown-row">
                <span title="Celo sub-second gas settlement">Network Fee</span>
                <span>&lt; 0.0001 CELO (~ $0.0001)</span>
              </div>
              <div className="swap-breakdown-row">
                <span title="Protocol fee">Conversion Fee</span>
                <span style={{ color: '#059669' }}>Free (0%)</span>
              </div>
              <div className="swap-breakdown-row">
                <span>Attribution</span>
                <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>
                  ERC-8021 Tagged (celo_9f7deabd99a6)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Optional Memo / Invoice Ref ── */}
      <div style={{ padding: '2px 4px' }}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: '#059669',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: 0,
          }}
          onClick={() => setShowMemoField(!showMemoField)}
        >
          <span>{showMemoField ? '− Hide Memo' : '+ Add Memo / Payment Reference'}</span>
        </button>
        {showMemoField && (
          <input
            type="text"
            className="swap-recipient-input"
            style={{ marginTop: '4px', paddingLeft: '10px' }}
            placeholder="e.g. Design milestone / Lunch / Invoice #104"
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
          />
        )}
      </div>

      {/* ── Primary Action Button ── */}
      {!walletAddress ? (
        <button type="button" className="swap-primary-action-btn" onClick={onConnectWallet}>
          <span>Connect Wallet to Send</span>
        </button>
      ) : !recipientInput.trim() ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Enter Recipient ₦Tag</span>
        </button>
      ) : isResolving ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <RefreshCw size={15} className="animate-spin" />
          <span>Resolving ₦Tag...</span>
        </button>
      ) : !resolvedRecipient ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Invalid Recipient Tag</span>
        </button>
      ) : !amountIn || Number(amountIn) <= 0 ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Enter an Amount</span>
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
              <RefreshCw size={16} className="animate-spin" />
              <span>Soliciting Textile Market Makers…</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Review Textile Quote ({sourceToken} ➔ {targetToken})</span>
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
              <RefreshCw size={16} className="animate-spin" />
              <span>{statusMessage || 'Settling payment on Celo…'}</span>
            </>
          ) : (
            <>
              <Send size={15} />
              <span>
                {isCrossToken
                  ? `Convert & Deliver ${firmQuote?.formattedBuyAmount || estimatedDisplay} ${targetToken} to ${resolvedRecipient.displayName}`
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
