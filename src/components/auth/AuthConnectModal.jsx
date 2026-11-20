import React from 'react';
import {
  Wallet,
  X,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

export default function AuthConnectModal({
  onClose,
  isConnecting,
  handleConnect,
}) {
  const wallets = [
    {
      name: 'MetaMask',
      type: 'MetaMask',
      badge: 'Recommended',
      badgeColor: '#10b981',
      description: 'Desktop browser extension & mobile app',
      icon: '🦊',
    },
    {
      name: 'Rabby Wallet',
      type: 'Rabby',
      badge: 'Popular',
      badgeColor: '#6366f1',
      description: 'Game-changing Web3 EVM wallet',
      icon: '🐰',
    },
    {
      name: 'Opera MiniPay',
      type: 'MiniPay',
      badge: 'Celo Native',
      badgeColor: '#35D07F',
      description: 'Ultra-fast stablecoin wallet on Celo',
      icon: '⚡',
    },
    {
      name: 'Browser / Injected Wallet',
      type: 'injected',
      badge: null,
      description: 'Coinbase Wallet, Brave, or active provider',
      icon: '🌐',
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog connect-modal-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        style={{
          maxWidth: '440px',
          borderRadius: '20px',
          padding: '24px',
          background: 'var(--card-bg, #ffffff)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Topbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
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
                background: '#35D07F',
                color: '#000',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              C
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Celo Mainnet (42220)
            </span>
          </div>

          <button
            type="button"
            className="auth-close-button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #666)',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <h2
            id="auth-modal-title"
            style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: '0 0 6px 0',
              color: 'var(--text-primary, #111)',
            }}
          >
            Connect Celo Wallet
          </h2>
          <p
            style={{
              fontSize: '13px',
              margin: 0,
              color: 'var(--text-secondary, #666)',
              lineHeight: 1.4,
            }}
          >
            Connect your Web3 wallet to manage your sovereign ₦Tag, settle autonomous bounties, and trade cNGN.
          </p>
        </div>

        {/* Wallet Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              type="button"
              disabled={isConnecting}
              onClick={() => handleConnect(wallet.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1px solid var(--border-color, #e5e7eb)',
                background: 'var(--input-bg, #f9fafb)',
                cursor: isConnecting ? 'wait' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>{wallet.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary, #111)' }}>
                      {wallet.name}
                    </span>
                    {wallet.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: `${wallet.badgeColor}20`,
                          color: wallet.badgeColor,
                        }}
                      >
                        {wallet.badge}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #666)' }}>
                    {wallet.description}
                  </span>
                </div>
              </div>

              {isConnecting ? (
                <RefreshCw size={16} className="spin" color="#059669" />
              ) : (
                <ChevronRight size={18} color="var(--text-secondary, #999)" />
              )}
            </button>
          ))}
        </div>

        {/* Footnote */}
        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-secondary, #888)',
          }}
        >
          <ShieldCheck size={14} color="#059669" />
          <span>Non-custodial. Your keys remain strictly on your device.</span>
        </div>
      </div>
    </div>
  );
}
