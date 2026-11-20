import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import {
  getLiveCorridorRate,
  getCorridorBalances,
  executeCorridorSwap,
} from '../services/corridorService.js';
import { CELO_ATTRIBUTION_TAG } from '../config/arc.js';

export default function CorridorSwapCard({ walletAddress, onConnectWallet }) {
  const [direction, setDirection] = useState('USDT_TO_CNGN'); // 'USDT_TO_CNGN' | 'CNGN_TO_USDT'
  const [amountIn, setAmountIn] = useState('');
  const [rates, setRates] = useState({ rateUsdtToCngn: 1438.99, rateCngnToUsdt: 0.000695 });
  const [balances, setBalances] = useState({ usdt: '0.00', cngn: '0.00', celo: '0.00' });
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState('');
  const [error, setError] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [copiedTx, setCopiedTx] = useState(false);

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
    const interval = setInterval(fetchRatesAndBalances, 20000);
    return () => clearInterval(interval);
  }, [fetchRatesAndBalances]);

  const isUsdtIn = direction === 'USDT_TO_CNGN';
  const currentRate = isUsdtIn ? rates.rateUsdtToCngn : rates.rateCngnToUsdt;
  const inTokenSymbol = isUsdtIn ? 'USD₮' : 'cNGN';
  const outTokenSymbol = isUsdtIn ? 'cNGN' : 'USD₮';
  const inBalance = isUsdtIn ? balances.usdt : balances.cngn;

  // Estimated output
  const estimatedOut = amountIn && Number(amountIn) > 0 ? (Number(amountIn) * currentRate).toFixed(isUsdtIn ? 2 : 4) : '0.00';

  const toggleDirection = () => {
    setDirection((prev) => (prev === 'USDT_TO_CNGN' ? 'CNGN_TO_USDT' : 'USDT_TO_CNGN'));
    setAmountIn('');
    setError('');
  };

  const handleSwap = async () => {
    if (!walletAddress) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    if (!amountIn || Number(amountIn) <= 0) {
      setError('Please enter a valid swap amount.');
      return;
    }

    setIsSwapping(true);
    setError('');
    setSwapStatus('Initializing corridor swap...');

    try {
      const result = await executeCorridorSwap({
        fromAddress: walletAddress,
        direction,
        amountIn,
        onStatusUpdate: ({ step, message }) => {
          setSwapStatus(message);
        },
      });

      setLastTxHash(result.txHash);
      setSwapStatus('Corridor swap confirmed on Celo Mainnet!');
      setAmountIn('');
      await fetchRatesAndBalances();
    } catch (err) {
      console.error('Corridor swap failed:', err);
      setError(err.message || 'Swap failed or was rejected.');
      setSwapStatus('');
    } finally {
      setIsSwapping(false);
    }
  };

  const copyTx = () => {
    if (!lastTxHash) return;
    navigator.clipboard.writeText(lastTxHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  return (
    <div
      style={{
        borderRadius: '16px',
        padding: '20px',
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-color, #f3f4f6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(53, 208, 127, 0.15)',
              color: '#059669',
              fontWeight: 800,
            }}
          >
            <TrendingUp size={16} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary, #111)' }}>
              Stablecoin Corridor (Track 1)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #666)' }}>
              Textile FX & On-Chain Pool · Sub-Cent Settlement
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={fetchRatesAndBalances}
            disabled={isLoadingRates}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #666)',
              padding: '4px',
            }}
            title="Refresh Rate"
          >
            <RefreshCw size={13} className={isLoadingRates ? 'spin' : ''} />
          </button>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(53, 208, 127, 0.15)',
              color: '#059669',
            }}
          >
            Celo Mainnet
          </span>
        </div>
      </div>

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
            disabled={isSwapping}
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
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #666)', marginBottom: '6px' }}>
          <span>You Receive (Estimated)</span>
          <span>Balance: {isUsdtIn ? balances.cngn : balances.usdt} {outTokenSymbol}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: Number(estimatedOut) > 0 ? 'var(--text-primary, #111)' : 'var(--text-secondary, #999)',
            }}
          >
            {estimatedOut}
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

      {/* Rate & Corridor Info Box */}
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
          <span style={{ color: 'var(--text-secondary, #666)' }}>Exchange Rate</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary, #111)' }}>
            1 USD₮ ≈ {rates.rateUsdtToCngn.toLocaleString()} cNGN
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #666)' }}>Slippage / Pool Fee</span>
          <span style={{ fontWeight: 600, color: '#059669' }}>0.01% (Stable Pair)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #666)' }}>Attribution</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#059669' }}>
            {CELO_ATTRIBUTION_TAG}
          </span>
        </div>
      </div>

      {/* Swap Button */}
      <button
        type="button"
        disabled={isSwapping}
        onClick={handleSwap}
        style={{
          width: '100%',
          padding: '13px 18px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #35D07F 0%, #10b981 100%)',
          color: '#042f2e',
          border: 'none',
          fontWeight: 700,
          fontSize: '14px',
          cursor: isSwapping ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 10px rgba(53, 208, 127, 0.25)',
        }}
      >
        {isSwapping ? (
          <>
            <RefreshCw size={16} className="spin" />
            <span>{swapStatus || 'Executing Corridor Trade...'}</span>
          </>
        ) : (
          <>
            <Zap size={16} />
            <span>Swap {inTokenSymbol} for {outTokenSymbol}</span>
          </>
        )}
      </button>

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

      {/* Success Card */}
      {lastTxHash && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} color="#059669" />
            <span style={{ fontWeight: 600, color: '#059669' }}>Trade Confirmed!</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={copyTx}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {copiedTx ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              <span>{copiedTx ? 'Copied' : 'Copy Tx'}</span>
            </button>
            <a
              href={`https://celoscan.io/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#059669',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
                fontSize: '11px',
              }}
            >
              <span>Explorer</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
