import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Zap,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Clock,
  Send,
  UserCheck,
  ChevronDown,
  Info,
  Sliders,
  X,
  Search,
  Check,
} from 'lucide-react';
import {
  getLiveCorridorRate,
  getCorridorBalances,
  getIndicativePreview,
  requestFirmQuote,
  executeCorridorSwap,
  prepareCorridorPayment,
  executeCorridorPayment,
  toAtomicUnits,
} from '../services/corridorService.js';
import {
  CELO_ATTRIBUTION_TAG,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  CELO_CUSD_ADDRESS,
} from '../config/celo.js';
import { getEthereumProvider } from '../services/celoPayment.js';
import './swap/SwapWidget.css';

// ── High-Fidelity Official Token Icons ──
export function TokenIcon({ symbol, size = 26 }) {
  if (symbol === 'USD₮') {
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
  // CELO native
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#FCFF52" />
      <circle cx="12.5" cy="13.5" r="5.5" stroke="#1E1E1E" strokeWidth="2.5" fill="none" />
      <circle cx="19.5" cy="18.5" r="5.5" stroke="#1E1E1E" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

const SUPPORTED_TOKENS = [
  {
    symbol: 'USD₮',
    name: 'Tether USD',
    network: 'Celo',
    address: CELO_USDT_ADDRESS,
    decimals: 6,
    fiatSymbol: '$',
    fiatMultiplier: 1.0,
  },
  {
    symbol: 'cNGN',
    name: 'Celo Naira',
    network: 'Celo',
    address: CELO_CNGN_ADDRESS,
    decimals: 6,
    fiatSymbol: '₦',
    fiatMultiplier: 1.0,
  },
  {
    symbol: 'cUSD',
    name: 'Celo Dollar',
    network: 'Celo',
    address: CELO_CUSD_ADDRESS,
    decimals: 18,
    fiatSymbol: '$',
    fiatMultiplier: 1.0,
  },
  {
    symbol: 'CELO',
    name: 'Native CELO',
    network: 'Celo',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    fiatSymbol: '$',
    fiatMultiplier: 0.55,
  },
];

export default function CorridorSwapCard({
  walletAddress,
  onConnectWallet,
  embedded = false,
  paySubMode = 'corridor',
  onSelectSubMode,
}) {
  // Primary direction: 'USDT_TO_CNGN' | 'CNGN_TO_USDT'
  const [direction, setDirection] = useState('USDT_TO_CNGN');
  const [amountIn, setAmountIn] = useState('');
  const [rates, setRates] = useState({ rateUsdtToCngn: 1445.5, rateCngnToUsdt: 0.000692 });
  const [balances, setBalances] = useState({ usdt: '0.00', cngn: '0.00', celo: '0.00' });
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Micro-interaction states
  const [isFlipping, setIsFlipping] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState('0.5'); // 0.1, 0.5, 1.0

  // Indicative & Firm Quote State
  const [indicativeData, setIndicativeData] = useState(null);
  const [firmQuote, setFirmQuote] = useState(null);
  const [isRequestingFirmQuote, setIsRequestingFirmQuote] = useState(false);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(null);

  // Recipient Payout Option (Real Job to External Recipient)
  const [payDirectlyToTag, setPayDirectlyToTag] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');

  // Token Selector Modal
  const [tokenModalMode, setTokenModalMode] = useState(null); // 'sell' | 'buy' | null
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const isUsdtIn = direction === 'USDT_TO_CNGN';
  const inTokenSymbol = isUsdtIn ? 'USD₮' : 'cNGN';
  const outTokenSymbol = isUsdtIn ? 'cNGN' : 'USD₮';

  const inBalance = isUsdtIn ? balances.usdt : balances.cngn;
  const outBalance = isUsdtIn ? balances.cngn : balances.usdt;

  const inBalanceNum = useMemo(() => {
    const clean = String(inBalance).replace(/,/g, '');
    return parseFloat(clean) || 0;
  }, [inBalance]);

  // Fetch balances and rate
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

  // Debounced Indicative Preview on amount change
  useEffect(() => {
    setFirmQuote(null);
    setQuoteSecondsLeft(null);
    setError('');

    const clean = String(amountIn).trim();
    if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) {
      setIndicativeData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const isUsdt = direction === 'USDT_TO_CNGN';
        const sellToken = isUsdt ? CELO_USDT_ADDRESS : CELO_CNGN_ADDRESS;
        const buyToken = isUsdt ? CELO_CNGN_ADDRESS : CELO_USDT_ADDRESS;
        const sellAmountAtomic = toAtomicUnits(clean, 6);

        const preview = await getIndicativePreview({
          sellToken,
          buyToken,
          sellAmount: sellAmountAtomic,
        });
        setIndicativeData(preview);
      } catch (err) {
        console.warn('[Indicative preview error]', err.message);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [amountIn, direction]);

  // Quote Expiry Timer
  useEffect(() => {
    if (!firmQuote?.expiresAtTimestamp) return;

    const tick = () => {
      const msLeft = firmQuote.expiresAtTimestamp - Date.now();
      const secLeft = Math.max(0, Math.floor(msLeft / 1000));
      setQuoteSecondsLeft(secLeft);
      if (secLeft <= 0) {
        setError('Firm quote expired. Please request a fresh quote.');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [firmQuote]);

  // Flip direction with spring rotation micro-interaction
  const toggleDirection = () => {
    setIsFlipping(true);
    setDirection((prev) => (prev === 'USDT_TO_CNGN' ? 'CNGN_TO_USDT' : 'USDT_TO_CNGN'));
    setAmountIn('');
    setIndicativeData(null);
    setFirmQuote(null);
    setError('');
    setTimeout(() => setIsFlipping(false), 300);
  };

  // Click MAX button micro-interaction
  const handleMaxClick = () => {
    if (inBalanceNum > 0) {
      setAmountIn(String(inBalanceNum));
    }
  };

  // Request Firm Quote from Textile FX with EIP-712 TakerControl
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

      const isUsdt = direction === 'USDT_TO_CNGN';
      const sellToken = isUsdt ? CELO_USDT_ADDRESS : CELO_CNGN_ADDRESS;
      const buyToken = isUsdt ? CELO_CNGN_ADDRESS : CELO_USDT_ADDRESS;
      const sellAmountAtomic = toAtomicUnits(clean, 6);

      const quote = await requestFirmQuote({
        takerAddress: walletAddress,
        sellToken,
        buyToken,
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
                console.error('[signTypedData] Direct eth_signTypedData_v4 fallback failed:', directErr);
                if (signErr?.message?.includes('onMessage') || directErr?.message?.includes('onMessage')) {
                  throw new Error('Wallet popup encountered an extension conflict. Please check your browser wallet (MetaMask / Rabby) to confirm the signature.');
                }
                throw directErr;
              }
            }
            if (signErr?.message?.includes('onMessage') || signErr?.message?.includes('communicator')) {
              throw new Error('Wallet popup encountered a conflict. Please check your browser wallet (MetaMask / Rabby) to confirm the signature.');
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
        setStatusMessage('Firm quote secured from market makers!');
      }
    } catch (err) {
      console.error('Firm quote request failed:', err);
      setError(err.message || 'Failed to obtain firm quote from Textile FX.');
    } finally {
      setIsRequestingFirmQuote(false);
    }
  };

  // Execute Swap or Direct Recipient Payment
  const handleAuthorizeAndExecute = async () => {
    if (!firmQuote || !firmQuote.isFirm) {
      setError('A valid firm quote is required before authorizing.');
      return;
    }

    if (quoteSecondsLeft !== null && quoteSecondsLeft <= 0) {
      setError('This quote has expired. Please request a new quote.');
      return;
    }

    setIsExecuting(true);
    setError('');
    setStatusMessage('Authorizing transaction on Celo...');

    try {
      if (payDirectlyToTag && recipientInput.trim()) {
        const prepared = await prepareCorridorPayment({
          recipientTagOrAddress: recipientInput.trim(),
          amountInUsdt: firmQuote.formattedSellAmount,
        });

        const receipt = await executeCorridorPayment({
          paymentIntent: prepared,
          firmQuoteRecord: firmQuote,
          fromAddress: walletAddress,
          onStatusUpdate: ({ message }) => setStatusMessage(message),
        });

        setCompletedReceipt(receipt);
        setStatusMessage('Payment settled to external recipient!');
      } else {
        const result = await executeCorridorSwap({
          fromAddress: walletAddress,
          firmQuoteRecord: firmQuote,
          onStatusUpdate: ({ message }) => setStatusMessage(message),
        });

        setCompletedReceipt({
          receiptId: `swap_${Date.now()}`,
          status: 'completed',
          swapTxHash: result.txHash,
          swapExplorerUrl: result.explorerUrl,
          amountSentUsdt: firmQuote.formattedSellAmount,
          amountDeliveredCngn: firmQuote.formattedBuyAmount,
          attributionTag: CELO_ATTRIBUTION_TAG,
        });
        setStatusMessage('Corridor swap finalized on Celo Mainnet!');
      }

      setFirmQuote(null);
      setAmountIn('');
      await fetchRatesAndBalances();
    } catch (err) {
      console.error('Execution failed:', err);
      setError(err.message || 'Transaction failed or was rejected.');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyText = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Estimated output amount
  const estimatedDisplay = useMemo(() => {
    if (firmQuote) return firmQuote.formattedBuyAmount;
    if (indicativeData) return indicativeData.formattedBuyAmount;
    if (amountIn && Number(amountIn) > 0) {
      const num = Number(amountIn) * (isUsdtIn ? rates.rateUsdtToCngn : rates.rateCngnToUsdt);
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: isUsdtIn ? 2 : 4,
      });
    }
    return '0.00';
  }, [firmQuote, indicativeData, amountIn, isUsdtIn, rates]);

  // Fiat estimate for Sell side
  const sellFiatEstimate = useMemo(() => {
    const amt = parseFloat(amountIn) || 0;
    if (amt <= 0) return '$0.00';
    if (isUsdtIn) return `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const usdEquiv = amt / (rates.rateUsdtToCngn || 1445.5);
    return `≈ $${usdEquiv.toFixed(2)}`;
  }, [amountIn, isUsdtIn, rates]);

  // Fiat estimate for Buy side
  const buyFiatEstimate = useMemo(() => {
    const outNum = parseFloat(String(estimatedDisplay).replace(/,/g, '')) || 0;
    if (outNum <= 0) return '$0.00';
    if (!isUsdtIn) return `$${outNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const usdEquiv = outNum / (rates.rateUsdtToCngn || 1445.5);
    return `≈ $${usdEquiv.toFixed(2)}`;
  }, [estimatedDisplay, isUsdtIn, rates]);

  // Slippage minimum calculation
  const minimumReceived = useMemo(() => {
    const rawOut = parseFloat(String(estimatedDisplay).replace(/,/g, '')) || 0;
    if (rawOut <= 0) return '0.00';
    const slip = parseFloat(slippageTolerance) || 0.5;
    const min = rawOut * (1 - slip / 100);
    return min.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: isUsdtIn ? 2 : 4,
    });
  }, [estimatedDisplay, slippageTolerance, isUsdtIn]);

  const isInsufficientBalance = useMemo(() => {
    const entered = parseFloat(amountIn) || 0;
    return entered > 0 && walletAddress && entered > inBalanceNum;
  }, [amountIn, walletAddress, inBalanceNum]);

  return (
    <div className="swap-widget-card">
      {/* ── Top Header Bar ── */}
      <div className="swap-widget-header">
        {onSelectSubMode ? (
          <div className="swap-widget-toggle">
            <button
              type="button"
              className={`swap-widget-toggle-btn ${paySubMode === 'corridor' ? 'active' : ''}`}
              onClick={() => onSelectSubMode('corridor')}
            >
              <ArrowDownUp size={13} />
              <span>Swap</span>
            </button>
            <button
              type="button"
              className={`swap-widget-toggle-btn ${paySubMode === 'direct' ? 'active' : ''}`}
              onClick={() => onSelectSubMode('direct')}
            >
              <Send size={13} />
              <span>Send to ₦Tag</span>
            </button>
          </div>
        ) : (
          <div className="swap-widget-title-wrap">
            <span className="swap-widget-title">Swap</span>
          </div>
        )}

        <div className="swap-header-controls">
          <button
            type="button"
            className={`swap-icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Slippage settings"
            aria-label="Slippage settings"
          >
            <Sliders size={14} />
          </button>
          <button
            type="button"
            className="swap-icon-btn"
            onClick={fetchRatesAndBalances}
            title="Refresh rates"
            aria-label="Refresh rates"
          >
            <RefreshCw size={14} className={isLoadingRates ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Slippage Settings Dropdown Popover ── */}
      {showSettings && (
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

      {/* ── CARD 1: SELL (You Pay) ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">Sell</span>
          <div className="swap-balance-row">
            <span>
              Balance: {inBalance} {inTokenSymbol}
            </span>
            {walletAddress && inBalanceNum > 0 && (
              <button
                type="button"
                className="swap-max-btn"
                onClick={handleMaxClick}
                title="Use full balance"
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
            placeholder="0"
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
            onClick={() => setTokenModalMode('sell')}
            title="Change token"
          >
            <div className="swap-token-badge-icon">
              <TokenIcon symbol={inTokenSymbol} size={22} />
            </div>
            <div className="swap-token-info-stack">
              <span className="swap-token-network">Celo</span>
              <span className="swap-token-symbol">{inTokenSymbol}</span>
            </div>
            <ChevronDown size={13} className="swap-token-chevron" />
          </button>
        </div>

        <div className="swap-card-bottom-row">
          <span>{sellFiatEstimate}</span>
          {isInsufficientBalance && (
            <span className="swap-card-warning">Exceeds available balance</span>
          )}
        </div>
      </div>

      {/* ── CENTRAL SWITCHER BUTTON (Hero Micro-Interaction) ── */}
      <div className="swap-flip-divider-wrap">
        <button
          type="button"
          onClick={toggleDirection}
          className={`swap-flip-circle-btn ${isFlipping ? 'flipped' : ''}`}
          title="Switch corridor direction"
          aria-label="Switch corridor direction"
        >
          <ArrowDown size={15} />
        </button>
      </div>

      {/* ── CARD 2: BUY (You Receive) ── */}
      <div className="swap-card-box">
        <div className="swap-card-top-row">
          <span className="swap-card-label">Buy</span>
          <div className="swap-balance-row">
            <span>
              Balance: {outBalance} {outTokenSymbol}
            </span>
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
            onClick={() => setTokenModalMode('buy')}
            title="Change token"
          >
            <div className="swap-token-badge-icon">
              <TokenIcon symbol={outTokenSymbol} size={22} />
            </div>
            <div className="swap-token-info-stack">
              <span className="swap-token-network">Celo</span>
              <span className="swap-token-symbol">{outTokenSymbol}</span>
            </div>
            <ChevronDown size={13} className="swap-token-chevron" />
          </button>
        </div>

        <div className="swap-card-bottom-row">
          <span>{buyFiatEstimate}</span>
          {firmQuote && quoteSecondsLeft !== null && (
            <div
              className={`swap-countdown-pill ${
                quoteSecondsLeft <= 10 ? 'urgent' : ''
              }`}
            >
              <Clock size={10} />
              <span>{quoteSecondsLeft}s left</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Centered Floating Exchange Rate Pill (Reference 1 style) ── */}
      <div className="swap-center-rate-pill-wrap">
        <button
          type="button"
          className="swap-center-rate-pill"
          onClick={toggleDirection}
          title="Click to flip conversion perspective"
        >
          <span className="swap-pulse-dot" />
          <span>
            1 {inTokenSymbol} ≈{' '}
            {(firmQuote?.effectiveRate || (isUsdtIn ? rates.rateUsdtToCngn : rates.rateCngnToUsdt)).toLocaleString(
              'en-US',
              { maximumFractionDigits: isUsdtIn ? 2 : 4 }
            )}{' '}
            {outTokenSymbol}
          </span>
        </button>
      </div>

      {/* ── Route & Breakdown Intelligence Section (Reference 1 & 2) ── */}
      <div className="swap-rate-intelligence-strip">
        <div
          className="swap-rate-summary-bar"
          onClick={() => setShowDetails(!showDetails)}
          title="Click to toggle details breakdown"
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

        {/* Expandable Details Table */}
        {showDetails && (
          <div className="swap-breakdown-table">
            <div className="swap-breakdown-row">
              <span title="Guaranteed minimum received amount after slippage">Minimum received</span>
              <span>
                {minimumReceived} {outTokenSymbol}
              </span>
            </div>

            <div className="swap-breakdown-row">
              <span title="Configured slippage tolerance">Slippage Tolerance</span>
              <span>{slippageTolerance}%</span>
            </div>

            <div className="swap-breakdown-row">
              <span title="Difference between market price and estimated price">
                Price Impact
              </span>
              <span style={{ color: '#059669' }}>&lt; 0.01%</span>
            </div>

            <div className="swap-breakdown-row">
              <span title="Celo sub-second gas settlement fee">Network fee</span>
              <span>&lt; 0.0001 CELO (~ $0.0001)</span>
            </div>

            <div className="swap-breakdown-row">
              <span title="Protocol commission fee">Exchange fee</span>
              <span style={{ color: '#059669' }}>Free (0%)</span>
            </div>

            {firmQuote && (
              <div className="swap-breakdown-row">
                <span>Spender Contract</span>
                <span style={{ fontFamily: 'monospace', fontSize: '10.5px' }}>
                  {firmQuote.spender
                    ? `${firmQuote.spender.slice(0, 6)}...${firmQuote.spender.slice(-4)}`
                    : 'Textile Reactor'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Direct Recipient Delivery Option (Expandable) ── */}
      {isUsdtIn && (
        <div className="swap-recipient-toggle-wrap">
          <label className="swap-recipient-checkbox-label">
            <input
              type="checkbox"
              checked={payDirectlyToTag}
              onChange={(e) => setPayDirectlyToTag(e.target.checked)}
              style={{ accentColor: '#10b981', cursor: 'pointer' }}
            />
            <span>Deliver output directly to external ₦Tag or Phone</span>
          </label>

          {payDirectlyToTag && (
            <div className="swap-recipient-input-wrap">
              <span className="swap-recipient-tag-prefix">₦</span>
              <input
                type="text"
                placeholder="segun, food, or +234..."
                value={recipientInput.replace(/^[$₦]/, '')}
                onChange={(e) => setRecipientInput(e.target.value)}
                className="swap-recipient-input"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Primary Action Button ── */}
      {!walletAddress ? (
        <button
          type="button"
          className="swap-primary-action-btn"
          onClick={onConnectWallet}
        >
          <span>Connect Wallet</span>
        </button>
      ) : !amountIn || Number(amountIn) <= 0 ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Enter an amount</span>
        </button>
      ) : isInsufficientBalance ? (
        <button type="button" className="swap-primary-action-btn" disabled>
          <span>Insufficient {inTokenSymbol} Balance</span>
        </button>
      ) : !firmQuote ? (
        <button
          type="button"
          className="swap-primary-action-btn"
          disabled={isRequestingFirmQuote}
          onClick={handleRequestFirmQuote}
        >
          {isRequestingFirmQuote ? (
            <>
              <RefreshCw size={17} className="animate-spin" />
              <span>Soliciting Market Maker Quotes…</span>
            </>
          ) : (
            <>
              <ShieldCheck size={17} />
              <span>Review Swap Quote (Textile RFQ)</span>
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          className="swap-primary-action-btn"
          disabled={isExecuting || (quoteSecondsLeft !== null && quoteSecondsLeft <= 0)}
          onClick={handleAuthorizeAndExecute}
          style={{
            background:
              quoteSecondsLeft && quoteSecondsLeft <= 0
                ? '#9ca3af'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          }}
        >
          {isExecuting ? (
            <>
              <RefreshCw size={17} className="animate-spin" />
              <span>{statusMessage || 'Authorizing Swap on Celo…'}</span>
            </>
          ) : (
            <>
              <Zap size={17} />
              <span>
                {payDirectlyToTag
                  ? `Authorize Swap & Pay ${firmQuote.formattedBuyAmount} cNGN`
                  : `Confirm Swap (${firmQuote.formattedBuyAmount} ${outTokenSymbol})`}
              </span>
            </>
          )}
        </button>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            padding: '9px 12px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'modalSlideUp 0.2s ease',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Verifiable Receipt Card ── */}
      {completedReceipt && (
        <div
          style={{
            padding: '14px',
            borderRadius: '16px',
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: 'modalSlideUp 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={17} color="#059669" />
              <span style={{ fontWeight: 800, color: '#059669', fontSize: '13px' }}>
                Corridor Swap Finalized
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCompletedReceipt(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4b5563' }}>Converted</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>
              {completedReceipt.amountSentUsdt} USD₮ → {completedReceipt.amountDeliveredCngn} cNGN
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
            <a
              href={completedReceipt.swapExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#059669',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
                fontSize: '11.5px',
              }}
            >
              <span>View on CeloScan</span>
              <ExternalLink size={11} />
            </a>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>ERC-8021 Tagged</span>
          </div>
        </div>
      )}

      {/* ── Token Selector Modal ── */}
      {tokenModalMode && (
        <div className="swap-modal-backdrop" onClick={() => setTokenModalMode(null)}>
          <div
            className="swap-token-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="swap-token-modal-header">
              <span className="swap-token-modal-title">Select a token</span>
              <button
                type="button"
                className="swap-icon-btn"
                onClick={() => setTokenModalMode(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                }}
              />
              <input
                type="text"
                placeholder="Search token name or symbol"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                className="swap-token-search-input"
                style={{ paddingLeft: '34px' }}
                autoFocus
              />
            </div>

            <div className="swap-token-list">
              {SUPPORTED_TOKENS.filter(
                (t) =>
                  t.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
                  t.name.toLowerCase().includes(tokenSearchQuery.toLowerCase())
              ).map((token) => {
                const currentActive =
                  tokenModalMode === 'sell'
                    ? inTokenSymbol === token.symbol
                    : outTokenSymbol === token.symbol;

                return (
                  <div
                    key={token.symbol}
                    className={`swap-token-item ${currentActive ? 'selected' : ''}`}
                    onClick={() => {
                      if (token.symbol === 'USD₮' || token.symbol === 'cNGN') {
                        if (tokenModalMode === 'sell') {
                          if (token.symbol === 'cNGN' && direction === 'USDT_TO_CNGN') {
                            toggleDirection();
                          } else if (token.symbol === 'USD₮' && direction === 'CNGN_TO_USDT') {
                            toggleDirection();
                          }
                        } else {
                          if (token.symbol === 'USD₮' && direction === 'USDT_TO_CNGN') {
                            toggleDirection();
                          } else if (token.symbol === 'cNGN' && direction === 'CNGN_TO_USDT') {
                            toggleDirection();
                          }
                        }
                      }
                      setTokenModalMode(null);
                      setTokenSearchQuery('');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TokenIcon symbol={token.symbol} size={30} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--privy-color-foreground, #111111)' }}>
                          {token.symbol}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--privy-color-foreground-3, #9ca3af)' }}>
                          {token.name} • {token.network}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--privy-color-foreground-2, #6b7280)' }}>
                        {token.symbol === 'USD₮'
                          ? balances.usdt
                          : token.symbol === 'cNGN'
                          ? balances.cngn
                          : token.symbol === 'CELO'
                          ? balances.celo
                          : '0.00'}
                      </span>
                      {currentActive && <Check size={16} color="#10b981" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
