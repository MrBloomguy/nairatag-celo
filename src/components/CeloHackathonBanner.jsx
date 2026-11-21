import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  ArrowRight,
  Send,
  Terminal,
} from 'lucide-react';
import { publicClient, registerCeloAgentIdentity as registerTaggedErc8004Identity } from '../services/celoPayment.js';
import {
  celoMainnet,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  OFFICIAL_AGENT_WALLET,
  CELO_ERC8004_IDENTITY_REGISTRY as ARC_ERC8004_IDENTITY_REGISTRY,
  ERC8004_IDENTITY_ABI,
  TEXTILE_FX_ROUTER,
} from '../config/celo.js';

export default function CeloHackathonBanner({ userAddress, onConnectWallet }) {
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const activeWallet = userAddress || OFFICIAL_AGENT_WALLET;

  const checkIdentity = useCallback(async () => {
    if (!activeWallet) return;
    setCheckingStatus(true);
    setErrorMessage('');
    try {
      const balance = await publicClient.readContract({
        address: ARC_ERC8004_IDENTITY_REGISTRY,
        abi: ERC8004_IDENTITY_ABI,
        functionName: 'balanceOf',
        args: [activeWallet],
      });
      setIsRegistered(Number(balance) > 0);
    } catch (err) {
      console.warn('Could not read ERC-8004 balance:', err);
    } finally {
      setCheckingStatus(false);
    }
  }, [activeWallet]);

  useEffect(() => {
    checkIdentity();
  }, [checkIdentity]);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleRegister = async () => {
    if (!userAddress) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    setIsTransacting(true);
    setErrorMessage('');
    setStatusMessage('Initiating transaction with attribution suffix...');

    try {
      const result = await registerTaggedErc8004Identity({
        fromAddress: userAddress,
        onStatusUpdate: ({ step, message }) => {
          setStatusMessage(message);
        },
      });

      setTxHash(result.txHash);
      setIsRegistered(true);
      setStatusMessage('Registration confirmed! Both hackathon checks are satisfied.');
      await checkIdentity();
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMessage(err.message || 'Transaction failed or was rejected in wallet.');
      setStatusMessage('');
    } finally {
      setIsTransacting(false);
    }
  };

  const rawCalldata =
    '0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003468747470733a2f2f63656c6f2e6e616972617461672e6e672f2e77656c6c2d6b6e6f776e2f6167656e742d636172642e6a736f6e00000000000000000000000063656c6f5f396637646561626439396136110080218021802180218021802180218021';

  return (
    <div
      style={{
        margin: '12px auto 20px',
        maxWidth: '1100px',
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(53, 208, 127, 0.08) 0%, rgba(20, 184, 166, 0.04) 100%)',
        border: '1px solid rgba(53, 208, 127, 0.25)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(53, 208, 127, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#35D07F',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
            }}
          >
            C
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary, #111)' }}>
              Celo Hackathon · Agents Open for Business
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
              Stablecoin Corridors (USD₮ ⇄ cNGN via Textile FX) · Celo Mainnet (42220)
            </div>
          </div>
        </div>

        {/* Tag Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(53, 208, 127, 0.15)',
              border: '1px solid rgba(53, 208, 127, 0.3)',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 600,
              color: '#059669',
            }}
          >
            <Sparkles size={13} />
            <span>Tag: {CELO_ATTRIBUTION_TAG}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(CELO_ATTRIBUTION_TAG, 'tag')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#059669',
                display: 'flex',
                padding: '2px',
              }}
              title="Copy Tag"
            >
              {copiedField === 'tag' ? <CheckCircle2 size={13} color="#059669" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Status Indicators & Action */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
          marginTop: '14px',
          alignItems: 'center',
        }}
      >
        {/* Check 1: Attribution Tag */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
              1. Attribution Tagging (ERC-8021)
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#059669',
                background: 'rgba(5, 150, 105, 0.1)',
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              Active on all Tx
            </span>
          </div>
          <div style={{ fontSize: '13px', marginTop: '4px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>
            Appended automatically to every call
          </div>
        </div>

        {/* Check 2: ERC-8004 Identity */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
              2. ERC-8004 Identity Check
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={checkIdentity}
                disabled={checkingStatus}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #666)',
                  padding: '2px',
                }}
                title="Refresh on-chain check"
              >
                <RefreshCw size={12} className={checkingStatus ? 'spin' : ''} />
              </button>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isRegistered ? '#059669' : '#d97706',
                  background: isRegistered ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {isRegistered ? 'Registered On-Chain' : 'Pending Registration'}
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: '13px',
              marginTop: '4px',
              fontWeight: 600,
              color: 'var(--text-primary, #111)',
              fontFamily: 'monospace',
            }}
          >
            {activeWallet ? `${activeWallet.slice(0, 8)}...${activeWallet.slice(-6)}` : 'No wallet connected'}
          </div>
        </div>

        {/* 1-Click Action Button */}
        <div>
          <button
            type="button"
            onClick={handleRegister}
            disabled={isTransacting}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '12px',
              background: isRegistered ? '#059669' : 'linear-gradient(135deg, #35D07F 0%, #10b981 100%)',
              color: isRegistered ? '#fff' : '#042f2e',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isTransacting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 10px rgba(53, 208, 127, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {isTransacting ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Broadcasting to Celo...</span>
              </>
            ) : isRegistered ? (
              <>
                <CheckCircle2 size={16} />
                <span>Identity Registered · Re-broadcast Tag</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>1-Click Register Identity & Broadcast Tag</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(5, 150, 105, 0.1)',
            border: '1px solid rgba(5, 150, 105, 0.2)',
            color: '#059669',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={14} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#dc2626',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tx Hash Confirmation Card */}
      {txHash && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--card-bg, #fff)',
            border: '1px solid rgba(53, 208, 127, 0.4)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
              Hackathon Submission Tx:
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
              {`${txHash.slice(0, 10)}...${txHash.slice(-8)}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => copyToClipboard(txHash, 'tx')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(53, 208, 127, 0.15)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                color: '#059669',
              }}
            >
              {copiedField === 'tx' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              <span>{copiedField === 'tx' ? 'Copied!' : 'Copy Hash'}</span>
            </button>
            <a
              href={`https://celoscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'var(--text-primary, #111)',
                textDecoration: 'none',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span>CeloScan</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* Expandable Manual Execution / Calldata Details */}
      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'var(--text-secondary, #666)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          <Terminal size={12} />
          <span>{showTechnicalDetails ? 'Hide Manual Calldata & CLI Details' : 'Manual Calldata & CLI Details'}</span>
          {showTechnicalDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showTechnicalDetails && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.03)',
              border: '1px solid var(--border-color, #e5e7eb)',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ marginBottom: '6px' }}>
              <strong>To Address (ERC-8004 Registry):</strong> {ARC_ERC8004_IDENTITY_REGISTRY}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <strong>Value:</strong> 0 CELO
            </div>
            <div style={{ marginBottom: '6px', wordBreak: 'break-all' }}>
              <strong>Tagged Calldata:</strong> {rawCalldata}
              <button
                type="button"
                onClick={() => copyToClipboard(rawCalldata, 'calldata')}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#059669',
                }}
              >
                {copiedField === 'calldata' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div>
              <strong>Foundry Cast Command:</strong>
              <div
                style={{
                  background: '#111827',
                  color: '#10b981',
                  padding: '8px',
                  borderRadius: '6px',
                  marginTop: '4px',
                  overflowX: 'auto',
                }}
              >
                cast send {ARC_ERC8004_IDENTITY_REGISTRY} {rawCalldata} --value 0 --rpc-url https://forno.celo.org
                --private-key &lt;PRIVATE_KEY&gt;
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
