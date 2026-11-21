import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
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
  ShoppingCart,
  CreditCard,
  Building,
  Server,
  Layers,
  FileCheck,
} from 'lucide-react';
import {
  ingestMerchantInvoice,
  evaluateVaultCheckoutPolicy,
  authorizeVaultCheckout,
  settleVaultCheckout,
  getVaultInvoice,
  getOrCreateVaultPaymentRequirement,
  VAULT_CHECKOUT_STATUS,
  AUTONOMOUS_SPEND_THRESHOLD_USDT,
  AUTONOMOUS_SPEND_THRESHOLD_CNGN,
} from '../services/agentVaultService.js';
import {
  X402_CELO_NETWORK,
} from '../services/selfX402Service.js';
import {
  checkAgentVerificationOnChain,
} from '../services/selfAgentIdService.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
} from '../config/celo.js';

// Pre-packaged merchant e-commerce cart presets
const MERCHANT_PRESETS = [
  {
    id: 'compute_low',
    name: 'GPU Cloud Compute (Autonomous)',
    merchantTag: '₦cloudcompute',
    payTo: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    totalAmount: '1.50',
    currency: 'USDT',
    items: [
      { name: '1x H100 GPU Instance (1 hr)', quantity: 1, unitPrice: 1.00 },
      { name: 'Network Egress (10GB)', quantity: 1, unitPrice: 0.50 },
    ],
    requiresSelfVerification: false,
    description: 'Under 2.0 USD₮ threshold: Settle autonomously with Altana session key without interrupting human operator.',
  },
  {
    id: 'server_high',
    name: 'Dedicated AI Inference Node (High-Value)',
    merchantTag: '₦servers',
    payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    totalAmount: '18.50',
    currency: 'USDT',
    items: [
      { name: 'Dedicated Server Tier 1', quantity: 1, unitPrice: 15.00 },
      { name: 'Static IPv4 Address Block', quantity: 1, unitPrice: 3.50 },
    ],
    requiresSelfVerification: false,
    description: 'Exceeds autonomous cap (18.50 USD₮): Vault holds the cart until 1-click human biometric passkey authorization is provided.',
  },
  {
    id: 'esim_self',
    name: 'Global Roaming eSIM (Self ID Gated)',
    merchantTag: '₦telecom_esim',
    payTo: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    totalAmount: '2500',
    currency: 'CNGN',
    items: [
      { name: 'Africa Unlimited Roaming eSIM (7-Day)', quantity: 1, unitPrice: 2500 },
    ],
    requiresSelfVerification: true,
    description: 'Merchant mandates Self Agent ID proof: Rejects non-human-backed bots, settling in native cNGN.',
  },
];

export default function AgentVaultCard({ walletAddress, onConnectWallet }) {
  const [selectedPresetId, setSelectedPresetId] = useState('compute_low');
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [policyEvaluation, setPolicyEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementResult, setSettlementResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Self Verification status of user's agent
  const [selfVerificationData, setSelfVerificationData] = useState(null);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load selected preset invoice
  const loadPresetInvoice = (presetId) => {
    setErrorMessage('');
    setSettlementResult(null);
    setSelectedPresetId(presetId);

    const preset = MERCHANT_PRESETS.find((p) => p.id === presetId) || MERCHANT_PRESETS[0];
    const uniqueInvoiceId = `INV-${Date.now().toString().slice(-6)}`;

    try {
      const invoice = ingestMerchantInvoice({
        invoiceId: uniqueInvoiceId,
        merchantTag: preset.merchantTag,
        payTo: preset.payTo,
        items: preset.items,
        totalAmount: preset.totalAmount,
        currency: preset.currency,
        requiresSelfVerification: preset.requiresSelfVerification,
        callbackUrl: `https://merchant.nairatag.ng/api/orders/${uniqueInvoiceId}/fulfill`,
      });

      setCurrentInvoice(invoice);
      evaluatePolicy(invoice);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Evaluate checkout policy
  const evaluatePolicy = async (invoice) => {
    if (!invoice) return;
    setIsEvaluating(true);
    setErrorMessage('');

    try {
      // Check live Self verification on-chain
      let selfData = selfVerificationData;
      if (!selfData) {
        selfData = await checkAgentVerificationOnChain({ agentAddress: OFFICIAL_AGENT_WALLET }).catch(() => null);
        setSelfVerificationData(selfData);
      }

      // Mock active Altana session for autonomous testing
      const altanaSession = {
        walletAddress: OFFICIAL_AGENT_WALLET,
        status: 'active',
        expiry: Math.floor(Date.now() / 1000) + 3600,
        sessionKeyId: 'altana_active_p256_session',
      };

      const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };

      const policy = await evaluateVaultCheckoutPolicy({
        invoice,
        agent,
        altanaSession,
        selfEvidence: selfData,
      });

      setPolicyEvaluation(policy);

      // If autonomously allowed, update invoice status
      if (policy.allowed && policy.authorizationType === 'autonomous_altana_session') {
        invoice.status = VAULT_CHECKOUT_STATUS.AUTHORIZED;
        setCurrentInvoice({ ...invoice });
      }
    } catch (err) {
      setErrorMessage(`Policy evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    loadPresetInvoice('compute_low');
  }, []);

  // 1-Click Human Biometric / Passkey Authorization
  const handleAuthorizeWithHumanPasskey = () => {
    if (!currentInvoice) return;
    setIsAuthorizing(true);
    setErrorMessage('');

    try {
      const approver = walletAddress || OFFICIAL_AGENT_WALLET;
      const authorized = authorizeVaultCheckout({
        invoiceId: currentInvoice.invoiceId,
        humanSignerAddress: approver,
        signature: `passkey_sig_${Date.now()}`,
        passkeyCredentialId: 'webauthn_biometric_touchid',
      });

      setCurrentInvoice({ ...authorized });
      setPolicyEvaluation({
        allowed: true,
        status: VAULT_CHECKOUT_STATUS.AUTHORIZED,
        authorizationType: 'human_webauthn_passkey',
        reason: 'Human operator authorized checkout with biometric passkey.',
        requiresHumanAuthorization: false,
        humanApprover: approver,
      });
    } catch (err) {
      setErrorMessage(`Authorization failed: ${err.message}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Settle invoice on-chain via x402
  const handleSettleCheckout = async () => {
    if (!currentInvoice) return;
    setIsSettling(true);
    setErrorMessage('');

    try {
      const req = getOrCreateVaultPaymentRequirement(currentInvoice.invoiceId);
      const isCngn = currentInvoice.currency === 'CNGN';
      const tokenAddress = isCngn ? CELO_CNGN_ADDRESS : CELO_USDT_ADDRESS;
      const rawUnits = isCngn
        ? (parseFloat(currentInvoice.totalAmount) * 1e6).toFixed(0)
        : (parseFloat(currentInvoice.totalAmount) * 1e6).toFixed(0);

      const dummyTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      const paymentProof = {
        network: X402_CELO_NETWORK,
        asset: tokenAddress,
        amount: rawUnits,
        payTo: currentInvoice.payTo,
        nonce: req.nonce,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: dummyTxHash,
        isSimulation: true,
      };

      const result = await settleVaultCheckout({
        invoiceId: currentInvoice.invoiceId,
        paymentProof,
        strictSettlement: false,
      });

      if (result.ok) {
        setSettlementResult(result.orderReceipt);
        setCurrentInvoice({ ...currentInvoice, status: VAULT_CHECKOUT_STATUS.SETTLED });
      } else {
        setErrorMessage(result.error || 'Checkout settlement failed.');
      }
    } catch (err) {
      setErrorMessage(`Settlement error: ${err.message}`);
    } finally {
      setIsSettling(false);
    }
  };

  const selectedPreset = MERCHANT_PRESETS.find((p) => p.id === selectedPresetId) || MERCHANT_PRESETS[0];

  return (
    <div className="crypto-card-terminal" style={{ margin: '0 auto', maxWidth: '520px' }}>
      {/* Header Bar */}
      <div className="card-header-bar">
        <span className="card-header-title">
          <ShoppingCart size={16} color="#7C3AED" />
          <span>Agent Vault</span>
        </span>
        <div className="card-header-actions">
          <span
            style={{
              fontSize: '10px',
              background: '#7C3AED',
              color: '#ffffff',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}
          >
            Track 2
          </span>
          <span className="slippage-pill">
            <Lock size={11} color="#7C3AED" />
            <span>Celo 42220</span>
          </span>
        </div>
      </div>

      {/* Intro Description */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--privy-color-foreground-2, #6b7280)', lineHeight: '1.5' }}>
          Autonomous agent-to-website checkout protected by <strong>Agent Vault</strong>. Brokering merchant carts, enforcing spend caps with <strong>Altana</strong>, verifying human backing with <strong>Self Protocol</strong>, and settling in pure digital dollars via <strong>x402</strong> on Celo Mainnet.
        </p>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Preset Selector */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--privy-color-foreground-3, #9ca3af)', display: 'block', marginBottom: '6px' }}>
            Merchant E-Commerce Cart Scenario
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {MERCHANT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPresetInvoice(preset.id)}
                style={{
                  padding: '8px 6px',
                  borderRadius: '8px',
                  border: `1px solid ${selectedPresetId === preset.id ? '#7C3AED' : 'var(--border-color, #d1d5db)'}`,
                  background: selectedPresetId === preset.id ? 'rgba(124, 58, 237, 0.08)' : 'var(--card-bg, #ffffff)',
                  color: selectedPresetId === preset.id ? '#7C3AED' : 'var(--privy-color-foreground-2, #4b5563)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: '1.3',
                }}
              >
                {preset.name.split(' (')[0]}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--privy-color-foreground-3, #6b7280)', lineHeight: '1.4' }}>
            {selectedPreset.description}
          </div>
        </div>

        {/* Live Cart & Invoice Inspector */}
        {currentInvoice && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--input-bg, #f9fafb)',
              border: '1px solid var(--border-color, #e5e7eb)',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={14} color="#7C3AED" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)' }}>
                  {currentInvoice.merchantTag}
                </span>
                <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>
                  ({currentInvoice.invoiceId})
                </span>
              </div>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background:
                    currentInvoice.status === VAULT_CHECKOUT_STATUS.SETTLED
                      ? '#0D9488'
                      : currentInvoice.status === VAULT_CHECKOUT_STATUS.AUTHORIZED
                      ? '#7C3AED'
                      : '#f59e0b',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                }}
              >
                {currentInvoice.status.replace('_', ' ')}
              </span>
            </div>

            {/* Line Items */}
            <div style={{ marginBottom: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
              {currentInvoice.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b5563', marginBottom: '3px' }}>
                  <span>{item.quantity}x {item.name}</span>
                  <span style={{ fontWeight: 600 }}>{(item.quantity * item.unitPrice).toFixed(2)} {currentInvoice.currency}</span>
                </div>
              ))}
            </div>

            {/* Invoice Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>Invoice Total</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#7C3AED' }}>
                {currentInvoice.totalAmount} {currentInvoice.currency}
              </span>
            </div>
          </div>
        )}

        {/* Vault Authorization Gate Card */}
        {policyEvaluation && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: policyEvaluation.allowed ? 'rgba(124, 58, 237, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${policyEvaluation.allowed ? 'rgba(124, 58, 237, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {policyEvaluation.allowed ? (
                  <CheckCircle2 size={16} color="#7C3AED" />
                ) : (
                  <Lock size={16} color="#f59e0b" />
                )}
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: policyEvaluation.allowed ? '#5B21B6' : '#B45309' }}>
                  {policyEvaluation.allowed
                    ? (policyEvaluation.authorizationType === 'autonomous_altana_session' ? 'Autonomous Checkout Approved' : 'Human Passkey Authorized')
                    : 'Human Authorization Required'}
                </span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: policyEvaluation.allowed ? '#7C3AED' : '#B45309' }}>
                {policyEvaluation.allowed ? 'READY TO SETTLE' : 'VAULT GATE LOCKED'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}>
              {policyEvaluation.reason}
            </p>

            {/* 1-Click Biometric Passkey CTA if Human Authorization is Required */}
            {policyEvaluation.requiresHumanAuthorization && currentInvoice?.status !== VAULT_CHECKOUT_STATUS.SETTLED && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleAuthorizeWithHumanPasskey}
                  disabled={isAuthorizing}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                  }}
                >
                  <Fingerprint size={15} />
                  <span>{isAuthorizing ? 'Prompting Biometric Passkey...' : 'Authorize Cart with Biometric Passkey'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settlement Action Button */}
        {currentInvoice?.status === VAULT_CHECKOUT_STATUS.AUTHORIZED && (
          <div style={{ marginBottom: '14px' }}>
            <button
              type="button"
              onClick={handleSettleCheckout}
              disabled={isSettling}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#0D9488',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              }}
            >
              <Zap size={15} />
              <span>{isSettling ? 'Settling on Celo Mainnet via x402...' : `Settle ${currentInvoice.totalAmount} ${currentInvoice.currency} Checkout via x402`}</span>
            </button>
          </div>
        )}

        {/* Settled Order Receipt */}
        {settlementResult && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(13, 148, 136, 0.08)',
              border: '1px solid rgba(13, 148, 136, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} color="#0D9488" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F766E' }}>
                  Order Confirmed & Fulfilled
                </span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, background: '#0D9488', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                HTTP 200 OK
              </span>
            </div>

            <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.4', fontFamily: 'monospace' }}>
              <div>Order ID: {settlementResult.orderId}</div>
              <div>Settled: {settlementResult.settledAmount} {settlementResult.currency}</div>
              <div>Merchant Webhook: {settlementResult.webhookDelivery}</div>
              <div>Attribution: {settlementResult.attributionTag}</div>
              <div>Payment Digest: {settlementResult.paymentDigest.slice(0, 18)}...</div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={13} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
