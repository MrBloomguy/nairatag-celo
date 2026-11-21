import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Fingerprint,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Wallet,
  ArrowRight,
  Send,
  Zap,
  HelpCircle,
  QrCode,
  Check,
} from 'lucide-react';
import {
  initializeAltanaClient,
  createAltanaPasskeyWallet,
  recoverAltanaPasskeyWallet,
  createAltanaWallet,
  createHeadlessPasskeySigner,
  getAltanaWalletBalances,
  buildSessionPolicy,
  buildStandardAgentPolicy,
  buildTaskPaymentPolicy,
  grantAgentSession,
  executeAgentAction,
  getAgentSessionStatus,
  revokeAgentSession,
  isWebAuthnSupported,
  ALTANA_CELO_CHAIN_ID,
  ALTANA_CELO_KEYSTORE,
  TEXTILE_REACTOR_CELO_ADDRESS,
  ERC8004_REGISTRY_CELO_ADDRESS,
} from '../services/altanaWalletService.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
} from '../config/celo.js';

export default function AltanaSessionCard({ walletAddress: fundingWalletAddress, onConnectWallet }) {
  // ─── Smart Wallet State ───
  const [altanaWallet, setAltanaWallet] = useState(null); // { address, adminSigner }
  const [balances, setBalances] = useState({ nativeCelo: '0.00', usdt: '0.00', cngn: '0.00' });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isRecoveringWallet, setIsRecoveringWallet] = useState(false);
  const [showFundingHelper, setShowFundingHelper] = useState(false);

  // ─── Session Authorization Builder State ───
  const [agentTag, setAgentTag] = useState('₦nairatag');
  const [agentAddress, setAgentAddress] = useState(OFFICIAL_AGENT_WALLET);
  const [allowTextile, setAllowTextile] = useState(true);
  const [allowIdentity, setAllowIdentity] = useState(true);
  const [allowTaskPayout, setAllowTaskPayout] = useState(false);
  const [taskRecipientTag, setTaskRecipientTag] = useState('');
  const [taskRecipientAddress, setTaskRecipientAddress] = useState('');
  const [dailyUsdtLimit, setDailyUsdtLimit] = useState('10.0');
  const [dailyCngnLimit, setDailyCngnLimit] = useState('15000.0');
  const [dailyCeloLimit, setDailyCeloLimit] = useState('0.5');
  const [expiryHours, setExpiryHours] = useState('24');

  // ─── Active Session State ───
  const [activeSession, setActiveSession] = useState(null);
  const [sessionKeyId, setSessionKeyId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null); // 'active' | 'expired' | 'revoking' | 'revoked' | 'failed'
  const [grantTxHash, setGrantTxHash] = useState(null);
  const [grantEvidence, setGrantEvidence] = useState(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revocationOutcome, setRevocationOutcome] = useState(null);

  // ─── UI Utilities ───
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [activityHistory, setActivityHistory] = useState([]);

  const webAuthnAvailable = typeof window !== 'undefined' ? isWebAuthnSupported() : false;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ─── Refresh Live Balances ───
  const fetchBalances = useCallback(async () => {
    if (!altanaWallet?.address) return;
    setIsLoadingBalances(true);
    try {
      const bal = await getAltanaWalletBalances({ wallet: altanaWallet });
      setBalances(bal);
    } catch (err) {
      console.warn('[AltanaBalances]', err.message);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [altanaWallet]);

  useEffect(() => {
    if (altanaWallet?.address) {
      fetchBalances();
    }
  }, [altanaWallet, fetchBalances]);

  // ─── 1. Wallet Onboarding: Create Wallet via WebAuthn Passkey ───
  const handleCreatePasskeyWallet = async () => {
    setError('');
    setStatusMessage('');
    setIsCreatingWallet(true);

    try {
      setStatusMessage('Prompting biometric passkey creation (FaceID / TouchID / Windows Hello)...');
      
      let walletHandle;
      if (webAuthnAvailable) {
        walletHandle = await createAltanaPasskeyWallet({
          name: `NairaTag Agent (${agentTag || '₦nairatag'})`,
        });
      } else {
        // Fallback for headless / non-WebAuthn test browser
        setStatusMessage('Using hardware-derived administrative signer...');
        const headlessSigner = createHeadlessPasskeySigner();
        walletHandle = await createAltanaWallet({ adminSigner: headlessSigner });
      }

      setAltanaWallet(walletHandle);
      setStatusMessage(`Altana Smart Agentic Wallet initialized at ${walletHandle.address.slice(0, 6)}...${walletHandle.address.slice(-4)}`);
    } catch (err) {
      console.error('[CreatePasskeyWallet]', err);
      setError(`Failed to create passkey wallet: ${err.message}`);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // ─── 2. Wallet Onboarding: Recover Wallet via WebAuthn Passkey ───
  const handleRecoverPasskeyWallet = async () => {
    setError('');
    setStatusMessage('');
    setIsRecoveringWallet(true);

    try {
      setStatusMessage('Scanning biometric passkey for saved credentials...');
      const recovered = await recoverAltanaPasskeyWallet();
      setAltanaWallet(recovered);
      setStatusMessage(`Smart wallet recovered: ${recovered.address.slice(0, 6)}...${recovered.address.slice(-4)}`);
    } catch (err) {
      console.error('[RecoverPasskeyWallet]', err);
      setError(`Recovery failed: ${err.message}. Ensure you have an existing passkey saved on this device.`);
    } finally {
      setIsRecoveringWallet(false);
    }
  };

  // ─── 3. Session Grant: Build & Sign Bounded Policy ───
  const handleGrantSession = async () => {
    if (!altanaWallet?.adminSigner) {
      setError('Please create or connect an Altana administrator wallet first.');
      return;
    }

    setError('');
    setStatusMessage('');
    setIsGranting(true);

    try {
      setStatusMessage('Constructing mathematically bounded session policy...');

      // Build policy with verified selectors
      const authorizedTransfers = [];
      if (allowTaskPayout && taskRecipientAddress) {
        authorizedTransfers.push({
          token: CELO_USDT_ADDRESS,
          recipient: taskRecipientAddress,
        });
      }

      const policy = buildStandardAgentPolicy({
        allowTextile,
        allowIdentity,
        authorizedTransfers,
        dailyUsdtLimit: dailyUsdtLimit || '0',
        dailyCngnLimit: dailyCngnLimit || '0',
        dailyCeloLimit: dailyCeloLimit || '0',
        expiryDurationSeconds: Number(expiryHours || '24') * 3600,
      });

      setStatusMessage('Awaiting administrator biometric signature to register session on Celo KeyStore...');

      const grantResult = await grantAgentSession({
        wallet: altanaWallet,
        adminSigner: altanaWallet.adminSigner,
        policy,
      });

      setActiveSession(grantResult.session);
      setSessionKeyId(grantResult.keyId);
      setSessionStatus('active');
      setGrantTxHash(grantResult.transactionHash);
      setGrantEvidence(grantResult);
      setStatusMessage(`Session successfully authorized! Active until ${new Date(policy.expiry * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

      setActivityHistory((prev) => [
        {
          type: 'GRANT',
          agent: agentTag,
          keyId: grantResult.keyId,
          txHash: grantResult.transactionHash,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      console.error('[GrantSession]', err);
      setError(`Session grant failed: ${err.message}`);
    } finally {
      setIsGranting(false);
    }
  };

  // ─── 4. Revocation: Immediate On-Chain 1-Tx Revoke ───
  const handleRevokeSession = async () => {
    if (!altanaWallet?.adminSigner || !activeSession) {
      setError('No active session or admin signer available to revoke.');
      return;
    }

    setError('');
    setStatusMessage('');
    setIsRevoking(true);
    setSessionStatus('revoking');

    try {
      setStatusMessage('Authorizing on-chain session revocation with administrator passkey...');

      const revokeResult = await revokeAgentSession({
        wallet: altanaWallet,
        adminSigner: altanaWallet.adminSigner,
        sessionOrPublicKey: activeSession,
      });

      if (revokeResult.isRevoked) {
        setSessionStatus('revoked');
        setRevocationOutcome(revokeResult);
        setStatusMessage(`Session ${revokeResult.keyId.slice(0, 8)}... permanently revoked across Celo KeyStore.`);

        setActivityHistory((prev) => [
          {
            type: 'REVOKE',
            agent: agentTag,
            keyId: revokeResult.keyId,
            txHash: revokeResult.transactionHash,
            timestamp: Date.now(),
          },
          ...prev,
        ]);

        setActiveSession(null);
      } else {
        setSessionStatus('failed');
        setError(`Revocation encountered partial failure on some legs: ${JSON.stringify(revokeResult.legs)}`);
      }
    } catch (err) {
      console.error('[RevokeSession]', err);
      setSessionStatus('failed');
      setError(`Revocation failed: ${err.message}`);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="crypto-card-terminal" style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}>
      {/* ── Header Bar ── */}
      <div className="card-header-bar">
        <span className="card-header-title">
          <Key size={16} color="#5B4FFF" />
          <span>Agent Smart Wallet (Altana)</span>
        </span>
        <div className="card-header-actions">
          <span className="slippage-pill">
            <Fingerprint size={11} style={{ marginRight: '3px' }} />
            EIP-7702
          </span>
        </div>
      </div>

      {/* Subtitle / Advisory */}
      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-secondary, #666)', lineHeight: 1.4 }}>
        Non-custodial agent rails on Celo Mainnet. The human retains root custody via biometric passkey, granting time-bounded, spend-capped sessions to autonomous agents.
      </p>

      {/* ── Status / Error Banners ── */}
      {statusMessage && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(53, 208, 127, 0.1)',
            border: '1px solid rgba(53, 208, 127, 0.3)',
            color: '#065f46',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={15} color="#059669" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#991b1b',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <AlertCircle size={15} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── SECTION 1: Altana Wallet Onboarding ── */}
      {!altanaWallet ? (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--input-bg, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={16} color="#5B4FFF" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Create or Recover Administrator Wallet</span>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary, #666)', margin: 0, lineHeight: 1.4 }}>
            Altana wallets use device-bound WebAuthn Passkeys (P256) as the sovereign root signer. Your extension wallet (MetaMask / MiniPay) serves purely as an external funding source.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCreatePasskeyWallet}
              disabled={isCreatingWallet || isRecoveringWallet}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#5B4FFF',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Fingerprint size={15} />
              <span>{isCreatingWallet ? 'Creating...' : 'Create with Passkey'}</span>
            </button>

            <button
              type="button"
              onClick={handleRecoverPasskeyWallet}
              disabled={isCreatingWallet || isRecoveringWallet}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--text-primary, #111)',
                border: '1px solid var(--border-color, #d1d5db)',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} />
              <span>{isRecoveringWallet ? 'Recovering...' : 'Recover Wallet'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Connected Altana Smart Wallet Info Card ── */
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'var(--input-bg, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#059669" />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Altana Smart Wallet</span>
            </div>
            <button
              type="button"
              onClick={fetchBalances}
              disabled={isLoadingBalances}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                color: 'var(--text-secondary, #666)',
              }}
              title="Refresh balances"
            >
              <RefreshCw size={12} className={isLoadingBalances ? 'spin' : ''} />
            </button>
          </div>

          {/* Address Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
              {altanaWallet.address.slice(0, 10)}...{altanaWallet.address.slice(-8)}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => copyToClipboard(altanaWallet.address, 'wallet')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                title="Copy Smart Account Address"
              >
                {copiedKey === 'wallet' ? <Check size={14} color="#059669" /> : <Copy size={14} color="#666" />}
              </button>
              <a
                href={`https://celoscan.io/address/${altanaWallet.address}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#666', display: 'flex', alignItems: 'center' }}
                title="View on CeloScan"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Balances Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#666', display: 'block' }}>Gas (CELO)</span>
              <span style={{ fontWeight: 700 }}>{Number(balances.nativeCelo).toFixed(3)}</span>
            </div>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#666', display: 'block' }}>USD₮</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>${Number(balances.usdt).toFixed(2)}</span>
            </div>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#666', display: 'block' }}>cNGN</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>₦{Number(balances.cngn).toLocaleString()}</span>
            </div>
          </div>

          {/* Funding helper toggle */}
          <div style={{ paddingTop: '2px' }}>
            <button
              type="button"
              onClick={() => setShowFundingHelper((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#5B4FFF',
                fontWeight: 600,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <HelpCircle size={12} />
              <span>{showFundingHelper ? 'Hide funding instructions' : 'How to fund this agent wallet'}</span>
            </button>

            {showFundingHelper && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#f3f4f6',
                  fontSize: '11px',
                  color: '#4b5563',
                  lineHeight: 1.4,
                }}
              >
                <strong>Funding Instructions:</strong> Transfer gas (CELO) and stablecoins (USD₮ / cNGN) directly from your MetaMask or MiniPay wallet ({fundingWalletAddress ? `${fundingWalletAddress.slice(0, 6)}...` : 'connected wallet'}) to this Altana Smart Account address:
                <div style={{ fontFamily: 'monospace', margin: '6px 0', wordBreak: 'break-all', fontWeight: 600, color: '#111' }}>
                  {altanaWallet.address}
                </div>
                Your passkey administrator signs session delegations; the agent spends only from these deposited funds within granted caps.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 2: Active Session Status Card (If one exists) ── */}
      {activeSession && (
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(91, 79, 255, 0.05)',
            border: '1px solid rgba(91, 79, 255, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} color="#5B4FFF" />
              <span>Active Agent Session</span>
            </span>

            {/* Status Badge */}
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background:
                  sessionStatus === 'active'
                    ? 'rgba(5, 150, 105, 0.15)'
                    : sessionStatus === 'revoking'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color:
                  sessionStatus === 'active'
                    ? '#059669'
                    : sessionStatus === 'revoking'
                    ? '#d97706'
                    : '#dc2626',
              }}
            >
              {sessionStatus === 'active'
                ? 'Active'
                : sessionStatus === 'revoking'
                ? 'Revocation Pending'
                : 'Revoked'}
            </span>
          </div>

          <div style={{ fontSize: '11.5px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Authorized Agent:</span>
              <strong style={{ color: '#111' }}>{agentTag}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Session Key ID:</span>
              <span style={{ fontFamily: 'monospace' }}>
                {sessionKeyId ? `${sessionKeyId.slice(0, 10)}...${sessionKeyId.slice(-6)}` : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Daily Spend Cap:</span>
              <strong>{dailyUsdtLimit} USD₮ / {dailyCngnLimit} cNGN</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Expires At:</span>
              <span>{activeSession.expiry ? new Date(activeSession.expiry * 1000).toLocaleString() : 'N/A'}</span>
            </div>
            {grantTxHash && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Grant Tx:</span>
                <a
                  href={`https://celoscan.io/tx/${grantTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#5B4FFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <span>{grantTxHash.slice(0, 8)}...</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Revoke Action */}
          <button
            type="button"
            onClick={handleRevokeSession}
            disabled={isRevoking}
            style={{
              marginTop: '4px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={13} />
            <span>{isRevoking ? 'Revoking On-Chain...' : 'Revoke Session Key'}</span>
          </button>
        </div>
      )}

      {/* ── SECTION 3: Session Builder & Authorization ── */}
      {(!activeSession || sessionStatus === 'revoked') && altanaWallet && (
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: '#fff',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Key size={15} color="#5B4FFF" />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Delegate Session Key to Agent</span>
          </div>

          {/* Agent Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
              Target Autonomous Agent
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={agentTag}
                onChange={(e) => setAgentTag(e.target.value)}
                placeholder="₦nairatag"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '12.5px',
                  background: '#f9fafb',
                  fontWeight: 600,
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 600,
                }}
              >
                ERC-8004
              </span>
            </div>
          </div>

          {/* Scope & Capability Checkboxes */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '6px' }}>
              Authorized Protocol Capabilities
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowTextile}
                  onChange={(e) => setAllowTextile(e.target.checked)}
                />
                <span>Textile FX LimitOrderReactor (executeBatch on 0xa9AA...35b3)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowIdentity}
                  onChange={(e) => setAllowIdentity(e.target.checked)}
                />
                <span>ERC-8004 Agent Identity Maintenance (register & setAgentURI)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowTaskPayout}
                  onChange={(e) => setAllowTaskPayout(e.target.checked)}
                />
                <span>Human-Approved Task / Booking Settlement (Recipient-Bound Transfer)</span>
              </label>
            </div>

            {allowTaskPayout && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '2px' }}>
                  Authorized Recipient Address (Worker / Creator)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={taskRecipientAddress}
                  onChange={(e) => setTaskRecipientAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            )}
          </div>

          {/* Security Advisory Pill */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(91, 79, 255, 0.05)',
              border: '1px solid rgba(91, 79, 255, 0.15)',
              fontSize: '11px',
              color: '#4338ca',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={14} color="#5B4FFF" style={{ flexShrink: 0 }} />
            <span>
              <strong>Security Policy:</strong> Generic ERC-20 approvals (<code>approve</code>) are prohibited to prevent allowance bypasses. Arbitrary recipient transfers are blocked.
            </span>
          </div>

          {/* Spend Limits & Expiry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '2px' }}>
                Daily USD₮ Spend Cap
              </label>
              <input
                type="number"
                value={dailyUsdtLimit}
                onChange={(e) => setDailyUsdtLimit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '2px' }}>
                Daily cNGN Spend Cap
              </label>
              <input
                type="number"
                value={dailyCngnLimit}
                onChange={(e) => setDailyCngnLimit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '2px' }}>
              Session Expiry
            </label>
            <select
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 8px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '12px',
                background: '#fff',
              }}
            >
              <option value="1">1 Hour (Quick task execution)</option>
              <option value="6">6 Hours</option>
              <option value="24">24 Hours (Standard daily session)</option>
              <option value="168">7 Days (Continuous commerce bot)</option>
            </select>
          </div>

          {/* Grant Action Button */}
          <button
            type="button"
            onClick={handleGrantSession}
            disabled={isGranting}
            style={{
              marginTop: '4px',
              padding: '11px 16px',
              borderRadius: '8px',
              background: '#5B4FFF',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Fingerprint size={16} />
            <span>{isGranting ? 'Signing Delegation...' : 'Authorize & Grant Session Key'}</span>
          </button>
        </div>
      )}

      {/* ── SECTION 4: Activity History ── */}
      {activityHistory.length > 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--input-bg, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
            fontSize: '11.5px',
          }}
        >
          <span style={{ fontWeight: 700, display: 'block', marginBottom: '8px' }}>Session Audit Trail</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activityHistory.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fff',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: item.type === 'GRANT' ? '#059669' : '#dc2626',
                      marginRight: '6px',
                    }}
                  >
                    {item.type}
                  </span>
                  <span>{item.agent}</span>
                </div>
                {item.txHash && (
                  <a
                    href={`https://celoscan.io/tx/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#5B4FFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <span>{item.txHash.slice(0, 6)}...</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
