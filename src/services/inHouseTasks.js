const voucherClaimsByWallet = new Map();
const CLAIM_API = import.meta.env.VITE_ARC_ADMIN_API || 'https://nairatag.ng/api/arc-admin';

// Bundled voucher tasks are retired; this module only reads persisted claim history.
export const IN_HOUSE_TASKS = [];

export function getInHouseVouchers(walletAddress) {
  return voucherClaimsByWallet.get(String(walletAddress || '').toLowerCase()) || [];
}

export async function syncInHouseVouchers(walletAddress) {
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  if (!walletAddress || !provider?.request) return getInHouseVouchers(walletAddress);
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!Array.isArray(accounts) || !accounts.some((account) => account.toLowerCase() === walletAddress.toLowerCase())) return getInHouseVouchers(walletAddress);
  const timestamp = Date.now();
  const message = ['NairaTag Celo Vouchers', 'Action: list_claims', `Wallet: ${walletAddress.toLowerCase()}`, 'Chain: 42220', `Timestamp: ${timestamp}`].join('\n');
  const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
  const url = new URL(CLAIM_API);
  Object.entries({ action: 'claims', walletAddress, timestamp, signature }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Voucher claims could not be loaded.');
  const claims = (payload.claims || []).map((claim) => ({ taskId: claim.voucher_id, name: claim.arc_vouchers?.title || claim.voucher_id, value: `${Number(claim.arc_vouchers?.points) || 0} Protocol Points after approval`, earnedAt: claim.created_at, status: claim.status, claimId: claim.id, proof: claim.proof }));
  voucherClaimsByWallet.set(walletAddress.toLowerCase(), claims);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nairatag-inhouse-vouchers-updated', { detail: { walletAddress: walletAddress.toLowerCase(), vouchers: claims } }));
  return claims;
}

export async function claimInHouseVoucher() { throw new Error('Bundled voucher tasks have been retired.'); }
