import React, { useState } from 'react';
import { SelfIcon } from './SelfAgentIdBadge.jsx';

export default function ProfileAvatar({
  tag = '',
  email = '',
  avatarUrl = '',
  size = 40,
  className = '',
  selfVerified = false,
  selfAgentId = null,
  badgePosition = 'bottom-right',
}) {
  const [imgError, setImgError] = useState(false);
  const identity = String(tag || email || '').replace(/^[$₦@#]/, '').trim();
  const seed = identity.toLowerCase() || 'nairatag';
  const initial = identity ? Array.from(identity)[0].toUpperCase() : 'N';
  const resolvedSrc = avatarUrl || `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${encodeURIComponent(seed)}`;

  const badgeSize = Math.max(13, Math.round(size * 0.36));
  const badgePosStyle = badgePosition === 'top-right'
    ? { top: '-2px', right: '-2px' }
    : { bottom: '-2px', right: '-2px' };

  const avatarEl = !imgError ? (
    <img
      src={resolvedSrc}
      alt={identity ? `Profile avatar for ${identity}` : 'NairaTag profile avatar'}
      onError={() => setImgError(true)}
      className={`naira-profile-avatar ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        display: 'block',
      }}
    />
  ) : (
    <span
      className={`naira-profile-avatar ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      role="img"
      aria-label={identity ? `Profile avatar for ${identity}` : 'NairaTag profile avatar'}
    >
      <span className="naira-profile-avatar-initial">{initial}</span>
      <span className="naira-profile-avatar-mark" aria-hidden="true">₦</span>
    </span>
  );

  if (!selfVerified) return avatarEl;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      {avatarEl}
      <span
        title={`Verified with Self Agent ID${selfAgentId ? ` #${selfAgentId}` : ''}`}
        style={{
          position: 'absolute',
          ...badgePosStyle,
          width: badgeSize,
          height: badgeSize,
          borderRadius: '50%',
          background: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.22)',
          pointerEvents: 'none',
        }}
      >
        <SelfIcon size={Math.max(10, badgeSize - 3)} />
      </span>
    </span>
  );
}
