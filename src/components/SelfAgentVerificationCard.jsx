import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Fingerprint,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Check,
} from 'lucide-react';
import { SelfIcon } from './SelfAgentIdBadge.jsx';
import {
  checkAgentVerificationOnChain,
  initiateAgentRegistrationSession,
  SELF_REGISTRY_CELO_MAINNET,
  SELF_REGISTRY_CELO_TESTNET,
} from '../services/selfAgentIdService.js';
import { OFFICIAL_AGENT_WALLET } from '../config/celo.js';

export default function SelfAgentVerificationCard({
  walletAddress,
  initialAgentTag,
  initialAgentAddress,
  initialChainId = 42220,
  onVerified = null,
}) {
  const [selectedTag, setSelectedTag] = useState(initialAgentTag || '₦nairatag');
  const [agentAddress, setAgentAddress] = useState(initialAgentAddress || walletAddress || OFFICIAL_AGENT_WALLET);

  useEffect(() => {
    if (initialAgentTag) setSelectedTag(initialAgentTag);
    if (initialAgentAddress) setAgentAddress(initialAgentAddress);
  }, [initialAgentTag, initialAgentAddress]);

  const [selfNetwork, setSelfNetwork] = useState(Number(initialChainId) === 11142220 ? 'testnet' : 'mainnet'); // 'mainnet' (42220) | 'testnet' (11142220 Mock)
  const activeChainId = selfNetwork === 'testnet' ? 11142220 : 42220;
  const activeRegistryAddress = selfNetwork === 'testnet' ? SELF_REGISTRY_CELO_TESTNET : SELF_REGISTRY_CELO_MAINNET;
  const [verificationData, setVerificationData] = useState(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const [registrationSession, setRegistrationSession] = useState(null);
  const [isInitiatingSession, setIsInitiatingSession] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCheckVerification = useCallback(async (overrideAddress = null) => {
    const targetAddr = typeof overrideAddress === 'string' && overrideAddress ? overrideAddress : agentAddress;
    if (!targetAddr) return;
    setIsLoadingVerification(true);
    setVerificationError('');
    try {
      const data = await checkAgentVerificationOnChain({
        agentAddress: targetAddr,
        chainId: activeChainId,
        skipCache: true,
      });
      setVerificationData(data);
      if (data?.isVerified && typeof onVerified === 'function') {
        onVerified(data);
      }
    } catch (err) {
      console.warn('[SelfVerificationCheck]', err);
      setVerificationError(`On-chain query failed: ${err.message}`);
    } finally {
      setIsLoadingVerification(false);
    }
  }, [agentAddress, activeChainId]);

  useEffect(() => {
    handleCheckVerification();
  }, [handleCheckVerification]);

  // Auto-poll Self registration status while QR session is active
  useEffect(() => {
    if (!registrationSession?.isLiveSession || !registrationSession?.sessionToken) return undefined;
    let active = true;
    let currentToken = registrationSession.sessionToken;

    const poll = async () => {
      try {
        const res = await fetch('https://agent-api.self.xyz/api/agent/register/status', {
          headers: { Authorization: `Bearer ${currentToken}`, Accept: 'application/json' },
        });
        if (!active || !res.ok) return;
        const status = await res.json();
        if (status?.sessionToken) currentToken = status.sessionToken;
        if (status?.stage === 'completed') {
          const mintedAddr = status.agentAddress || registrationSession.agentAddress;
          setRegistrationSession(null);
          await handleCheckVerification(mintedAddr);
        } else if (status?.stage === 'failed' || status?.stage === 'expired') {
          setVerificationError(`Self registration ${status.stage}. Please generate a new QR code.`);
          setRegistrationSession(null);
        }
      } catch {
        // ignore transient poll error
      }
    };

    const timer = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [registrationSession?.sessionToken, registrationSession?.isLiveSession, registrationSession?.agentAddress, handleCheckVerification]);

  const handleStartVerificationSession = async () => {
    setIsInitiatingSession(true);
    setVerificationError('');
    try {
      const session = await initiateAgentRegistrationSession({
        agentAddress,
        agentTag: selectedTag,
        scope: 'nairatag:agent:human-passport',
        network: selfNetwork,
      });
      setRegistrationSession(session);
      if (session?.agentAddress && session.isLiveSession) {
        setAgentAddress(session.agentAddress);
      }
    } catch (err) {
      setVerificationError(`Failed to initiate Self session: ${err.message}`);
    } finally {
      setIsInitiatingSession(false);
    }
  };

  const registryExplorerUrl = selfNetwork === 'testnet'
    ? `https://celo-sepolia.blockscout.com/address/${activeRegistryAddress}`
    : `https://celoscan.io/address/${activeRegistryAddress}`;

  return (
    <div className="crypto-card-terminal" style={{ margin: '0 auto', maxWidth: '420px' }}>
      {/* Header Bar */}
      <div className="card-header-bar">
        <span className="card-header-title">
          <Fingerprint size={16} color="#0D9488" />
          <span>Self Agent ID</span>
        </span>
        <div className="card-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'inline-flex', borderRadius: '999px', padding: '2px', background: 'rgba(15, 23, 42, 0.06)', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
            <button
              type="button"
              onClick={() => { setSelfNetwork('mainnet'); setRegistrationSession(null); }}
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                background: selfNetwork === 'mainnet' ? '#0D9488' : 'transparent',
                color: selfNetwork === 'mainnet' ? '#ffffff' : 'var(--text-secondary, #64748b)',
              }}
            >
              Mainnet (Real)
            </button>
            <button
              type="button"
              onClick={() => { setSelfNetwork('testnet'); setRegistrationSession(null); }}
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                background: selfNetwork === 'testnet' ? '#7c3aed' : 'transparent',
                color: selfNetwork === 'testnet' ? '#ffffff' : 'var(--text-secondary, #64748b)',
              }}
            >
              Sepolia (Mock)
            </button>
          </div>
          <span className="slippage-pill">
            <ShieldCheck size={11} color={selfNetwork === 'testnet' ? '#7c3aed' : '#0D9488'} />
            <span>{selfNetwork === 'testnet' ? '11142220' : '42220'}</span>
          </span>
        </div>
      </div>

      <p style={{ margin: '4px 0 12px', fontSize: '12px', color: 'var(--text-secondary, #6b7280)', lineHeight: '1.4' }}>
        {selfNetwork === 'testnet'
          ? 'Celo Sepolia Testnet: scan with Mock Document in the Self app.'
          : 'Prove you are a real human once with your passport in the Self app.'}
      </p>

      {/* Target Agent Input + Refresh */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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
          onClick={() => handleCheckVerification()}
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
          <span>Check</span>
        </button>
      </div>

      {verificationError && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '11.5px', fontWeight: 600 }}>
          {verificationError}
        </div>
      )}

      {/* Prominent Verified Badge Card vs Unverified Status */}
      {verificationData?.isVerified ? (
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(13, 148, 136, 0.06) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#059669',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <SelfIcon size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  <CheckCircle2 size={15} />
                  <span>ZK Verified · Human-Backed</span>
                </div>
                <div style={{ fontSize: '11.5px', opacity: 0.75, fontFamily: 'monospace', marginTop: '2px' }}>
                  {agentAddress.slice(0, 8)}...{agentAddress.slice(-6)}
                </div>
              </div>
            </div>

            {verificationData?.agentId > 0 && (
              <a
                href={`https://agent-api.self.xyz/api/agent/info/${activeChainId}/${verificationData.agentId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '6px 11px',
                  borderRadius: '999px',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                <span>Self #{verificationData.agentId}</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '11.5px' }}>
            <span style={{ opacity: 0.75 }}>
              Network: <strong>{selfNetwork === 'testnet' ? 'Celo Sepolia (11142220)' : 'Celo Mainnet (42220)'}</strong>
            </span>
            <a
              href={registryExplorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Registry</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '11.5px', color: 'var(--text-secondary, #6b7280)' }}>
            <span style={{ fontFamily: 'monospace' }}>
              {agentAddress.slice(0, 8)}...{agentAddress.slice(-6)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a
                href={registryExplorerUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#0D9488', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
              >
                <span>Registry</span>
                <ExternalLink size={10} />
              </a>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#D97706' }}>
                <AlertCircle size={12} color="#D97706" />
                <span>Unverified</span>
              </span>
            </div>
          </div>

          {!registrationSession && (
            <button
              type="button"
              onClick={handleStartVerificationSession}
              disabled={isInitiatingSession}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.2)',
              }}
            >
              <Fingerprint size={15} />
              <span>{isInitiatingSession ? 'Generating Session...' : selfNetwork === 'testnet' ? 'Verify with Self App (Mock Passport)' : 'Verify with Self App (NFC Passport)'}</span>
            </button>
          )}
        </>
      )}

      {registrationSession && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--input-bg, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--privy-color-foreground, #111827)' }}>
              {selfNetwork === 'testnet' ? 'Scan with Self App (Mock)' : 'Scan with Self App (NFC)'}
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
                width: '128px',
                height: '128px',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {registrationSession.scanUrl ? (
                <img
                  src={registrationSession.scanUrl}
                  alt="Scan with Self App"
                  style={{ width: '116px', height: '116px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <>
                  <QrCode size={52} color="#0D9488" />
                  <span style={{ fontSize: '8px', fontWeight: 700, color: '#0D9488' }}>SELF APP</span>
                </>
              )}
            </div>
            <div style={{ flex: 1, fontSize: '11.5px', color: 'var(--privy-color-foreground-2, #4b5563)', lineHeight: '1.45' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700 }}>1. Open Self App</p>
              <p style={{ margin: '0 0 4px 0' }}>
                {selfNetwork === 'testnet' ? '2. Scan QR with your Mock Document' : '2. Scan QR & tap NFC Passport'}
              </p>
              <p style={{ margin: '0 0 8px 0' }}>3. Approve proof on {selfNetwork === 'testnet' ? 'Celo Sepolia' : 'Celo Mainnet'}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {registrationSession.deepLink && (
                  <a
                    href={registrationSession.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: '#0D9488',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Open in Self App <ExternalLink size={10} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCheckVerification()}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#111827',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isLoadingVerification ? 'Checking...' : 'Check Status'}
                </button>
              </div>
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
  );
}
