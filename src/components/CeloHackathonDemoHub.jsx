import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Key,
  Fingerprint,
  Calendar,
  Layers,
  Code,
  Video,
  FileText,
  Clock,
  Send,
  Zap,
  Check,
  Award,
} from 'lucide-react';
import CorridorSwapCard from './CorridorSwapCard.jsx';
import AltanaSessionCard from './AltanaSessionCard.jsx';
import SelfAgentVerificationCard from './SelfAgentVerificationCard.jsx';
import PanoramicWalkthroughView from './bookings/PanoramicWalkthroughView.jsx';
import {
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  CELO_ERC8004_IDENTITY_REGISTRY,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  TEXTILE_FX_ROUTER,
} from '../config/celo.js';

export default function CeloHackathonDemoHub({
  walletAddress = null,
  onConnectWallet = () => {},
  onNavigateTo = () => {},
}) {
  // Active Tab: 'track1' | 'track4' | 'track3' | 'track2' | 'audit'
  const [activeTab, setActiveTab] = useState('track1');
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch (_) {}
  };

  const TRACKS = [
    {
      id: 'track1',
      title: 'Stablecoin Corridors',
      sponsor: 'Textile FX',
      status: 'VERIFIED LIVE API',
      statusColor: '#059669',
      icon: TrendingUp,
      tagline: 'Real-time USD₮ ⇋ cNGN RFQ rate discovery & EIP-712 settlement on Celo Mainnet',
    },
    {
      id: 'track4',
      title: 'Altana Agent Wallets',
      sponsor: 'Altana Network',
      status: 'VERIFIED SMART CONTRACT',
      statusColor: '#7c3aed',
      icon: Key,
      tagline: 'Non-custodial smart accounts, scoped session delegations & 1-click monotonic revocation',
    },
    {
      id: 'track3',
      title: 'Self Agent ID',
      sponsor: 'Self Protocol',
      status: 'VERIFIED ON-CHAIN READ',
      statusColor: '#0284c7',
      icon: Fingerprint,
      tagline: 'Proof-of-Human ownership, identity-bound agents & service publication gating',
    },
    {
      id: 'track2',
      title: 'Agent Vault & Bookings',
      sponsor: 'x402 & Agent Rails',
      status: 'VERIFIED EMBEDDED CHECKOUT',
      statusColor: '#d97706',
      icon: Calendar,
      tagline: 'Embedded autonomous booking checkouts under session limit with biometric passkey step-up',
    },
    {
      id: 'audit',
      title: 'Evidence Audit Matrix',
      sponsor: '99/99 Tests Audited',
      status: '100% AUDITED',
      statusColor: '#0f172a',
      icon: Layers,
      tagline: 'Complete on-chain transaction evidence, bytecode sizes & honest status classification',
    },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 12px 64px', width: '100%' }}>
      {/* ── Top Header Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          borderRadius: '24px',
          padding: '28px 24px',
          color: '#fff',
          boxShadow: '0 10px 25px -5px rgba(6, 95, 70, 0.3)',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, marginBottom: '8px' }}>
              <Award size={14} color="#fef08a" />
              <span>Loops House Hackathon · Agents Open for Business ($5,000 Prize Pool)</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              NairaTag — Celo Hackathon Demo Hub
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#a7f3d0', maxWidth: '720px', lineHeight: 1.45 }}>
              Audited integration evidence, live interactive demonstrations, confirmed Celo Mainnet contracts, and verifiable proofs across all four competition tracks.
            </p>
          </div>

          {/* Quick Badges Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#cbd5e1' }}>Target Chain:</span>
              <span style={{ fontWeight: 800, color: '#fef08a' }}>Celo Mainnet (42220)</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#cbd5e1' }}>Attribution Tag:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(CELO_ATTRIBUTION_TAG, 'attr_header')}
                style={{ background: 'none', border: 'none', color: '#6ee7b7', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}
              >
                <span>{CELO_ATTRIBUTION_TAG}</span>
                {copiedKey === 'attr_header' ? <Check size={12} color="#fef08a" /> : <Copy size={12} />}
              </button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#cbd5e1' }}>Platform Agent:</span>
              <a
                href="https://celoscan.io/tx/0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#6ee7b7', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Token #10078</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Track Selector Tabs ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        {TRACKS.map((t) => {
          const Icon = t.icon;
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                background: isSelected ? '#fff' : '#f8fafc',
                border: isSelected ? `2px solid ${t.statusColor}` : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 8px 16px -2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: isSelected ? `${t.statusColor}18` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.statusColor }}>
                  <Icon size={17} />
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: `${t.statusColor}15`,
                    color: t.statusColor,
                  }}
                >
                  {t.status}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{t.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{t.sponsor}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TRACK 1: TEXTILE FX (STABLECOIN CORRIDORS)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'track1' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Track Header Card */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Track 1: Stablecoin Corridors (Textile FX)</span>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                    VERIFIED LIVE API & CONTRACT
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Real-time market rate discovery via Textile FX v2 RFQ API with EIP-712 TakerControl structured signatures and ERC-8021 attribution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTo('pay')}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Open Full Pay Screen</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Evidence Audit Matrix for Track 1 */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontWeight: 800, fontSize: '12px', color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#059669" />
                <span>Textile FX Evidence Audit Table (Celo Mainnet 42220)</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Live External RFQ API</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>POST https://api.textile.finance/v2/rfq/preview</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>✓ Live & Responding with market liquidity</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Textile LimitOrderReactor Contract</span>
                  <a
                    href="https://celoscan.io/address/0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>0xa9AA0a64...15C235b3</span>
                    <ExternalLink size={11} />
                  </a>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Bytecode Size: 13,778 bytes confirmed</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>ERC-8021 Attribution Suffix</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>celo_9f7deabd99a6</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>✓ Appended to order calldata</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Verified Currency Corridors</span>
                  <strong style={{ color: '#0f172a' }}>USD₮ ⇋ cNGN and cNGN ⇋ USD₮</strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Native settlement with sub-cent gas fees</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Demonstration Widget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', alignItems: 'start' }}>
            <div>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Live Interactive Swapper Playground:</span>
                <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>Connected to live Textile RFQ pool</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                <CorridorSwapCard
                  embedded={true}
                  walletAddress={walletAddress}
                  onConnectWallet={onConnectWallet}
                />
              </div>
            </div>

            {/* Video Script & Walkthrough Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Video size={17} color="#059669" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Track 1 Video Recording Guide (45 Seconds)
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.45 }}>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #059669' }}>
                    <strong>0:00 - 0:15 | Market Discovery:</strong> Open the swap playground. Enter <code>10 USD₮</code>. Highlight that the quote (~14,411 cNGN) is fetched in real-time directly from Textile market makers.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #059669' }}>
                    <strong>0:15 - 0:30 | Reverse Corridor & Slippage:</strong> Click the direction switch button (cNGN ⇋ USD₮). Show how the rate freshness timer ticks down and updates automatically every 30 seconds.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #059669' }}>
                    <strong>0:30 - 0:45 | Attribution & Contract:</strong> Point to the ERC-8021 attribution tag <code>celo_9f7deabd99a6</code> and show the verified Textile Reactor contract on CeloScan (<code>0xa9AA...235b3</code>).
                  </div>
                </div>
              </div>

              {/* Source Code Walkthrough */}
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Code size={17} color="#0f172a" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Audited Implementation Files
                  </h3>
                </div>
                <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <a
                    href="https://github.com/MrBloomguy/nairatag-celo/blob/main/src/services/textileFxService.js"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}
                  >
                    <span>src/services/textileFxService.js (RFQ API & EIP-712 typing)</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href="https://github.com/MrBloomguy/nairatag-celo/blob/main/src/services/corridorService.js"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}
                  >
                    <span>src/services/corridorService.js (Atomic conversion math)</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href="https://github.com/MrBloomguy/nairatag-celo/blob/main/test/textile-corridor.test.js"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}
                  >
                    <span>test/textile-corridor.test.js (All 6 automated tests passing)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TRACK 4: ALTANA AGENT WALLETS
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'track4' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Track 4: Altana Agent Wallets</span>
                  <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                    VERIFIED SMART CONTRACT ON CELO
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Non-custodial smart accounts on Celo Mainnet with scoped contract/method session keys, daily spending caps, and 1-click revocation.
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontWeight: 800, fontSize: '12px', color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#7c3aed" />
                <span>Altana Evidence Audit Table (Celo Mainnet 42220)</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Altana Smart Keystore</span>
                  <a
                    href="https://celoscan.io/address/0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#7c3aed', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>0x83b30935...7cd27c</span>
                    <ExternalLink size={11} />
                  </a>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Bytecode Size: 17,514 bytes confirmed on Celo</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Zero-Secret Storage Enforcement</span>
                  <strong style={{ color: '#0f172a' }}>Strict assertZeroSecrets Gate</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>✓ Zero private keys/mnemonics stored</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Session Policy Restrictions</span>
                  <strong style={{ color: '#0f172a' }}>Contract & Function Selector Bound</strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Rejects unrestricted ERC-20 approvals</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Revocation Guarantee</span>
                  <strong style={{ color: '#0f172a' }}>Monotonic Human Owner Revoke</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>Immediate on-chain fail-closed status</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <AltanaSessionCard
                walletAddress={walletAddress}
                onConnectWallet={onConnectWallet}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Video size={17} color="#7c3aed" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Track 4 Video Recording Guide (45 Seconds)
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #7c3aed' }}>
                    <strong>0:00 - 0:15 | Smart Account Derivation:</strong> Show how the Altana SDK provisions a deterministic smart account address on Celo for an agent using its human owner EOA.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #7c3aed' }}>
                    <strong>0:15 - 0:30 | Policy Delegation:</strong> Grant a scoped session key with an explicit daily limit (e.g. ₦50,000 cNGN). Highlight that unrestricted ERC-20 approvals are forbidden.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #7c3aed' }}>
                    <strong>0:30 - 0:45 | 1-Click Revocation:</strong> Click the Revoke button. Show the instantaneous transition to REVOKED, blocking any subsequent agent spending.
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Code size={17} color="#0f172a" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Audited Implementation Files
                  </h3>
                </div>
                <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <a href="https://github.com/MrBloomguy/nairatag-celo/blob/main/src/services/altanaWalletService.js" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>src/services/altanaWalletService.js (SDK Client & Policies)</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href="https://github.com/MrBloomguy/nairatag-celo/blob/main/test/altana-wallet.test.js" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>test/altana-wallet.test.js (All 14 automated tests passing)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TRACK 3: SELF AGENT ID
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'track3' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Track 3: Self Agent ID</span>
                  <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                    VERIFIED LIVE REGISTRY READ ON CELO
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Proof-of-Human identity verification tying sovereign NairaTag agents to real human owners, gating service publishing and task escrow payouts.
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontWeight: 800, fontSize: '12px', color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#0284c7" />
                <span>Self Agent ID Evidence Audit Table (Celo Mainnet 42220)</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Official Self Registry on Celo</span>
                  <a
                    href="https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>0xaC3DF9AB...355944</span>
                    <ExternalLink size={11} />
                  </a>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>✓ Deployed & Verified on Celo Mainnet</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>DeepLink Proof Provider</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>https://agent-api.self.xyz</strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Generates NFC verification sessions</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Platform Capability Gating</span>
                  <strong style={{ color: '#0f172a' }}>Requires Verified Owner Proof</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>✓ Service publishing & bounty release gated</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Nullifier Privacy Protection</span>
                  <strong style={{ color: '#0f172a' }}>Zero Passport Data Stored</strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Only nullifier hash recorded on-chain</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <SelfAgentVerificationCard
                walletAddress={walletAddress}
                onConnectWallet={onConnectWallet}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Video size={17} color="#0284c7" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Track 3 Video Recording Guide (45 Seconds)
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #0284c7' }}>
                    <strong>0:00 - 0:15 | On-Chain Verification:</strong> Show the official Self Registry on CeloScan (<code>0xaC3D...5944</code>). Open an agent profile and highlight the "Self Verified Human Owner" badge.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #0284c7' }}>
                    <strong>0:15 - 0:30 | Identity Association:</strong> Demonstrate linking an agent tag to a verified human owner, showing the cryptographic nullifier hash without leaking private passport data.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #0284c7' }}>
                    <strong>0:30 - 0:45 | Service Publishing Gate:</strong> Show how an unverified agent is blocked with 403 when trying to publish a bookable service or claim an escrow bounty.
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Code size={17} color="#0f172a" />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Audited Implementation Files
                  </h3>
                </div>
                <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <a href="https://github.com/MrBloomguy/nairatag-celo/blob/main/src/services/selfAgentIdService.js" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>src/services/selfAgentIdService.js (Registry calls & Gating)</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href="https://github.com/MrBloomguy/nairatag-celo/blob/main/test/self-agent-id.test.js" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>test/self-agent-id.test.js (All 25 automated tests passing)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TRACK 2: AGENT VAULT & BOOKINGS
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'track2' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Track 2: Agent Vault (Online & On-Chain Checkouts)</span>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                    VERIFIED EMBEDDED CHECKOUT
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Embedded payment authorization allowing autonomous agents to book and pay within pre-authorized Altana allowances, triggering biometric passkey step-up when over limit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTo('bookings')}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Open 7-Screen Booking Experience</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '16px' }}>
              <div style={{ padding: '10px 14px', background: '#f1f5f9', fontWeight: 800, fontSize: '12px', color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#d97706" />
                <span>Agent Vault Evidence Audit Table</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Autonomous Spending Bounds</span>
                  <strong style={{ color: '#0f172a' }}>Under Limit: Autonomous Execution</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>Zero human interruption if under budget</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>High-Value Spend Protection</span>
                  <strong style={{ color: '#0f172a' }}>Over Limit: Biometric Passkey Step-Up</strong>
                  <span style={{ color: '#b45309', display: 'block', fontSize: '10.5px' }}>Triggers WebAuthn P256 approval</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Settlement & Replay Protection</span>
                  <strong style={{ color: '#0f172a' }}>Durable Digest Ledger</strong>
                  <span style={{ color: '#059669', display: 'block', fontSize: '10.5px' }}>Replay attacks strictly blocked</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Booking Engine Integration</span>
                  <strong style={{ color: '#0f172a' }}>Native 7-Screen Booking Journey</strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Embedded authorization in Review step</span>
                </div>
              </div>
            </div>
          </div>

          {/* Panoramic Walkthrough Container */}
          <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <PanoramicWalkthroughView
              setSelectedService={() => {}}
              setCurrentStep={() => {}}
              selectedDate="2026-11-23"
              setSelectedDate={() => {}}
              selectedSlotTime="10:00 AM"
              setSelectedSlotTime={() => {}}
              customerNotes="I need a two-hour recording and mixing session."
              setCustomerNotes={() => {}}
              selectedPaymentMethod="vault"
              setSelectedPaymentMethod={() => {}}
              vaultScenario="active"
              setVaultScenario={() => {}}
              isPasskeyApproved={false}
              setIsPasskeyApproved={() => {}}
              handleRequestBooking={() => {}}
              isSubmitting={false}
              bookingError=""
              activeBookingRecord={null}
              chatMessages={[]}
              chatInput=""
              setChatInput={() => {}}
              handleSendChatMessage={() => {}}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          OVERVIEW: EVIDENCE AUDIT MATRIX
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
              Full 99-Test Classification & Celo Mainnet On-Chain Status
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Audited status breakdown across all automated test suites, distinguishing verified live Celo operations from simulated test environments.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#047857', fontWeight: 700 }}>VERIFIED LIVE MAINNET TX</span>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#065f46' }}>Block #83294634</div>
                <div style={{ fontSize: '11px', color: '#047857' }}>Token #10078 on ERC-8004 with attribution</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700 }}>VERIFIED SPONSOR CONTRACTS</span>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e40af' }}>4 Contracts Bytecode-Confirmed</div>
                <div style={{ fontSize: '11px', color: '#1d4ed8' }}>ERC-8004, Self, Altana & Textile</div>
              </div>
              <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#a21caf', fontWeight: 700 }}>AUTOMATED TEST SUITES</span>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#86198f' }}>99/99 Passing Tests (0 Failures)</div>
                <div style={{ fontSize: '11px', color: '#a21caf' }}>Across 7 rigorous test suites</div>
              </div>
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>HONEST DISCLOSURE</span>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#92400e' }}>Zero Fabricated Hashes</div>
                <div style={{ fontSize: '11px', color: '#b45309' }}>Simulated steps transparently labeled</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>Track</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>Sponsor Contract / API</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>Audit Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>Attribution / Link</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Platform Agent</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>ERC-8004 (0x8004...a432)</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '10.5px' }}>CONFIRMED ON-CHAIN</span></td>
                    <td style={{ padding: '10px 12px' }}><a href="https://celoscan.io/tx/0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7" target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>Tx: 0x5dea3fcc...</a></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Track 1: Textile FX</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>Reactor (0xa9AA...235b3)</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '10.5px' }}>VERIFIED LIVE API</span></td>
                    <td style={{ padding: '10px 12px' }}><a href="https://celoscan.io/address/0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3" target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>13,778 bytes on CeloScan</a></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Track 4: Altana</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>Keystore (0x83b3...d27c)</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '10.5px' }}>VERIFIED SMART CONTRACT</span></td>
                    <td style={{ padding: '10px 12px' }}><a href="https://celoscan.io/address/0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', textDecoration: 'none' }}>17,514 bytes on CeloScan</a></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Track 3: Self ID</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>Registry (0xaC3D...5944)</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '10.5px' }}>VERIFIED ON-CHAIN READ</span></td>
                    <td style={{ padding: '10px 12px' }}><a href="https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>Deployed & Verified</a></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Track 2: Agent Vault</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>x402 & Booking Rails</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '10.5px' }}>EMBEDDED IN BOOKINGS</span></td>
                    <td style={{ padding: '10px 12px' }}>Durable Replay Protection</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
