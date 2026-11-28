import React, { useState } from 'react';

export default function ProfileAvatar({ tag = '', email = '', avatarUrl = '', size = 40, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const identity = String(tag || email || '').replace(/^[$₦@#]/, '').trim();
  const seed = identity.toLowerCase() || 'nairatag';
  const initial = identity ? Array.from(identity)[0].toUpperCase() : 'N';
  const resolvedSrc = avatarUrl || `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${encodeURIComponent(seed)}`;

  if (!imgError) {
    return (
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
        }}
      />
    );
  }

  return (
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
}
