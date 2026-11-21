const AUTH_API = import.meta.env.VITE_CELO_AUTH_API || 'https://nairatag.ng/api/arc-auth';
let activeSession = null;

async function postAuth(body) {
  const response = await fetch(AUTH_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Account sign-in returned ${response.status}.`);
  }
  return result;
}

function saveSession(result, walletAddress) {
  const session = {
    token: result.token,
    walletAddress: String(walletAddress).toLowerCase(),
    expiresAt: Number(result.expiresAt),
  };
  activeSession = session;
  return session;
}

export async function establishCircleCeloSession({ userToken, walletAddress }) {
  if (!userToken || !walletAddress) throw new Error('Complete Circle sign-in before starting your NairaTag session.');
  const result = await postAuth({ action: 'circle', userToken, walletAddress });
  if (!result.token) throw new Error('The account session service returned no session token.');
  return saveSession(result, walletAddress);
}

export async function establishWalletCeloSession(walletAddress) {
  if (!walletAddress) throw new Error('Connect a wallet before signing in.');
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  if (!provider?.request) throw new Error('Your wallet provider is unavailable.');
  const challenge = await postAuth({ action: 'wallet_challenge', walletAddress });
  const signature = await provider.request({ method: 'personal_sign', params: [challenge.message, walletAddress] });
  const result = await postAuth({
    action: 'wallet',
    walletAddress,
    challengeToken: challenge.challengeToken,
    signature,
  });
  if (!result.token) throw new Error('The account session service returned no session token.');
  return saveSession(result, walletAddress);
}

export function getCeloSessionToken(walletAddress) {
  if (!activeSession?.token || activeSession.expiresAt <= Date.now()
    || String(activeSession.walletAddress).toLowerCase() !== String(walletAddress || '').toLowerCase()) return null;
  return activeSession.token;
}

export function clearCeloSession() { activeSession = null; }

// Backward compatibility aliases
export const clearArcSession = clearCeloSession;
export const establishCircleArcSession = establishCircleCeloSession;
export const establishWalletArcSession = establishWalletCeloSession;
export const getArcSessionToken = getCeloSessionToken;

