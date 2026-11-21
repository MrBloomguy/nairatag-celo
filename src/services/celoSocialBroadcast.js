export const TELEGRAM_CHANNEL_HANDLE = '@nairatagupdates';
export const TELEGRAM_CHANNEL_URL = 'https://t.me/nairatagupdates';
export const TELEGRAM_BOT_HANDLE = '@MyNairatagbot';
export const TELEGRAM_BOT_URL = 'https://t.me/MyNairatagbot';
export const TWITTER_HANDLE = '@NairaTaghq';
export const TWITTER_URL = 'https://x.com/NairaTaghq';

async function postTelegramAlert(payload) {
  const response = await fetch('/api/social-alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `Telegram alert failed (${response.status}).`);
  return { sent: true, messageId: result.messageId };
}

export function broadcastCeloClaimToTelegram(claim) {
  return postTelegramAlert({ kind: 'claim', ...claim });
}

export function broadcastCeloTaskToTelegram({ action, taskId, taskTitle, rewardUSDC, points, walletAddress, timestamp, signature }) {
  return postTelegramAlert({ kind: 'task', action, taskId, taskTitle, rewardUSDC, points, walletAddress, timestamp, signature });
}

export function broadcastCeloPaidTaskToTelegram({ taskId, walletAddress }) {
  return postTelegramAlert({ kind: 'task_paid', taskId, walletAddress });
}

export function broadcastCeloRewardToTelegram(proof) {
  return postTelegramAlert({ kind: 'reward', ...proof });
}

export async function broadcastCeloVoucherClaimToTelegram({ taskId, walletAddress }) {
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  if (!provider?.request) throw new Error('A compatible wallet is required to sign this voucher alert.');
  const timestamp = Date.now();
  const message = [
    'NairaTag Social Alerts',
    'Action: voucher_claimed',
    `Task: ${taskId}`,
    `Wallet: ${walletAddress.toLowerCase()}`,
    'Chain: 42220',
    `Timestamp: ${timestamp}`,
  ].join('\n');
  const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
  return postTelegramAlert({ kind: 'voucher', taskId, walletAddress, timestamp, signature });
}

export function getTagShareUrl(tag) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,32}$/.test(clean)) return 'https://celo.nairatag.ng/';
  const encodedRef = encodeURIComponent(`₦${clean}`);
  return `https://celo.nairatag.ng/tag/${encodeURIComponent(clean)}?ref=${encodedRef}#claim`;
}

export function getAgentShareUrl(tag) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,32}$/.test(clean)) return 'https://celo.nairatag.ng/#agents';
  return `https://celo.nairatag.ng/agent/${encodeURIComponent(clean)}#agents`;
}

export function getAgentWhatsAppShareUrl({ tag }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').trim().toUpperCase();
  const url = getAgentShareUrl(clean);
  return `https://wa.me/?text=${encodeURIComponent(`Meet the Celo agent ₦${clean} on NairaTag: ${url}`)}`;
}

export function getAgentTwitterShareUrl({ tag }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').trim().toUpperCase();
  const text = `Meet ₦${clean}, an Celo agent on @NairaTaghq. #Celo #NairaTag`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getAgentShareUrl(clean))}`;
}

export function getAgentTelegramShareUrl({ tag }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').trim().toUpperCase();
  return getTelegramShareIntentUrl({
    text: `Meet ₦${clean}, an Celo agent on NairaTag.`,
    url: getAgentShareUrl(clean),
  });
}

export function getTwitterShareUrl({ tag, txHash }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').toUpperCase();
  const text = `Just claimed my sovereign ₦${clean} handle on @NairaTaghq on Celo Mainnet! Instant USDC payments with sub-second finality.\n\nClaim yours. ${txHash ? `Transaction: ${txHash} ` : ''}#Celo #NairaTag #Crypto`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getTagShareUrl(clean))}`;
}

export function getTelegramShareUrl({ tag }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').toUpperCase();
  const url = getTagShareUrl(clean);
  const text = `Send USDC directly to my sovereign ₦${clean} tag on Celo Mainnet.`;
  return getTelegramShareIntentUrl({ text, url });
}

export function getWhatsAppShareUrl({ tag }) {
  const clean = String(tag || '').replace(/^[$₦@#]/, '').toUpperCase();
  const url = getTagShareUrl(clean);
  const text = `Send USDC directly to my NairaTag ₦${clean} on Celo: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function getTelegramShareIntentUrl({ text, url = 'https://celo.nairatag.ng' }) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function getTwitterTaskShareUrl({ title, rewardUSDC, points, userTag }) {
  const taskTitle = String(title || 'an Celo task').slice(0, 130);
  const reward = rewardUSDC ? `$${rewardUSDC} USDC bounty` : '';
  const pointText = points ? `${points} Protocol Points` : '';
  const potential = [reward, pointText].filter(Boolean).join(' and ');
  const text = `I submitted "${taskTitle}" for review on @NairaTaghq.${potential ? ` Potential reward: ${potential}; pending owner review.` : ''} Explore Celo tasks. #Celo #NairaTag`;
  const url = userTag ? getTagShareUrl(userTag) : 'https://celo.nairatag.ng/#tasks';
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function getTwitterRewardShareUrl({ points, userTag }) {
  const identity = String(userTag || '').replace(/^[$₦@#]/, '').trim();
  const label = identity ? ` as ₦${identity}` : '';
  const amount = Number(points) > 0 ? ` I now have ${Number(points).toLocaleString()} Protocol Points` : ' I just earned an Celo reward';
  const text = `${amount}${label} on @NairaTaghq. Explore Celo tasks and rewards. #Celo #NairaTag`;
  const url = identity ? getTagShareUrl(identity) : 'https://celo.nairatag.ng/#rewards';
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}


// Backward compatibility aliases
export const broadcastArcClaimToTelegram = broadcastCeloClaimToTelegram;
export const broadcastArcTaskToTelegram = broadcastCeloTaskToTelegram;
export const broadcastArcPaidTaskToTelegram = broadcastCeloPaidTaskToTelegram;
export const broadcastArcRewardToTelegram = broadcastCeloRewardToTelegram;
export const broadcastArcVoucherClaimToTelegram = broadcastCeloVoucherClaimToTelegram;
