import { normalizeTag } from './nairatagResolver.js';
import { submitArcRewardAction } from './celoRewards.js';

let pendingReferral = null;
export const REFERRAL_SIGNUP_POINTS = 100;
export const REFERRAL_FIRST_PAYMENT_POINTS = 250;

function cleanTag(tag) {
  const normalized = normalizeTag(String(tag || ''));
  return normalized.valid ? normalized.cleanTag.toLowerCase() : '';
}

export function rememberReferralFromUrl(search = window.location.search) {
  try {
    const tag = cleanTag(new URLSearchParams(search).get('ref'));
    if (!tag) return null;
    const attribution = { tag, capturedAt: Date.now() };
    pendingReferral = attribution;
    return attribution;
  } catch { return null; }
}

export function getPendingReferral() {
  return pendingReferral && cleanTag(pendingReferral.tag) ? { ...pendingReferral, tag: cleanTag(pendingReferral.tag) } : null;
}

export function clearPendingReferral() { pendingReferral = null; }

export function createReferralLink(tag) {
  const clean = cleanTag(tag);
  if (!clean || typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.pathname = `/tag/${encodeURIComponent(clean.toUpperCase())}`;
  url.search = '';
  url.searchParams.set('ref', `₦${clean}`);
  url.hash = 'claim';
  return url.toString();
}

export function recordReferralSignup({ referredTag, referredWallet }) {
  const attribution = getPendingReferral();
  const friendTag = cleanTag(referredTag);
  if (!attribution || !friendTag || !referredWallet || attribution.tag === friendTag) return Promise.resolve(null);
  return submitArcRewardAction({
    action: 'referral_signup',
    walletAddress: referredWallet,
    tag: friendTag,
    referrerTag: attribution.tag,
  }).then(({ result, state }) => {
    clearPendingReferral();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nairatag:referrals-updated', { detail: { referrerTag: attribution.tag, referredTag: friendTag, milestone: 'signup', points: REFERRAL_SIGNUP_POINTS } }));
    return { ...result, viewerPoints: REFERRAL_SIGNUP_POINTS, state };
  });
}
