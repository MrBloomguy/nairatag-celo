import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
} from '../config/celo.js';
import { getEthereumProvider } from '../services/celoPayment.js';

export default function CorridorSwapCard({ walletAddress, onConnectWallet, embedded = false }) {
  const [direction, setDirection] = useState('USDT_TO_CNGN'); // 'USDT_TO_CNGN' | 'CNGN_TO_USDT'
  const [amountIn, setAmountIn] = useState('');
  const [rates, setRates] = useState({ rateUsdtToCngn: 1445.50, rateCngnToUsdt: 0.000692 });
  const [balances, setBalances] = useState({ usdt: '0.00', cngn: '0.00', celo: '0.00' });
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  
  // Indicative & Firm Quote State
  const [indicativeData, setIndicativeData] = useState(null);
  const [firmQuote, setFirmQuote] = useState(null);
  const [isRequestingFirmQuote, setIsRequestingFirmQuote] = useState(false);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(null);

  // Recipient Payout Option (Real Job to External Recipient)
  const [payDirectlyToTag, setPayDirectlyToTag] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedRecipient, setResolvedRecipient] = useState(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

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
    }, 450);

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

  const isUsdtIn = direction === 'USDT_TO_CNGN';
  const inTokenSymbol = isUsdtIn ? 'USD₮' : 'cNGN';
  const outTokenSymbol = isUsdtIn ? 'cNGN' : 'USD₮';
  const inBalance = isUsdtIn ? balances.usdt : balances.cngn;

  const toggleDirection = () => {
    setDirection((prev) => (prev === 'USDT_TO_CNGN' ? 'CNGN_TO_USDT' : 'USDT_TO_CNGN'));
    setAmountIn('');
    setIndicativeData(null);
    setFirmQuote(null);
    setError('');
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
      const provider = getEthereumProvider();
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
        signTypedDataFn: (args) => walletClient.signTypedData({ ...args, account: walletAddress }),
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
    setStatusMessage('Authorizing transaction...');

    try {
      if (payDirectlyToTag && recipientInput.trim()) {
        // Mode 2: Cross-currency payment to external recipient
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
        // Mode 1: Self swap
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

  const estimatedDisplay = firmQuote
    ? firmQuote.formattedBuyAmount
    : indicativeData
    ? indicativeData.formattedBuyAmount
    : amountIn && Number(amountIn) > 0
    ? (Number(amountIn) * (isUsdtIn ? rates.rateUsdtToCngn : rates.rateCngnToUsdt)).toFixed(isUsdtIn ? 2 : 4)
    : '0.00';

  return (
    <div
      style={embedded ? {} : {
        borderRadius: '16px',
        padding: '20px',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Input Box 1: You Pay */}
      <div
        style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'var(--input-bg, #f9fafb)',
          border: '1px solid var(--border-color, #e5e7eb)',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #666)', marginBottom: '6px' }}>
          <span>You Pay</span>
          <span>Balance: {inBalance} {inTokenSymbol}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <input
            type="number"
            step="any"
            placeholder="0.00"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            disabled={isExecuting || isRequestingFirmQuote}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '22px',
              fontWeight: 700,
              width: '100%',
              outline: 'none',
              color: 'var(--text-primary, #111)',
            }}
          />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            <span style={{ color: isUsdtIn ? '#26a17b' : '#059669' }}>
              {isUsdtIn ? '₮' : '₦'}
            </span>
            <span>{inTokenSymbol}</span>
          </div>
        </div>
      </div>

      {/* Flip Button */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0', zIndex: 2, position: 'relative' }}>
        <button
          type="button"
          onClick={toggleDirection}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color, #d1d5db)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            color: 'var(--text-primary, #111)',
          }}
          title="Switch corridor direction"
        >
          <ArrowDownUp size={14} />
        </button>
      </div>

      {/* Input Box 2: You Receive */}
      <div
        style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'var(--input-bg, #f9fafb)',
          border: '1px solid var(--border-color, #e5e7eb)',
          marginTop: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #666)', marginBottom: '6px' }}>
          <span>You Receive {firmQuote ? '(Firm Quote)' : '(Indicative)'}</span>
          <span>Balance: {isUsdtIn ? balances.cngn : balances.usdt} {outTokenSymbol}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: Number(estimatedDisplay) > 0 ? 'var(--text-primary, #111)' : 'var(--text-secondary, #999)',
            }}
          >
            {estimatedDisplay}
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            <span style={{ color: !isUsdtIn ? '#26a17b' : '#059669' }}>
              {!isUsdtIn ? '₮' : '₦'}
            </span>
            <span>{outTokenSymbol}</span>
          </div>
        </div>
      </div>

      {/* Option: Pay directly to external recipient */}
      {isUsdtIn && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={payDirectlyToTag}
                onChange={(e) => setPayDirectlyToTag(e.target.checked)}
              />
              <span>Pay directly to external recipient (₦Tag / Phone)</span>
            </label>
          </div>

          {payDirectlyToTag && (
            <input
              type="text"
              placeholder="Recipient ₦Tag or address (e.g. ₦editor, +23480...)"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                fontSize: '13px',
                background: 'var(--input-bg, #f9fafb)',
                outline: 'none',
              }}
            />
          )}
        </div>
      )}

      {/* Pricing & Firm Quote Details */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(53, 208, 127, 0.05)',
          border: '1px solid rgba(53, 208, 127, 0.2)',
          fontSize: '12px',
          marginBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #666)' }}>Textile RFQ v2 Rate</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary, #111)' }}>
            1 USD₮ ≈ {(firmQuote?.effectiveRate || rates.rateUsdtToCngn).toLocaleString()} cNGN
          </span>
        </div>

        {indicativeData?.availableSellAmount && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #666)' }}>Market Maker Depth</span>
            <span style={{ fontWeight: 600, color: '#059669' }}>
              {Number(indicativeData.availableSellAmount).toLocaleString()} {inTokenSymbol}
            </span>
          </div>
        )}

        {firmQuote && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary, #666)' }}>Quote Expiry</span>
              <span style={{ fontWeight: 700, color: quoteSecondsLeft && quoteSecondsLeft <= 10 ? '#dc2626' : '#059669' }}>
                <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                {quoteSecondsLeft}s remaining
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary, #666)' }}>Spender Contract</span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {firmQuote.spender ? `${firmQuote.spender.slice(0, 6)}...${firmQuote.spender.slice(-4)}` : 'Textile Reactor'}
              </span>
            </div>
          </>
        )}


      </div>

      {/* Action Buttons */}
      {!firmQuote ? (
        <button
          type="button"
          disabled={isRequestingFirmQuote || !amountIn || Number(amountIn) <= 0}
          onClick={handleRequestFirmQuote}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #35D07F 0%, #10b981 100%)',
            color: '#042f2e',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isRequestingFirmQuote ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(53, 208, 127, 0.25)',
          }}
        >
          {isRequestingFirmQuote ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Soliciting Market Maker Quotes (75s)...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Request Firm Quote (Textile RFQ)</span>
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          disabled={isExecuting || (quoteSecondsLeft !== null && quoteSecondsLeft <= 0)}
          onClick={handleAuthorizeAndExecute}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: '12px',
            background: quoteSecondsLeft && quoteSecondsLeft <= 0 ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isExecuting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(5, 150, 105, 0.25)',
          }}
        >
          {isExecuting ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>{statusMessage || 'Authorizing Swap...'}</span>
            </>
          ) : (
            <>
              <Zap size={16} />
              <span>
                {payDirectlyToTag
                  ? `Authorize Swap & Pay ${firmQuote.formattedBuyAmount} cNGN`
                  : `Authorize Swap (${firmQuote.formattedBuyAmount} ${outTokenSymbol})`}
              </span>
            </>
          )}
        </button>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#dc2626',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Verifiable Cryptographic Receipt Card */}
      {completedReceipt && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#059669" />
              <span style={{ fontWeight: 700, color: '#059669' }}>Payment Receipt</span>
            </div>
            <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#059669' }}>
              {completedReceipt.receiptId}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--text-secondary, #444)' }}>
            <div>
              <strong>Converted:</strong> {completedReceipt.amountSentUsdt} USD₮ → {completedReceipt.amountDeliveredCngn} cNGN
            </div>
            {completedReceipt.recipientTag && (
              <div>
                <strong>Delivered to:</strong> {completedReceipt.recipientTag} ({completedReceipt.recipientAddress})
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <a
                href={completedReceipt.swapExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
              >
                <span>Swap Tx</span>
                <ExternalLink size={10} />
              </a>
              {completedReceipt.payoutExplorerUrl && (
                <a
                  href={completedReceipt.payoutExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                >
                  <span>Payout Tx</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
