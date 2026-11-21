import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowRight,
  Send,
  Zap,
  HelpCircle,
  QrCode,
  Check,
  Lock,
  Unlock,
  Coins,
  Cpu,
  Eye,
  FileCheck,
} from 'lucide-react';
import {
  checkAgentVerificationOnChain,
  evaluateAgentCapabilityAccess,
  initiateAgentRegistrationSession,
  validateEvidenceIdentityBinding,
  SELF_CELO_REGISTRY_ADDRESS,
  SELF_CELO_PROOF_PROVIDER,
  VERIFICATION_STATUS,
  VERIFICATION_POLICIES,
} from '../services/selfAgentIdService.js';
import {
  createX402PaymentRequirement,
  verifyX402PaymentProof,
  buildX402Response,
  executeSelfGatedAgentCapability,
  X402_CELO_NETWORK,
} from '../services/selfX402Service.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
} from '../config/celo.js';

export default function SelfAgentVerificationCard({ walletAddress, onConnectWallet }) {
  // ─── Target Agent Selection ───
  const [selectedTag, setSelectedTag] = useState('₦nairatag');
  const [agentAddress, setAgentAddress] = useState(OFFICIAL_AGENT_WALLET);

  // ─── Verification State ───
  const [verificationData, setVerificationData] = useState(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // ─── Registration Session (QR / Deep Link) ───
  const [registrationSession, setRegistrationSession] = useState(null);
  const [isInitiatingSession, setIsInitiatingSession] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // ─── x402 Execution Playground State ───
  const [selectedCapability, setSelectedCapability] = useState('cngn_forex_intelligence');
  const [paymentAsset, setPaymentAsset] = useState('USDT'); // 'USDT' | 'CNGN'
  const [customPrice, setCustomPrice] = useState('0.05');
  const [isSimulationMode, setIsSimulationMode] = useState(true); // true: Playground preview, false: Live on-chain
  const [flowStep, setFlowStep] = useState(0); // 0: Idle, 1: 402 Challenge Issued, 2: Payment Settled, 3: Executed
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [paymentProofData, setPaymentProofData] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState('');
  const [canRetry, setCanRetry] = useState(false);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ─── Check On-Chain Verification ───
  const handleCheckVerification = useCallback(async () => {
    if (!agentAddress) return;
    setIsLoadingVerification(true);
    setVerificationError('');
    try {
      const data = await checkAgentVerificationOnChain({ agentAddress });
      setVerificationData(data);
    } catch (err) {
      console.warn('[SelfVerificationCheck]', err);
      setVerificationError(`On-chain query failed: ${err.message}`);
    } finally {
      setIsLoadingVerification(false);
    }
  }, [agentAddress]);

  useEffect(() => {
    handleCheckVerification();
  }, [handleCheckVerification]);

  // ─── Initiate Self Registration Flow ───
  const handleStartVerificationSession = async () => {
    setIsInitiatingSession(true);
    setVerificationError('');
    try {
      const session = await initiateAgentRegistrationSession({
        agentAddress,
        agentTag: selectedTag,
        scope: 'nairatag:agent:human-passport',
      });
      setRegistrationSession(session);
    } catch (err) {
      setVerificationError(`Failed to initiate Self session: ${err.message}`);
    } finally {
      setIsInitiatingSession(false);
    }
  };

  // ─── x402 Step 1: Request Gated Service -> Get 402 Challenge ───
  const handleTrigger402Challenge = async () => {
    setIsExecuting(true);
    setExecutionError('');
    setFlowStep(1);
    setExecutionResult(null);

    const assetAddress = paymentAsset === 'USDT' ? CELO_USDT_ADDRESS : CELO_CNGN_ADDRESS;
    const priceAmount = paymentAsset === 'USDT' ? customPrice : (parseFloat(customPrice) * 1500).toString();

    try {
      const agentRecord = {
        tag: selectedTag.replace('₦', '').toLowerCase(),
        canonicalTag: selectedTag,
        owner: agentAddress,
      };

      // Call without payment proof to trigger the 402 challenge
      const response = await executeSelfGatedAgentCapability({
        agent: agentRecord,
        capability: selectedCapability,
        callerWallet: walletAddress,
        paymentProof: null,
        isPaid: true,
        price: priceAmount,
        asset: assetAddress,
        verificationEvidence: verificationData?.isVerified ? verificationData : null,
      });

      if (response.status === 402) {
        setActiveChallenge(response.body.paymentRequirement);
        setFlowStep(1);
      } else if (!response.ok) {
        setExecutionError(`Gate check rejected: ${response.error || response.reason}`);
        setFlowStep(0);
      }
    } catch (err) {
      setExecutionError(`Execution request failed: ${err.message}`);
      setFlowStep(0);
    } finally {
      setIsExecuting(false);
    }
  };

  // ─── x402 Step 2 & 3: Settle Payment & Execute ───
  const handleSettleAndExecute = async () => {
    if (!activeChallenge) return;
    setIsExecuting(true);
    setExecutionError('');
    setCanRetry(false);

    try {
      let txHashToSubmit = null;
      if (!isSimulationMode) {
        if (!walletAddress) {
          onConnectWallet?.();
          setIsExecuting(false);
          return;
        }
        // In live mode, verify on-chain settlement
        setExecutionError('Live Mainnet settlement requires funded wallet approval. Please switch to simulation mode for zero-cost sandbox testing, or approve Celo transfer.');
        setIsExecuting(false);
        return;
      } else {
        // Playground simulation proof explicitly flagged as simulation
        txHashToSubmit = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      }

      const proof = {
        network: X402_CELO_NETWORK,
        asset: activeChallenge.asset,
        amount: activeChallenge.amount,
        payTo: activeChallenge.payTo,
        nonce: activeChallenge.nonce,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: txHashToSubmit,
        isSimulation: isSimulationMode,
      };

      setPaymentProofData(proof);
      setFlowStep(2);

      // Brief delay for visualization
      await new Promise((r) => setTimeout(r, 600));

      const agentRecord = {
        tag: selectedTag.replace('₦', '').toLowerCase(),
        canonicalTag: selectedTag,
        owner: agentAddress,
      };

      // Execute capability with verified proof
      const response = await executeSelfGatedAgentCapability({
        agent: agentRecord,
        capability: selectedCapability,
        callerWallet: walletAddress,
        paymentProof: proof,
        isPaid: true,
        price: activeChallenge.amount,
        asset: activeChallenge.asset,
        verificationEvidence: verificationData?.isVerified ? verificationData : null,
        strictSettlement: !isSimulationMode,
        executeHandler: async ({ agent, paymentReceipt }) => {
          return {
            intelligenceKey: selectedCapability,
            feedTimestamp: new Date().toISOString(),
            marketSummary: {
              corridor: 'cNGN/USD₮',
              referenceRate: '1443.98 NGN per USD',
              liquidityDepth: '48,500 USD₮ / 70,000,000 cNGN',
              arbitrageSpreadBps: 18.5,
              settlementVelocity: '< 1,200ms on Celo Mainnet',
            },
            agentNode: agent.tag,
            paymentDigest: paymentReceipt.paymentDigest,
            attribution: CELO_ATTRIBUTION_TAG,
          };
        },
      });

      if (response.ok) {
        setExecutionResult(response);
        setFlowStep(3);
      } else {
        setExecutionError(`Capability execution failed: ${response.error} - ${response.reason}`);
        if (response.canRetryWithoutRepay) {
          setCanRetry(true);
        }
      }
    } catch (err) {
      setExecutionError(`Settlement failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const resetFlow = () => {
    setFlowStep(0);
    setActiveChallenge(null);
    setPaymentProofData(null);
    setExecutionResult(null);
    setExecutionError('');
    setCanRetry(false);
  };

  return (
    <div className="crypto-card-terminal" style={{ margin: '0 auto', maxWidth: '520px' }}>
      {/* Header Bar */}
      <div className="card-header-bar">
        <span className="card-header-title">
          <Fingerprint size={16} color="#0D9488" />
          <span>Self Agent ID</span>
        </span>
        <div className="card-header-actions">
          <span className="slippage-pill">
            <ShieldCheck size={11} color="#0D9488" />
            <span>Celo 42220</span>
          </span>
        </div>
      </div>

      {/* Intro Description */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--privy-color-foreground-2, #6b7280)', lineHeight: '1.5' }}>
          Zero-knowledge identity verification for autonomous agents powered by <strong>Self Protocol</strong> on Celo Mainnet.
          Human passport proofs bind to sovereign ₦Tags with zero privacy leakage, unlocking protected capabilities and <strong>x402 pay-per-request monetization</strong>.
        </p>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Agent Target Picker */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--privy-color-foreground-3, #9ca3af)', display: 'block', marginBottom: '6px' }}>
            Target Agent Sovereign ₦Tag
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--input-bg, #f9fafb)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--privy-color-foreground, #111827)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleCheckVerification}
              disabled={isLoadingVerification}
              style={{
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                background: 'var(--card-bg, #ffffff)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={13} className={isLoadingVerification ? 'animate-spin' : ''} />
              <span>Verify</span>
            </button>
          </div>
          <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--privy-color-foreground-3, #9ca3af)', fontFamily: 'monospace' }}>
            Address: {agentAddress}
          </div>
        </div>

        {/* Verification Status Card */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: verificationData?.isVerified ? 'rgba(13, 148, 136, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${verificationData?.isVerified ? 'rgba(13, 148, 136, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {verificationData?.isVerified ? (
                <ShieldCheck size={18} color="#0D9488" />
              ) : (
                <ShieldAlert size={18} color="#f59e0b" />
              )}
              <span style={{ fontSize: '13px', fontWeight: 700, color: verificationData?.isVerified ? '#0F766E' : '#B45309' }}>
                {verificationData?.isVerified ? 'Verified Human-Backed Agent' : 'Unverified Agent Identity'}
              </span>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: verificationData?.isVerified ? '#0D9488' : '#f59e0b',
                color: '#ffffff',
                textTransform: 'uppercase',
              }}
            >
              {verificationData?.status || 'UNVERIFIED'}
            </span>
          </div>

          <div style={{ fontSize: '11.5px', color: 'var(--privy-color-foreground-2, #4b5563)', display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Self Registry:</span>
              <a
                href={`https://celoscan.io/address/${SELF_CELO_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'monospace', color: '#0D9488', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                {SELF_CELO_REGISTRY_ADDRESS.slice(0, 6)}...{SELF_CELO_REGISTRY_ADDRESS.slice(-4)}
                <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Proof Provider:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--privy-color-foreground-2, #4b5563)' }}>
                {SELF_CELO_PROOF_PROVIDER.slice(0, 6)}...{SELF_CELO_PROOF_PROVIDER.slice(-4)} (Self Protocol)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Proof Freshness:</span>
              <span style={{ fontWeight: 600, color: verificationData?.isProofFresh ? '#0D9488' : '#f59e0b' }}>
                {verificationData?.isProofFresh ? 'Active & Fresh (< 365 Days)' : 'Pending / Not Minted'}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Action: Self App QR Code & NFC Flow */}
        <div style={{ marginBottom: '16px' }}>
          {!registrationSession ? (
            <button
              type="button"
              onClick={handleStartVerificationSession}
              disabled={isInitiatingSession}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              }}
            >
              <Fingerprint size={15} />
              <span>{isInitiatingSession ? 'Generating Session...' : 'Verify Agent with Self App (NFC Passport)'}</span>
            </button>
          ) : (
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'var(--input-bg, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)' }}>
                  Scan with Self Mobile App
                </span>
                <button
                  type="button"
                  onClick={() => setRegistrationSession(null)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '11px' }}
                >
                  Close
                </button>
              </div>

              {/* QR Code representation */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  <QrCode size={64} color="#0D9488" />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#0D9488', marginTop: '2px' }}>SELF APP</span>
                </div>
                <div style={{ flex: 1, fontSize: '11px', color: 'var(--privy-color-foreground-2, #4b5563)', lineHeight: '1.4' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>1. Open Self App (iOS / Android)</p>
                  <p style={{ margin: '0 0 6px 0' }}>2. Scan your e-Passport RFID chip with NFC</p>
                  <p style={{ margin: 0 }}>3. Zero-Knowledge proof minted directly to Celo Mainnet</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  readOnly
                  value={registrationSession.deepLink}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    fontSize: '10.5px',
                    fontFamily: 'monospace',
                    color: '#4b5563',
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(registrationSession.deepLink, 'deeplink')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copiedKey === 'deeplink' ? <Check size={12} color="#0D9488" /> : <Copy size={12} />}
                  <span>{copiedKey === 'deeplink' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Capability Policy Matrix */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--privy-color-foreground-3, #9ca3af)', display: 'block', marginBottom: '8px' }}>
            Access & Monetization Policy
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--input-bg, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <Unlock size={11} color="#6b7280" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)' }}>Public</span>
              </div>
              <span style={{ fontSize: '10px', color: '#6b7280' }}>quote_rate, resolve_tag (Free)</span>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <Lock size={11} color="#0D9488" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F766E' }}>Self-Gated</span>
              </div>
              <span style={{ fontSize: '10px', color: '#0F766E' }}>market_depth, submit_task</span>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <Coins size={11} color="#B45309" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>x402 Paid</span>
              </div>
              <span style={{ fontSize: '10px', color: '#B45309' }}>forex_intel (0.05 USD₮)</span>
            </div>
          </div>
        </div>

        {/* x402 Interactive Paid Service Invocation Playground */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#0D9488" />
              <span>x402 Agent Micro-Payment Flow</span>
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--privy-color-foreground-3, #9ca3af)' }}>
              Protocol: RFC-9110 / x402
            </span>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', background: 'var(--input-bg, #f3f4f6)', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setIsSimulationMode(true)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: isSimulationMode ? '#f59e0b' : 'transparent',
                color: isSimulationMode ? '#ffffff' : '#4b5563',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Playground Simulation
            </button>
            <button
              type="button"
              onClick={() => setIsSimulationMode(false)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: !isSimulationMode ? '#0D9488' : 'transparent',
                color: !isSimulationMode ? '#ffffff' : '#4b5563',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Live On-Chain Settlement
            </button>
          </div>

          {/* Mode Explanation Warning Banner */}
          {isSimulationMode ? (
            <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '12px', fontSize: '11px', color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#B45309" />
              <span><strong>Simulation Mode:</strong> Zero-cost preview. Real production facilitators require mined on-chain transactions on Celo Mainnet.</span>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.3)', marginBottom: '12px', fontSize: '11px', color: '#0F766E', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#0D9488" />
              <span><strong>Live Settlement Mode:</strong> Requires funded wallet approval and confirmed transaction on Celo Mainnet (Chain ID 42220).</span>
            </div>
          )}

          {/* Capability Selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                Gated Capability
              </label>
              <select
                value={selectedCapability}
                onChange={(e) => setSelectedCapability(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--input-bg, #f9fafb)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <option value="cngn_forex_intelligence">cNGN Forex Intelligence (Gated)</option>
                <option value="arbitrage_signal_feed">Arbitrage Signal Feed (Gated)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                Settlement Asset
              </label>
              <select
                value={paymentAsset}
                onChange={(e) => setPaymentAsset(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--input-bg, #f9fafb)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <option value="USDT">USD₮ (Celo)</option>
                <option value="CNGN">cNGN (Celo)</option>
              </select>
            </div>
          </div>

          {/* Step 1 Button: Request Capability without payment to trigger 402 */}
          {flowStep === 0 && (
            <button
              type="button"
              onClick={handleTrigger402Challenge}
              disabled={isExecuting}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'var(--input-bg, #f3f4f6)',
                color: 'var(--privy-color-foreground, #111827)',
                border: '1px solid var(--border-color, #d1d5db)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Request Gated Capability (Trigger HTTP 402)</span>
              <ArrowRight size={13} />
            </button>
          )}

          {/* Step 1 Visual: 402 Challenge Issued */}
          {flowStep >= 1 && activeChallenge && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>
                  HTTP 402 Payment Required Issued
                </span>
                <span style={{ fontSize: '9.5px', background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                  WWW-Authenticate
                </span>
              </div>
              <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#4b5563', lineHeight: '1.4' }}>
                <div>Price: {paymentAsset === 'USDT' ? `${customPrice} USD₮` : `${parseFloat(customPrice) * 1500} cNGN`}</div>
                <div>PayTo: {activeChallenge.payTo.slice(0, 8)}...{activeChallenge.payTo.slice(-6)}</div>
                <div>Challenge Nonce: {activeChallenge.nonce.slice(0, 14)}...</div>
              </div>
            </div>
          )}

          {/* Step 2 Button: Settle Payment & Execute Capability */}
          {flowStep === 1 && (
            <button
              type="button"
              onClick={handleSettleAndExecute}
              disabled={isExecuting}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#0D9488',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Coins size={14} />
              <span>{isExecuting ? 'Settling Payment & Executing...' : 'Settle x402 Micropayment & Invoke Agent'}</span>
            </button>
          )}

          {/* Step 3 Visual: Returned Output & Audit Receipt */}
          {flowStep === 3 && executionResult && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(13, 148, 136, 0.08)',
                border: '1px solid rgba(13, 148, 136, 0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={15} color="#0D9488" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F766E' }}>
                    Agent Execution Complete (HTTP 200)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetFlow}
                  style={{ background: 'none', border: 'none', color: '#0D9488', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#374151', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>Forex Intelligence Deliverable:</div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '10.5px' }}>
                  {JSON.stringify(executionResult.data?.marketSummary, null, 2)}
                </div>
              </div>

              <div style={{ fontSize: '10.5px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace' }}>
                <div>Attribution: {executionResult.attributionTag}</div>
                <div>Payment Digest: {executionResult.paymentReceipt?.paymentDigest?.slice(0, 18)}...</div>
                <div>Proof Tx: {paymentProofData?.txHash?.slice(0, 18)}...</div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {executionError && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={13} />
                <span>{executionError}</span>
              </div>
              {canRetry && (
                <button
                  type="button"
                  onClick={handleSettleAndExecute}
                  disabled={isExecuting}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} className={isExecuting ? 'animate-spin' : ''} />
                  <span>Retry Execution (Without Double-Charging)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
