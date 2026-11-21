import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ingestMerchantInvoice,
  evaluateVaultCheckoutPolicy,
  authorizeVaultCheckout,
  settleVaultCheckout,
  getVaultInvoice,
  getOrCreateVaultPaymentRequirement,
  _resetVaultInvoicesForTesting,
  VAULT_CHECKOUT_STATUS,
  AUTONOMOUS_SPEND_THRESHOLD_USDT,
  AUTONOMOUS_SPEND_THRESHOLD_CNGN,
} from '../src/services/agentVaultService.js';
import {
  _resetConsumedPaymentsForTesting,
  X402_CELO_NETWORK,
} from '../src/services/selfX402Service.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
} from '../src/config/celo.js';
import { VERIFICATION_STATUS } from '../src/services/selfAgentIdService.js';

const MERCHANT_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const HUMAN_OPERATOR_WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

test('1. Ingest Merchant Invoice & Validate Line Item Math', () => {
  _resetVaultInvoicesForTesting();

  const items = [
    { name: 'Compute GPU Instance (1 hr)', quantity: 1, unitPrice: 0.80 },
    { name: 'Bandwidth Egress (10GB)', quantity: 2, unitPrice: 0.35 },
  ];

  // 1 * 0.80 + 2 * 0.35 = 1.50
  const invoice = ingestMerchantInvoice({
    invoiceId: 'INV-1001',
    merchantTag: '₦cloudcompute',
    payTo: MERCHANT_WALLET,
    items,
    totalAmount: '1.50',
    currency: 'USDT',
    callbackUrl: 'https://cloudcompute.xyz/webhooks/orders',
  });

  assert.equal(invoice.invoiceId, 'INV-1001');
  assert.equal(invoice.merchantTag, '₦cloudcompute');
  assert.equal(invoice.totalAmount, '1.50');
  assert.equal(invoice.status, VAULT_CHECKOUT_STATUS.PENDING_AUTHORIZATION);
  assert.equal(invoice.items.length, 2);
});

test('2. Reject Malformed Invoice Line Items Sum Mismatch', () => {
  const items = [
    { name: 'API Credits', quantity: 1, unitPrice: 2.00 },
  ];

  assert.throws(
    () => ingestMerchantInvoice({
      invoiceId: 'INV-MISMATCH',
      merchantTag: '₦merchant',
      payTo: MERCHANT_WALLET,
      items,
      totalAmount: '5.00', // Mismatch!
    }),
    /does not match invoice total/
  );
});

test('3. Autonomous Checkout Under Spend Limit with Active Altana Session', async () => {
  const invoice = ingestMerchantInvoice({
    invoiceId: 'INV-AUTO-1',
    merchantTag: '₦fastproxy',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Proxy 1000 requests', quantity: 1, unitPrice: 1.20 }],
    totalAmount: '1.20', // <= 2.0 USD₮ threshold
    currency: 'USDT',
  });

  const activeAltanaSession = {
    walletAddress: OFFICIAL_AGENT_WALLET,
    status: 'active',
    expiry: Math.floor(Date.now() / 1000) + 3600,
    sessionKeyId: 'altana_session_001',
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };

  const policy = await evaluateVaultCheckoutPolicy({
    invoice,
    agent,
    altanaSession: activeAltanaSession,
  });

  assert.equal(policy.allowed, true);
  assert.equal(policy.status, VAULT_CHECKOUT_STATUS.AUTHORIZED);
  assert.equal(policy.authorizationType, 'autonomous_altana_session');
  assert.equal(policy.requiresHumanAuthorization, false);
});

test('4. High-Value Checkout Exceeding Autonomous Limit Requires Human Authorization', async () => {
  const highValueInvoice = ingestMerchantInvoice({
    invoiceId: 'INV-HIGH-VAL',
    merchantTag: '₦servers',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Dedicated Server Tier 1', quantity: 1, unitPrice: 25.00 }],
    totalAmount: '25.00', // Exceeds 2.0 USD₮ cap
    currency: 'USDT',
  });

  const activeAltanaSession = {
    walletAddress: OFFICIAL_AGENT_WALLET,
    status: 'active',
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };

  const policy = await evaluateVaultCheckoutPolicy({
    invoice: highValueInvoice,
    agent,
    altanaSession: activeAltanaSession,
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.status, VAULT_CHECKOUT_STATUS.PENDING_AUTHORIZATION);
  assert.equal(policy.requiresHumanAuthorization, true);
  assert.equal(policy.authorizationType, 'human_approval_required');
});

test('5. Merchant Requiring Self Agent ID Rejects Unverified Agent', async () => {
  const gatedInvoice = ingestMerchantInvoice({
    invoiceId: 'INV-GATED-1',
    merchantTag: '₦telecom_esim',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Global Roaming eSIM', quantity: 1, unitPrice: 1.50 }],
    totalAmount: '1.50',
    requiresSelfVerification: true, // Merchant requires Self ID
  });

  const unverifiedAgent = { tag: 'bot_unverified', owner: '0x1111111111111111111111111111111111111111' };
  const unverifiedEvidence = {
    status: VERIFICATION_STATUS.UNVERIFIED,
    isVerified: false,
  };

  const policy = await evaluateVaultCheckoutPolicy({
    invoice: gatedInvoice,
    agent: unverifiedAgent,
    selfEvidence: unverifiedEvidence,
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.status, VAULT_CHECKOUT_STATUS.REJECTED);
  assert.match(policy.reason, /mandates Self Agent ID proof/);
});

test('6. Merchant Requiring Self Agent ID Accepts Verified Human Proof', async () => {
  const gatedInvoice = ingestMerchantInvoice({
    invoiceId: 'INV-GATED-2',
    merchantTag: '₦telecom_esim',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Global Roaming eSIM', quantity: 1, unitPrice: 1.50 }],
    totalAmount: '1.50',
    requiresSelfVerification: true,
  });

  const verifiedAgent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const verifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
  };

  const activeAltanaSession = {
    walletAddress: OFFICIAL_AGENT_WALLET,
    status: 'active',
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const policy = await evaluateVaultCheckoutPolicy({
    invoice: gatedInvoice,
    agent: verifiedAgent,
    selfEvidence: verifiedEvidence,
    altanaSession: activeAltanaSession,
  });

  assert.equal(policy.allowed, true);
  assert.equal(policy.status, VAULT_CHECKOUT_STATUS.AUTHORIZED);
});

test('7. Human Biometric Authorization Flow Transitions Status to AUTHORIZED', () => {
  const invoice = ingestMerchantInvoice({
    invoiceId: 'INV-HUMAN-AUTH',
    merchantTag: '₦hardware',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'IoT Sensor Node', quantity: 1, unitPrice: 18.50 }],
    totalAmount: '18.50',
  });

  assert.equal(invoice.status, VAULT_CHECKOUT_STATUS.PENDING_AUTHORIZATION);

  // Human authorizes via WebAuthn biometric passkey
  const authorized = authorizeVaultCheckout({
    invoiceId: 'INV-HUMAN-AUTH',
    humanSignerAddress: HUMAN_OPERATOR_WALLET,
    signature: '0xpasskey_signature_proof',
    passkeyCredentialId: 'passkey_cred_1042',
  });

  assert.equal(authorized.status, VAULT_CHECKOUT_STATUS.AUTHORIZED);
  assert.equal(authorized.authorizationDetails.humanApprover.toLowerCase(), HUMAN_OPERATOR_WALLET.toLowerCase());
  assert.equal(authorized.authorizationDetails.passkeyCredentialId, 'passkey_cred_1042');
});

test('8. Settlement Rejects Unauthorized Invoice', async () => {
  const unauthorizedInvoice = ingestMerchantInvoice({
    invoiceId: 'INV-UNAUTHORIZED',
    merchantTag: '₦shop',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Domain Name 1yr', quantity: 1, unitPrice: 12.00 }],
    totalAmount: '12.00',
  });

  await assert.rejects(
    async () => {
      await settleVaultCheckout({
        invoiceId: 'INV-UNAUTHORIZED',
        paymentProof: { network: X402_CELO_NETWORK },
      });
    },
    /is not authorized for settlement/
  );
});

test('9. Successful End-to-End Vault Checkout Settlement with ERC-8021 Attribution', async () => {
  await _resetConsumedPaymentsForTesting();

  const invoice = ingestMerchantInvoice({
    invoiceId: 'INV-SETTLE-OK',
    merchantTag: '₦cloudstorage',
    payTo: MERCHANT_WALLET,
    items: [{ name: '1TB Decentralized Backup', quantity: 1, unitPrice: 1.00 }],
    totalAmount: '1.00',
    currency: 'USDT',
    callbackUrl: 'https://cloudstorage.xyz/api/fulfill',
  });

  // Human authorizes
  authorizeVaultCheckout({
    invoiceId: 'INV-SETTLE-OK',
    humanSignerAddress: HUMAN_OPERATOR_WALLET,
  });

  // Obtain bound x402 challenge requirement
  const req = getOrCreateVaultPaymentRequirement('INV-SETTLE-OK');

  // Client creates matching x402 payment proof
  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '1000000', // 1.00 USDT (6 decimals)
    payTo: MERCHANT_WALLET,
    nonce: req.nonce, // bound to challenge
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xvault_tx_hash_1234567890abcdef',
    isSimulation: true,
  };

  const settlement = await settleVaultCheckout({
    invoiceId: 'INV-SETTLE-OK',
    paymentProof,
  });

  assert.equal(settlement.ok, true);
  assert.equal(settlement.status, 200);
  assert.equal(settlement.orderReceipt.fulfillmentStatus, 'ORDER_CONFIRMED');
  assert.equal(settlement.orderReceipt.attributionTag, CELO_ATTRIBUTION_TAG);
  assert.equal(settlement.orderReceipt.webhookDelivery, 'DISPATCHED_200');
  assert.equal(settlement.orderReceipt.settledAmount, '1.00');

  // Verify invoice state updated to SETTLED
  const updatedInvoice = getVaultInvoice('INV-SETTLE-OK');
  assert.equal(updatedInvoice.status, VAULT_CHECKOUT_STATUS.SETTLED);
});

test('10. Replay Protection: Settling the Same Vault Checkout Proof Twice is Rejected', async () => {
  const invoice = ingestMerchantInvoice({
    invoiceId: 'INV-REPLAY-PREVENTION',
    merchantTag: '₦cloudstorage',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'API Key', quantity: 1, unitPrice: 0.50 }],
    totalAmount: '0.50',
    currency: 'USDT',
  });

  authorizeVaultCheckout({
    invoiceId: 'INV-REPLAY-PREVENTION',
    humanSignerAddress: HUMAN_OPERATOR_WALLET,
  });

  const req = getOrCreateVaultPaymentRequirement('INV-REPLAY-PREVENTION');

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '500000', // 0.50 USDT
    payTo: MERCHANT_WALLET,
    nonce: req.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xreplay_tx_hash_unique_555',
    isSimulation: true,
  };

  // Run 1: Succeeds
  const res1 = await settleVaultCheckout({
    invoiceId: 'INV-REPLAY-PREVENTION',
    paymentProof,
  });
  assert.equal(res1.ok, true);

  // Run 2: Replay is rejected because invoice is already settled
  await assert.rejects(
    async () => {
      await settleVaultCheckout({
        invoiceId: 'INV-REPLAY-PREVENTION',
        paymentProof,
      });
    },
    /is not authorized for settlement/
  );
});

test('11. Expired Invoice Evaluation Rejection', async () => {
  const expiredInvoice = ingestMerchantInvoice({
    invoiceId: 'INV-EXPIRED-TEST',
    merchantTag: '₦expiring_shop',
    payTo: MERCHANT_WALLET,
    items: [{ name: 'Flash Deal', quantity: 1, unitPrice: 1.00 }],
    totalAmount: '1.00',
    expirySeconds: -10, // Created in the past
  });

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };

  const policy = await evaluateVaultCheckoutPolicy({
    invoice: expiredInvoice,
    agent,
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.status, VAULT_CHECKOUT_STATUS.EXPIRED);
  assert.match(policy.reason, /has expired/);
});
