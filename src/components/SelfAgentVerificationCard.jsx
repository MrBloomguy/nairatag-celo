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

      <div style={{ padding: '4px 0 12px 0' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #6b7280)', lineHeight: '1.4' }}>
          Zero-knowledge identity & x402 micropayments on Celo Mainnet.
        </p>
      </div>

      {/* ─── Hackathon Track 3: 1-Click Interactive Scenarios ─── */}
      <div style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: '10px', padding: '10px', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--privy-color-foreground-2, #475569)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Verified Agent Payments · Test Scenarios
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedTag('₦unverified');
              setAgentAddress('0x000000000000000000000000000000000000dEaD');
              resetFlow();
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fff1f2',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            title="Load unverified agent to verify access denial"
          >
            <strong>Scenario A</strong>: Unverified (403)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTag('₦nairatag');
              setAgentAddress(OFFICIAL_AGENT_WALLET);
              resetFlow();
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            title="Load verified official agent to verify 402 challenge and execution"
          >
            <strong>Scenario B/C</strong>: Verified (402 → Pay)
          </button>
        </div>
      </div>

      {/* Target Agent & Verification Status */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            placeholder="Agent ₦Tag"
            style={{
              flex: 1,
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
              color: 'var(--privy-color-foreground, #111827)',
            }}
          >
            <RefreshCw size={13} className={isLoadingVerification ? 'animate-spin' : ''} />
            <span>Verify</span>
          </button>
        </div>

        {/* Compact Status Pill Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary, #6b7280)' }}>
          <span style={{ fontFamily: 'monospace' }}>
            {agentAddress.slice(0, 6)}...{agentAddress.slice(-4)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={`https://celoscan.io/address/${SELF_CELO_REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#0D9488', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>Registry</span>
              <ExternalLink size={9} />
            </a>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: 600,
                color: verificationData?.isVerified ? '#0D9488' : '#D97706',
              }}
            >
              {verificationData?.isVerified ? (
                <>
                  <CheckCircle2 size={12} color="#0D9488" />
                  <span>ZK Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} color="#D97706" />
                  <span>Unverified</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Verify Action Button / QR Flow */}
      {!verificationData?.isVerified && !registrationSession && (
        <button
          type="button"
          onClick={handleStartVerificationSession}
          disabled={isInitiatingSession}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '14px',
            boxShadow: '0 2px 6px rgba(13, 148, 136, 0.2)',
          }}
        >
          <Fingerprint size={14} />
          <span>{isInitiatingSession ? 'Generating Session...' : 'Verify with Self App (NFC Passport)'}</span>
        </button>
      )}

      {registrationSession && (
        <div
          style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--input-bg, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)' }}>
              Scan with Self App (NFC)
            </span>
            <button
              type="button"
              onClick={() => setRegistrationSession(null)}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '11px' }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                textAlign: 'center',
              }}
            >
              <QrCode size={52} color="#0D9488" />
              <span style={{ fontSize: '8px', fontWeight: 700, color: '#0D9488' }}>SELF APP</span>
            </div>
            <div style={{ flex: 1, fontSize: '11px', color: 'var(--privy-color-foreground-2, #4b5563)', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>1. Open Self App</p>
              <p style={{ margin: '0 0 4px 0' }}>2. Scan Passport RFID via NFC</p>
              <p style={{ margin: 0 }}>3. ZK Proof minted on Celo</p>
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

      {/* x402 Micropayment Flow */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="#0D9488" />
            <span>x402 Micropayment</span>
          </span>
          <div style={{ display: 'flex', background: 'var(--input-bg, #f3f4f6)', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setIsSimulationMode(true)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                background: isSimulationMode ? '#f59e0b' : 'transparent',
                color: isSimulationMode ? '#ffffff' : 'var(--text-secondary, #6b7280)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Simulation
            </button>
            <button
              type="button"
              onClick={() => setIsSimulationMode(false)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                background: !isSimulationMode ? '#0D9488' : 'transparent',
                color: !isSimulationMode ? '#ffffff' : 'var(--text-secondary, #6b7280)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Live
            </button>
          </div>
        </div>

        {/* Capability & Asset Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '10px' }}>
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
              fontWeight: 500,
              color: 'var(--privy-color-foreground, #111827)',
            }}
          >
            <option value="cngn_forex_intelligence">cNGN Forex Intel</option>
            <option value="arbitrage_signal_feed">Arbitrage Signals</option>
          </select>
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
              fontWeight: 500,
              color: 'var(--privy-color-foreground, #111827)',
            }}
          >
            <option value="USDT">0.05 USD₮</option>
            <option value="CNGN">75 cNGN</option>
          </select>
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
            <span>Request Capability (Trigger 402)</span>
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
                402 Payment Required Issued
              </span>
              <span style={{ fontSize: '9.5px', background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                {paymentAsset === 'USDT' ? `${customPrice} USD₮` : `${parseFloat(customPrice) * 1500} cNGN`}
              </span>
            </div>
            <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#4b5563' }}>
              PayTo: {activeChallenge.payTo.slice(0, 8)}...{activeChallenge.payTo.slice(-6)}
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
                  Execution Complete (HTTP 200)
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
              <div style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '10.5px' }}>
                {JSON.stringify(executionResult.data?.marketSummary, null, 2)}
              </div>
            </div>

            <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
              <span>Attribution: {executionResult.attributionTag}</span>
              <span>Tx: {paymentProofData?.txHash?.slice(0, 10)}...</span>
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
                <span>Retry Execution</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
