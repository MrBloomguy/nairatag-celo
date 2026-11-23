export const IS_CONCORDIUM_SITE = typeof window !== 'undefined'
  && (window.location.hostname.toLowerCase() === 'concordium.nairatag.ng'
    || window.location.search.includes('mode=concordium')
    || window.location.search.includes('concordium=true'));

export const CONCORDIUM_SITE = Object.freeze({
  networkName: 'Concordium Testnet',
  explorerUrl: 'https://testnet.ccdscan.io',
  registryUrl: 'https://testnet.ccdscan.io',
  cardPath: (tag) => `/api/concordium-agent-card/${encodeURIComponent(String(tag || '').replace(/^[₦$@#]/, '').toLowerCase())}`,
});

export const activeSiteNetworkLabel = IS_CONCORDIUM_SITE ? 'NairaTag owner wallet' : 'Celo Mainnet';
