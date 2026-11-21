/**
 * @file agent-lifecycle.test.js
 * @description Comprehensive automated test suite for NairaTag Platform-Wide Agent Lifecycle,
 * Self Agent ID Identity Verification, and Altana Smart Wallet Delegation on Celo Mainnet (42220).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentDraft,
  submitSelfVerification,
  provisionAltanaWallet,
  grantAgentSessionPolicy,
  linkERC8004Identity,
  revokeAgentSession,
  checkAgentExecutionPermission,
  seedDefaultAgents,
  getAgentLifecycleRecord,
  listAllAgentLifecycleRecords,
  LIFECYCLE_STATUS,
  DEFAULT_DAILY_LIMITS,
} from '../src/services/agentLifecycleService.js';
import {
  saveAgentRecord,
  getAgentRecord,
  listAgentRecords,
  deleteAgentRecord,
  resetAgentStoreForTesting,
} from '../src/services/agentIdentityStore.js';
import {
  ALTANA_CELO_CHAIN_ID,
  ALTANA_CELO_KEYSTORE,
  buildStandardAgentPolicy,
  buildTaskPaymentPolicy,
} from '../src/services/altanaWalletService.js';
import {
  SELF_REGISTRY_CELO_MAINNET,
  VERIFICATION_STATUS,
} from '../src/services/selfAgentIdService.js';
import {
  CELO_ATTRIBUTION_TAG,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
} from '../src/config/celo.js';

test('1. Agent Lifecycle: Create Agent Draft with Valid Human Owner EOA', async () => {
  await resetAgentStoreForTesting();

  const draft = await createAgentDraft({
    tag: 'studio',
    name: '₦STUDIO Creative Agent',
    description: 'High-end design and multimedia production studio on Celo.',
    ownerAddress: '0x1234567890123456789012345678901234567890',
    category: 'design',
  });

  assert.equal(draft.tag, 'studio');
  assert.equal(draft.canonicalTag, '₦STUDIO');
  assert.equal(draft.ownerAddress, '0x1234567890123456789012345678901234567890');
  assert.equal(draft.status, LIFECYCLE_STATUS.VERIFICATION_REQUIRED);
  assert.equal(draft.self.verified, false);
  assert.equal(draft.self.status, VERIFICATION_STATUS.UNVERIFIED);
  assert.equal(draft.chainId, 42220);
  assert.equal(draft.attributionTag, CELO_ATTRIBUTION_TAG);
});

test('2. Agent Lifecycle: Reject Duplicate Agent Creation Attempt', async () => {
  await assert.rejects(
    async () => {
      await createAgentDraft({
        tag: 'studio',
        name: 'Another Studio',
        ownerAddress: '0x9999999999999999999999999999999999999999',
      });
    },
    /already registered/i
  );
});

test('3. Agent Lifecycle: Rejection of Malformed Owner Address', async () => {
  await assert.rejects(
    async () => {
      await createAgentDraft({
        tag: 'invalidowner',
        ownerAddress: 'not-an-evm-address',
      });
    },
    /valid human owner/i
  );
});

test('4. Agent Lifecycle: Self Agent ID Proof Verification Transitions State to Wallet Provisioning', async () => {
  const verified = await submitSelfVerification({
    tag: 'studio',
    skipOnChainCheck: true,
    proofData: {
      nullifierHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
  });

  assert.equal(verified.self.verified, true);
  assert.equal(verified.self.status, VERIFICATION_STATUS.VERIFIED);
  assert.equal(verified.self.nullifierHash, '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
  assert.equal(verified.status, LIFECYCLE_STATUS.WALLET_PROVISIONING_PENDING);
});

test('5. Agent Lifecycle: Altana Smart Agent Wallet Provisioning', async () => {
  const walletProvisioned = await provisionAltanaWallet({
    tag: 'studio',
  });

  assert.ok(walletProvisioned.altana.walletAddress);
  assert.match(walletProvisioned.altana.walletAddress, /^0x[a-fA-F0-9]{40}$/);
  assert.equal(walletProvisioned.altana.keystoreAddress, ALTANA_CELO_KEYSTORE);
  assert.equal(walletProvisioned.status, LIFECYCLE_STATUS.SESSION_AUTHORIZATION_REQUIRED);
});

test('6. Agent Lifecycle: Prevent Altana Provisioning if Self Verification is Incomplete', async () => {
  await createAgentDraft({
    tag: 'unverifiedbot',
    name: 'Unverified Bot',
    ownerAddress: '0x2222222222222222222222222222222222222222',
  });

  await assert.rejects(
    async () => {
      await provisionAltanaWallet({ tag: 'unverifiedbot' });
    },
    /completed Self Agent ID human verification/i
  );
});

test('7. Agent Lifecycle: Grant Scoped Altana Session Key Policy', async () => {
  const sessionGranted = await grantAgentSessionPolicy({
    tag: 'studio',
    sessionDurationSeconds: 86400, // 24 hours
    dailyCngnLimit: '75000',
    dailyUsdtLimit: '50',
    dailyCeloLimit: '15',
  });

  assert.ok(sessionGranted.altana.activeSessionId);
  assert.equal(sessionGranted.altana.sessionStatus, 'active');
  assert.ok(sessionGranted.altana.sessionExpiry > Math.floor(Date.now() / 1000));
  assert.ok(sessionGranted.altana.spendLimits.length >= 2);
  assert.equal(sessionGranted.status, LIFECYCLE_STATUS.ACTIVE);
});

test('8. Agent Lifecycle: Link ERC-8004 Identity on Celo Mainnet', async () => {
  const linked = await linkERC8004Identity({
    tag: 'studio',
    tokenId: '4222001',
  });

  assert.equal(linked.erc8004.tokenId, '4222001');
  assert.ok(linked.erc8004.metadataUri.includes('studio.json'));
  assert.equal(linked.status, LIFECYCLE_STATUS.ACTIVE);
});

test('9. Execution Boundary: Authorized Execution Within Limit', async () => {
  const check = await checkAgentExecutionPermission({
    tag: 'studio',
    requestedAmount: 50000,
    token: 'cNGN',
  });

  assert.equal(check.allowed, true);
  assert.equal(check.attributionTag, CELO_ATTRIBUTION_TAG);
});

test('10. Execution Boundary: Rejection Exceeding Authorized Altana Session Limit', async () => {
  const check = await checkAgentExecutionPermission({
    tag: 'studio',
    requestedAmount: 100000, // Authorized is 75,000
    token: 'cNGN',
  });

  assert.equal(check.allowed, false);
  assert.equal(check.code, 'SPEND_LIMIT_EXCEEDED');
  assert.match(check.reason, /exceeds authorized Altana session limit/i);
});

test('11. Monotonic Revocation: Human Owner Revokes Altana Session Key', async () => {
  const revoked = await revokeAgentSession({
    tag: 'studio',
    reason: 'Security rotation by owner',
  });

  assert.equal(revoked.altana.sessionStatus, 'revoked');
  assert.equal(revoked.altana.activeSessionId, null);
  assert.equal(revoked.status, LIFECYCLE_STATUS.REVOKED);
  assert.ok(revoked.altana.sessionRevokedAt);

  // Verification that subsequent execution check is rejected
  const check = await checkAgentExecutionPermission({
    tag: 'studio',
    requestedAmount: 1000,
    token: 'cNGN',
  });

  assert.equal(check.allowed, false);
  assert.equal(check.code, 'SESSION_REVOKED');
});

test('12. Security Boundary: Zero Secret Storage Enforcement', async () => {
  // Verify that identity store rejects any record containing private keys or seeds
  await assert.rejects(
    async () => {
      await saveAgentRecord('leaktest', {
        tag: 'leaktest',
        ownerAddress: '0x1111111111111111111111111111111111111111',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });
    },
    /SECURITY_VIOLATION.*privateKey/i
  );

  await assert.rejects(
    async () => {
      await saveAgentRecord('leaktest2', {
        tag: 'leaktest2',
        ownerAddress: '0x1111111111111111111111111111111111111111',
        nested: {
          secretKey: 'top-secret',
        },
      });
    },
    /SECURITY_VIOLATION.*secretKey/i
  );
});

test('13. Pre-Seeding: Default Core Platform Agents are Seeded with Valid Celo Mainnet Identity', async () => {
  const allAgents = await seedDefaultAgents();
  assert.ok(allAgents.length >= 7);

  const nairatag = allAgents.find((a) => a.tag === 'nairatag');
  assert.ok(nairatag);
  assert.equal(nairatag.self.verified, true);
  assert.equal(nairatag.altana.sessionStatus, 'active');
  assert.equal(nairatag.erc8004.tokenId, '1');

  const bloom = allAgents.find((a) => a.tag === 'bloom');
  assert.ok(bloom);
  assert.equal(bloom.self.verified, true);
  assert.equal(bloom.altana.sessionStatus, 'active');

  const music = allAgents.find((a) => a.tag === 'music');
  assert.ok(music);
  assert.equal(music.self.verified, true);
  assert.equal(music.altana.sessionStatus, 'active');
});

test('14. Execution Boundary: Unregistered Agent Rejection', async () => {
  const check = await checkAgentExecutionPermission({
    tag: 'nonexistent',
    requestedAmount: 50,
  });

  assert.equal(check.allowed, false);
  assert.equal(check.code, 'AGENT_NOT_FOUND');
});

test('15. Execution Boundary: Unverified Agent Rejection', async () => {
  const check = await checkAgentExecutionPermission({
    tag: 'unverifiedbot',
    requestedAmount: 50,
  });

  assert.equal(check.allowed, false);
  assert.equal(check.code, 'SELF_VERIFICATION_REQUIRED');
});

test('16. Booking Engine: Rejects Service Publishing from Unverified Human Owner', async () => {
  const { registerService, PRICING_MODELS } = await import('../src/services/bookingRegistryService.js');

  assert.throws(
    () => {
      registerService(
        {
          id: 'srv-unverified-fail',
          agentTag: 'unverifiedbot',
          title: 'Unverified Design Session',
          description: 'Attempting to publish without human verification',
          category: 'design',
          pricingModel: PRICING_MODELS.FIXED,
          price: '25.00',
          currency: 'USDT',
        },
        { tag: 'unverifiedbot', selfVerified: false }
      );
    },
    /Self Agent ID Verification Required/i
  );
});

test('17. Booking Engine: Accepts Service Publishing from Verified Human Owner', async () => {
  const { registerService, PRICING_MODELS } = await import('../src/services/bookingRegistryService.js');

  const registered = registerService(
    {
      id: 'srv-verified-pass',
      agentTag: 'studio',
      title: 'Studio Creative Session',
      description: 'Verified studio production session',
      category: 'design',
      pricingModel: PRICING_MODELS.FIXED,
      price: '50.00',
      currency: 'USDT',
    },
    { tag: 'studio', selfVerified: true }
  );

  assert.equal(registered.id, 'srv-verified-pass');
  assert.equal(registered.canonicalTag, '₦STUDIO');
});
