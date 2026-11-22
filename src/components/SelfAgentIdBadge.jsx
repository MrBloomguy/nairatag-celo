import React from 'react';

/**
 * Official Self Protocol Icon
 * Exact vector geometry from docs.self.xyz
 * Features the signature geometric S bracket and vibrant mint green (#00FFB6) center dot.
 */
export function SelfIcon({ size = 13, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Signature mint green center dot */}
      <path
        fill="#00FFB6"
        d="M36.01 27.63H36A8.37 8.37 0 0 0 27.63 36v.01A8.37 8.37 0 0 0 36 44.38h.01a8.37 8.37 0 0 0 8.37-8.37V36a8.37 8.37 0 0 0-8.37-8.37Z"
      />
      {/* Geometric S brackets */}
      <path
        fill={color}
        d="M19.58 28.25a9 9 0 0 1 9-9h17.38L65.21 0H17.22L0 17.22v28.33h19.58V28.24v.01Zm32.84-1.87v16.71a9 9 0 0 1-9 9H26.71L6.79 72.01h47.99L72 54.79v-28.4H52.42v-.01Z"
      />
    </svg>
  );
}

/**
 * Canonical Self Agent ID Verification Badge
 * Official trust indicator replacing generic "Self Verified" text.
 * Represents proof-of-human ZK backing on Celo Mainnet via Self Agent ID.
 */
export default function SelfAgentIdBadge({
  isVerified = true,
  onClick,
  size = 'sm', // 'xs' | 'sm' | 'md' | 'lg'
  className = '',
  style = {},
}) {
  const verified = isVerified !== false;

  const sizeMap = {
    xs: { padding: '2px 6px', fontSize: '10px', gap: '3.5px', iconSize: 11 },
    sm: { padding: '3px 8px', fontSize: '11px', gap: '4.5px', iconSize: 12.5 },
    md: { padding: '4px 10px', fontSize: '12px', gap: '5px', iconSize: 14 },
    lg: { padding: '5px 12px', fontSize: '13px', gap: '6px', iconSize: 16 },
  };

  const currentSize = sizeMap[size] || sizeMap.sm;

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={
        verified
          ? 'Self Agent ID · Verified Human Backing via Zero-Knowledge Passport (Celo Mainnet ERC-8004)'
          : 'Unverified · Needs Self Human Proof'
      }
      className={`self-agent-id-badge ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-[0.98]' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: currentSize.gap,
        padding: currentSize.padding,
        borderRadius: '12px',
        fontSize: currentSize.fontSize,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        background: verified
          ? 'linear-gradient(135deg, rgba(0, 255, 182, 0.14) 0%, rgba(5, 150, 105, 0.16) 100%)'
          : 'rgba(148, 163, 184, 0.12)',
        color: verified ? '#047857' : '#64748b',
        border: `1px solid ${verified ? 'rgba(0, 255, 182, 0.45)' : 'rgba(148, 163, 184, 0.25)'}`,
        boxShadow: verified ? '0 1px 4px rgba(0, 255, 182, 0.12)' : 'none',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        ...style,
      }}
    >
      <SelfIcon
        size={currentSize.iconSize}
        color={verified ? '#0f172a' : '#94a3b8'}
      />
      <span>{verified ? 'Self Agent ID' : 'Unverified'}</span>
    </span>
  );
}
