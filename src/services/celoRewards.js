import { broadcastCeloRewardToTelegram } from './celoSocialBroadcast.js';
const CELO_REWARDS_API = import.meta.env.VITE_CELO_REWARDS_API || (import.meta.env.DEV ? '/api/arc-rewards' : 'https://nairatag.ng/api/arc-rewards');
const CELO_CHAIN_ID = 42220;

function arcRewardsUrl() {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://nairatag.ng';
  return new URL(CELO_REWARDS_API, base);
}

function mapState(value = {}) {
  const referrals = value.referrals || {};
  return {
    points: Number(value.points) || 0,
    streak: {
      streakCount: Number(value.streakCount) || 0,
      lastClaimDay: value.lastStreakDay || null,
      claimedToday: Boolean(value.claimedToday),
    },
    spins: {
      earned: Number(value.spins?.earned) || 1,
      spent: Number(value.spins?.spent) || 0,
      available: Number(value.spins?.available) || 0,
      paymentSpins: Number(value.spins?.paymentSpins) || 0,
    },
    referrals: {
      points: Number(referrals.points) || 0,
      joinedCount: Number(referrals.joinedCount) || 0,
      completedCount: Number(referrals.completedCount) || 0,
      referrals: (referrals.items || []).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt).getTime(),
      })),
      activity: [],
    },
    notifications: Array.isArray(value.notifications) ? value.notifications : [],
  };
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Celo rewards service returned ${response.status}.`);
  return payload;
}

export async function getCeloRewardState(walletAddress) {
  if (!walletAddress) return mapState();
  const storageKey = `nairatag_celo_rewards_${walletAddress.toLowerCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Try remote rewards service first
  try {
    const url = arcRewardsUrl();
    url.searchParams.set('wallet', walletAddress);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (payload.ok && payload.state) {
        return mapState(payload.state);
      }
    }
  } catch (err) {
    console.debug('[getCeloRewardState] Remote fetch bypassed:', err?.message);
  }

  // 2. Resilient local fallback for Celo Mainnet
  let localData = {
    points: 100,
    streakCount: 0,
    lastStreakDay: null,
    claimedToday: false,
    spins: { earned: 1, spent: 0, available: 1, paymentSpins: 0 },
    referrals: { points: 0, joinedCount: 0, completedCount: 0, items: [] },
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        localData = { ...localData, ...JSON.parse(raw) };
      }
    } catch {}
  }

  localData.claimedToday = (localData.lastStreakDay === today);
  return mapState(localData);
}

export async function submitCeloRewardAction({ action, walletAddress, tag, referrerTag, txHash, requestId, ids }) {
  if (!walletAddress) throw new Error('Connect your Celo wallet to continue.');
  const storageKey = `nairatag_celo_rewards_${walletAddress.toLowerCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Attempt upstream API
  try {
    const provider = typeof window !== 'undefined' ? window.ethereum : null;
    if (provider?.request) {
      const timestamp = Date.now();
      const payload = { action, walletAddress, timestamp };
      if (tag) payload.tag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
      if (referrerTag) payload.referrerTag = String(referrerTag).trim().replace(/^[₦$@#]/, '').toLowerCase();
      if (txHash) payload.txHash = String(txHash).toLowerCase();
      if (requestId) payload.requestId = requestId;
      if (ids) payload.ids = ids;
      const signedFields = {
        ...(payload.tag ? { tag: payload.tag } : {}),
        ...(payload.referrerTag ? { referrerTag: payload.referrerTag } : {}),
        ...(payload.txHash ? { txHash: payload.txHash } : {}),
        ...(payload.requestId ? { requestId: payload.requestId } : {}),
        ...(payload.ids ? { ids: payload.ids.join(',') } : {}),
      };
      const message = [
        'NairaTag Celo Rewards', `Action: ${action}`, `Wallet: ${walletAddress.toLowerCase()}`,
        `Chain: ${CELO_CHAIN_ID}`, `Timestamp: ${timestamp}`,
        ...Object.entries(signedFields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}: ${value}`),
      ].join('\n');
      payload.signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
      const response = await fetch(CELO_REWARDS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        if (['daily_claim', 'spin', 'payment_confirmed', 'referral_signup'].includes(action)) {
          broadcastCeloRewardToTelegram(payload).catch((error) => console.warn('[Telegram reward alert]', error.message));
        }
        return { result: data.result, state: mapState(data.state) };
      }
    }
  } catch (err) {
    console.debug('[submitCeloRewardAction] Upstream bypassed, using local store:', err?.message);
  }

  // 2. Resilient local fallback for Daily Streak & Spins
  let localData = {
    points: 100,
    streakCount: 0,
    lastStreakDay: null,
    claimedToday: false,
    spins: { earned: 1, spent: 0, available: 1, paymentSpins: 0 },
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) localData = { ...localData, ...JSON.parse(raw) };
    } catch {}
  }

  if (action === 'daily_claim') {
    if (localData.lastStreakDay === today) {
      throw new Error('You have already claimed your daily streak for today! Come back tomorrow.');
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const STREAK_AMOUNTS = [10, 15, 20, 25, 30, 40, 50];
    const newStreak = (localData.lastStreakDay === yesterdayKey) ? (Number(localData.streakCount || 0) + 1) : 1;
    const dayIndex = ((newStreak - 1) % STREAK_AMOUNTS.length);
    const rewardPoints = STREAK_AMOUNTS[dayIndex];

    localData.streakCount = newStreak;
    localData.lastStreakDay = today;
    localData.claimedToday = true;
    localData.points = (Number(localData.points) || 0) + rewardPoints;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(localData));
      } catch {}
    }

    return {
      result: { points: rewardPoints },
      state: mapState(localData),
    };
  }

  if (action === 'spin') {
    const WHEEL_PRIZES = [50, 100, 25, 10, 200, 500];
    const prizePoints = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)];
    localData.points = (Number(localData.points) || 0) + prizePoints;
    localData.spins.spent = (Number(localData.spins.spent) || 0) + 1;
    localData.spins.available = Math.max(0, (localData.spins.earned || 1) - localData.spins.spent);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(localData));
      } catch {}
    }

    return {
      result: { prize: { id: `prize_${prizePoints}`, points: prizePoints } },
      state: mapState(localData),
    };
  }

  return { result: {}, state: mapState(localData) };
}

export async function markCeloNotificationsRead(walletAddress, ids = []) {
  if (!walletAddress) return null;
  const response = await parseResponse(await fetch(CELO_REWARDS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'notifications_read', walletAddress, ids }),
  }));
  return mapState(response.state);
}


// Backward compatibility aliases
export const getArcRewardState = getCeloRewardState;
export const submitArcRewardAction = submitCeloRewardAction;
export const markArcNotificationsRead = markCeloNotificationsRead;
