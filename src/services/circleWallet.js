/**
 * Stubbed Circle Wallet service for Celo Mainnet.
 * Celo natively utilizes non-custodial EVM wallets (MetaMask, Rabby, Opera MiniPay).
 */

export async function requestCircleEmailOtp() {
  throw new Error('Circle OTP authentication is disabled on Celo Mainnet.');
}

export async function verifyCircleEmailOtp() {
  throw new Error('Circle OTP verification is disabled on Celo Mainnet.');
}

export async function connectCircleWallet() {
  throw new Error('Circle Wallet is disabled on Celo Mainnet.');
}

export async function sendUsdcWithCircle() {
  throw new Error('Circle transfer is disabled on Celo Mainnet.');
}

export async function claimTagWithCircle() {
  throw new Error('Circle claim is disabled on Celo Mainnet.');
}

export function getStoredCircleSession() {
  return null;
}

export function clearCircleSession() {}
