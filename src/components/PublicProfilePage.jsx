import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Link2,
  MapPin,
  MessageSquare,
  Moon,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
  Zap,
} from 'lucide-react';
import { resolveTagProfile, generateAvatarSvg } from '../services/tagAvatar.js';
import { resolveTag } from '../services/nairatagResolver.js';
import { getAgentControlStatus } from '../services/agentLifecycleService.js';
import { CELO_NAIRATAG_RESOLVER_ADDRESS } from '../config/celo.js';
import { IS_CONCORDIUM_SITE, CONCORDIUM_SITE } from '../config/siteMode.js';
import confetti from 'canvas-confetti';

export default function PublicProfilePage({ rawHandle }) {
  const cleanTag = String(rawHandle || 'nairatag').replace(/^[₦$@#]/, '').trim();
  const displayTag = `₦${cleanTag.toUpperCase()}`;
  const lowercaseTag = cleanTag.toLowerCase();

  const [theme, setTheme] = useState(() => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [copied, setCopied] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [agentMetadata, setAgentMetadata] = useState(null);
  const [controlStatus, setControlStatus] = useState(null);
  const [concordiumCard, setConcordiumCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState('all');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('25');
  const [paySuccess, setPaySuccess] = useState(false);
  const [shareToast, setShareToast] = useState(null);

  const profile = resolveTagProfile(cleanTag);
  const p = profile.palette;
  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;
    async function loadIdentity() {
      setLoading(true);
      if (IS_CONCORDIUM_SITE) {
        try {
          const response = await fetch(CONCORDIUM_SITE.cardPath(cleanTag), { cache: 'no-store', headers: { Accept: 'application/json' } });
          if (response.ok) {
            const card = await response.json();
            if (isMounted && card && typeof card === 'object') {
              setConcordiumCard(card);
              setAgentMetadata(card);
            }
          }
        } catch {
          // ignore
        } finally {
          if (isMounted) setLoading(false);
        }
        return;
      }

      try {
        const [res, status, cardRes] = await Promise.all([
          resolveTag(cleanTag).catch(() => null),
          getAgentControlStatus(cleanTag).catch(() => null),
          fetch(`/api/agent-card?tag=${encodeURIComponent(lowercaseTag)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!isMounted) return;
        if (res?.resolvedAddress) setResolvedAddress(res.resolvedAddress);
        if (res?.profile || cardRes) setAgentMetadata(res?.profile || cardRes);
        if (status) setControlStatus(status);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadIdentity();
    return () => { isMounted = false; };
  }, [cleanTag, lowercaseTag]);

  const showToast = (msg) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 2600);
  };

  const triggerConfetti = (ratio = 0.5) => {
    try {
      confetti({
        particleCount: Math.floor(35 * ratio),
        spread: 55,
        origin: { y: 0.7 },
        colors: [p.primary, '#ffffff', '#10b981'],
      });
    } catch { /* ignore */ }
  };

  const effectiveAddress = controlStatus?.walletAddress || resolvedAddress || controlStatus?.ownerAddress || null;
  const selfVerified = Boolean(controlStatus?.selfVerified);
  const selfAgentId = controlStatus?.selfAgentId || agentMetadata?.registrations?.[0]?.agentId || null;
  const dailyCap = controlStatus?.spendingLimits?.dailyUsdt || '50';
  const avatarSvg = generateAvatarSvg(profile.hashIndex, 76);

  const copyAddress = () => {
    if (!effectiveAddress) return;
    navigator.clipboard.writeText(effectiveAddress);
    setCopied(true);
    triggerConfetti(0.3);
    showToast('Wallet address copied!');
    setTimeout(() => setCopied(false), 2200);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Profile link copied!');
  };

  const bgPage = isDark ? '#0b0c10' : '#f4f5f7';
  const bgCard = isDark ? '#14161d' : '#ffffff';
  const borderSubtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';

  const activityItems = [
    {
      id: 'self-id',
      kind: 'identity',
      title: selfVerified ? `Verified Human Agent (Self #${selfAgentId || 'Active'})` : 'Self Agent ID Verification Pending',
      subtitle: selfVerified
        ? 'Zero-knowledge Proof-of-Human active on Celo Mainnet SelfAgentRegistry.'
        : 'Waiting for owner passport verification in Self App to unlock gated x402 & escrow flows.',
      meta: selfVerified ? 'Celo 42220' : 'Unverified',
      badge: selfVerified ? 'Verified' : 'Pending',
      href: selfAgentId ? `https://agent-api.self.xyz/api/agent/info/42220/${selfAgentId}` : null,
    },
    {
      id: 'altana-wallet',
      kind: 'payments',
      title: `Altana Smart Wallet & x402 Rail`,
      subtitle: effectiveAddress
        ? `Bound to ${effectiveAddress.slice(0, 8)}...${effectiveAddress.slice(-6)} · Daily cap $${dailyCap} USDC`
        : 'Smart agent wallet provisions automatically when this ₦Tag is claimed.',
      meta: controlStatus?.hasActiveSession ? 'Session Active' : 'Standby',
      badge: `$${dailyCap}/d`,
      href: effectiveAddress ? `https://celoscan.io/address/${effectiveAddress}` : null,
    },
    {
      id: 'erc8004-card',
      kind: 'identity',
      title: 'ERC-8004 & A2A Agent Registration Card',
      subtitle: `Machine-readable capability & payment metadata served at /api/agent-card?tag=${lowercaseTag}`,
      meta: 'JSON · A2A',
      badge: 'Live',
      href: `/api/agent-card?tag=${encodeURIComponent(lowercaseTag)}`,
    },
  ].filter((item) => activityFilter === 'all' || item.kind === activityFilter);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: bgPage,
      color: textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '0 0 64px',
    }}>
      {/* Centered Instagram / Whop-style Profile Shell */}
      <div style={{
        maxWidth: '540px',
        margin: '0 auto',
        backgroundColor: bgCard,
        minHeight: '100vh',
        borderLeft: `1px solid ${borderSubtle}`,
        borderRight: `1px solid ${borderSubtle}`,
      }}>
        {/* ── Cover Banner with Floating Controls ── */}
        <div style={{
          position: 'relative',
          height: '148px',
          background: `linear-gradient(135deg, ${p.primary} 0%, ${isDark ? '#1e293b' : '#cbd5e1'} 100%)`,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: isDark
              ? 'linear-gradient(180deg, rgba(11,12,16,0.15) 0%, rgba(20,22,29,0.92) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.94) 100%)',
          }} />

          {/* Top Floating Bar */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
          }}>
            <a
              href="/"
              title="Back to NairaTag"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${borderSubtle}`,
                color: textPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={17} />
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={copyLink}
                title="Share profile link"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${borderSubtle}`,
                  color: textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Share2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                title="Toggle theme"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${borderSubtle}`,
                  color: textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {!IS_CONCORDIUM_SITE && (
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(true)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${borderSubtle}`,
                    color: textPrimary,
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Send size={13} /> Pay {displayTag}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Overlapping Avatar + Identity Section ── */}
        <div style={{ padding: '0 20px 20px', marginTop: '-42px', position: 'relative', zIndex: 3 }}>
          <div style={{ position: 'relative', width: '78px', height: '78px', marginBottom: '12px' }}>
            {controlStatus?.avatarUrl ? (
              <img
                src={controlStatus.avatarUrl}
                alt={displayTag}
                style={{
                  width: '78px',
                  height: '78px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `4px solid ${bgCard}`,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '78px',
                  height: '78px',
                  borderRadius: '50%',
                  backgroundColor: p.primary,
                  border: `4px solid ${bgCard}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                }}
                dangerouslySetInnerHTML={{ __html: avatarSvg }}
              />
            )}
            <span
              title={selfVerified ? 'Self Agent ID Verified' : 'Active NairaTag'}
              style={{
                position: 'absolute',
                right: '2px',
                bottom: '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: selfVerified ? '#10b981' : '#f59e0b',
                border: `3px solid ${bgCard}`,
              }}
            />
          </div>

          {/* Name + Verified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {agentMetadata?.name || displayTag}
            </h1>
            {selfVerified && (
              <span
                title="Verified Human via Self Agent ID"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  color: '#10b981',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <ShieldCheck size={12} /> Self #{selfAgentId || 'Verified'}
              </span>
            )}
          </div>

          {/* Handle */}
          <div style={{ fontSize: '13.5px', color: textMuted, marginTop: '2px', fontWeight: 500 }}>
            @{lowercaseTag} · ₦{lowercaseTag}
          </div>

          {/* Bio */}
          <p style={{ margin: '10px 0 12px', fontSize: '14px', lineHeight: 1.5, color: textPrimary }}>
            {IS_CONCORDIUM_SITE
              ? (concordiumCard?.description || 'NairaTag agent identity with a Concordium Testnet registry link.')
              : (controlStatus?.bio || agentMetadata?.description || 'Sovereign NairaTag & autonomous Celo agent. Instant cNGN & USD₮ settlement with Self Agent ID proof.')}
          </p>

          {/* Metadata Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '12.5px', color: textMuted, marginBottom: '16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={13} /> Celo Mainnet (42220)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} /> ERC-8004 Identity
            </span>
            <a
              href={`/api/agent-card?tag=${encodeURIComponent(lowercaseTag)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}
            >
              <Link2 size={13} /> Agent Card
            </a>
          </div>

          {/* Two Side-by-Side Stat / Action Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={copyAddress}
              disabled={!effectiveAddress}
              style={{
                padding: '10px 12px',
                borderRadius: '999px',
                border: `1px solid ${borderSubtle}`,
                backgroundColor: pillBg,
                color: textPrimary,
                fontSize: '13px',
                fontWeight: 600,
                cursor: effectiveAddress ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Wallet size={14} />}
              <span style={{ fontFamily: effectiveAddress ? 'monospace' : 'inherit' }}>
                {loading ? 'Resolving...' : effectiveAddress ? `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}` : 'Unclaimed Tag'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = `/#chat?agent=${encodeURIComponent(lowercaseTag)}`; }}
              style={{
                padding: '10px 12px',
                borderRadius: '999px',
                border: `1px solid ${borderSubtle}`,
                backgroundColor: pillBg,
                color: textPrimary,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <MessageSquare size={14} />
              <span>Chat with Agent</span>
            </button>
          </div>

          {/* Resolver Contract Link */}
          <div style={{ fontSize: '11.5px', color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Resolver: <code style={{ fontFamily: 'monospace' }}>{CELO_NAIRATAG_RESOLVER_ADDRESS.slice(0, 8)}...{CELO_NAIRATAG_RESOLVER_ADDRESS.slice(-6)}</code></span>
            <a href="/#claim" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Claim your ₦Tag →</a>
          </div>
        </div>

        {/* ── Activity Feed Section ── */}
        <div style={{ borderTop: `1px solid ${borderSubtle}`, padding: '18px 20px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Activity</h2>
            <select
              aria-label="Filter activity"
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                border: `1px solid ${borderSubtle}`,
                backgroundColor: pillBg,
                color: textPrimary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">All</option>
              <option value="identity">Identity</option>
              <option value="payments">Payments</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activityItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  border: `1px solid ${borderSubtle}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', color: textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {item.kind === 'payments' ? <Zap size={12} color="#10b981" /> : <Sparkles size={12} color="#6366f1" />}
                    {displayTag} · {item.meta}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: pillBg,
                    color: textPrimary,
                  }}>
                    {item.badge}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.title}</div>
                <div style={{ fontSize: '12.5px', color: textMuted, lineHeight: 1.45 }}>{item.subtitle}</div>
                {item.href && (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: '2px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6366f1',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Inspect <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pay Modal */}
      {!IS_CONCORDIUM_SITE && isPayModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setIsPayModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: bgCard,
              borderRadius: '24px',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: `1px solid ${borderSubtle}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Pay {displayTag}</h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'inherit' }}
              >×</button>
            </div>
            <p style={{ fontSize: '13px', color: textMuted, margin: 0 }}>
              Send instant cNGN & USD₮ on Celo directly to this sovereign ₦Tag.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['5', '25', '50', '100'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPayAmount(amt)}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '10px',
                    border: payAmount === amt ? `2px solid ${p.primary}` : `1px solid ${borderSubtle}`,
                    backgroundColor: payAmount === amt ? p.primary : 'transparent',
                    color: payAmount === amt ? '#000000' : 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >${amt}</button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setPaySuccess(true);
                triggerConfetti(0.8);
                setTimeout(() => {
                  setPaySuccess(false);
                  setIsPayModalOpen(false);
                  window.location.href = `/#pay?recipient=${encodeURIComponent(cleanTag)}&amount=${payAmount}`;
                }, 900);
              }}
              style={{
                backgroundColor: p.primary,
                color: '#000000',
                border: 'none',
                borderRadius: '14px',
                padding: '13px',
                fontWeight: 800,
                fontSize: '14.5px',
                cursor: 'pointer',
              }}
            >
              {paySuccess ? 'Redirecting to Pay...' : `Pay $${payAmount} USDC to ${displayTag}`}
            </button>
          </div>
        </div>
      )}

      {shareToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10b981',
          color: '#ffffff',
          padding: '9px 18px',
          borderRadius: '999px',
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 999,
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
        }}>
          {shareToast}
        </div>
      )}
    </div>
  );
}
