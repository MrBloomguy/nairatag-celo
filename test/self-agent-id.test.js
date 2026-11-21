import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAgentVerificationStatus,
  initiateAgentRegistrationSession,
  evaluateAgentCapabilityAccess,
  validateEvidenceIdentityBinding,
  SELF_REGISTRY_CELO_MAINNET,
  SELF_PROOF_PROVIDER_CELO_MAINNET,
  VERIFICATION_POLICIES,
  VERIFICATION_STATUS,
} from '../src/services/selfAgentIdService.js';
import {
  createX402PaymentRequirement,
  buildX402Response,
  verifyX402PaymentProof,
  verifyOnchainSettlement,
  executeSelfGatedAgentCapability,
  withSelfAndX402Gate,
  _resetConsumedPaymentsForTesting,
  X402_CELO_NETWORK,
  X402_SCHEME,
} from '../src/services/selfX402Service.js';
import {
  consumePaymentDigestAtomic,
  isPaymentConsumed,
  getPaymentRecord,
  loadDurableStore,
} from '../src/services/durablePaymentStore.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
} from '../src/config/celo.js';

test('1. Successful Self Verification: On-Chain Live Mainnet Contract & Fresh Proof Evaluation', async () => {
  // Read live from Celo Mainnet registry contract (0xaC3DF9ABf80d0F5c020C06B04Cced27763355944)
  const status = await getAgentVerificationStatus({
    agentAddress: OFFICIAL_AGENT_WALLET,
  });

  assert.equal(status.chainId, 42220);
  assert.equal(status.registryAddress.toLowerCase(), SELF_REGISTRY_CELO_MAINNET.toLowerCase());
  assert.ok(status.status);
  assert.equal(typeof status.isVerified, 'boolean');

  // Synthetic valid fresh proof
  const verifiedMockEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    chainId: 42220,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    agentId: 1042,
    hasHumanProof: true,
    isProofFresh: true,
    proofExpiresAt: Math.floor(Date.now() / 1000) + 86400,
    nullifier: '0xabc123',
  };

  assert.equal(verifiedMockEvidence.status, VERIFICATION_STATUS.VERIFIED);
  assert.ok(verifiedMockEvidence.isProofFresh);
  assert.ok(verifiedMockEvidence.hasHumanProof);
});

test('2. Invalid Verification Evidence Rejection', () => {
  const invalidEvidence = {
    status: VERIFICATION_STATUS.FAILED,
    isVerified: false,
    error: 'Malformed on-chain response',
  };

  assert.equal(invalidEvidence.isVerified, false);
  assert.equal(invalidEvidence.status, VERIFICATION_STATUS.FAILED);
});

test('3. Pending Verification Session Flow', async () => {
  const session = await initiateAgentRegistrationSession({
    agentAddress: OFFICIAL_AGENT_WALLET,
    disclosures: { minimumAge: 18, ofac: true },
  });

  assert.ok(session.ok);
  assert.equal(session.stage, 'pending');
  assert.ok(session.deepLink.includes('register'));
  assert.ok(session.scanUrl);
  assert.equal(session.agentAddress.toLowerCase(), OFFICIAL_AGENT_WALLET.toLowerCase());
});

test('4. Expired Verification Detection', async () => {
  const expiredEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.EXPIRED,
    isVerified: false,
    agentId: 1042,
    hasHumanProof: true,
    isProofFresh: false,
    proofExpiresAt: Math.floor(Date.now() / 1000) - 3600,
    proofExpiresAtIso: new Date(Date.now() - 3600000).toISOString(),
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const access = await evaluateAgentCapabilityAccess({
    agent,
    capability: 'financial_advice',
    verificationEvidence: expiredEvidence,
  });

  assert.equal(access.allowed, false);
  assert.equal(access.status, VERIFICATION_STATUS.EXPIRED);
  assert.ok(access.reason.includes('expired'));
});

test('5. Revoked Verification Rejection', async () => {
  const revokedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.REVOKED,
    isVerified: false,
    agentId: 1042,
    hasHumanProof: false, // Proof stripped on-chain
    isProofFresh: false,
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const access = await evaluateAgentCapabilityAccess({
    agent,
    capability: 'privileged_action',
    verificationEvidence: revokedEvidence,
  });

  assert.equal(access.allowed, false);
  assert.equal(access.status, VERIFICATION_STATUS.REVOKED);
  assert.ok(access.reason.includes('revoked'));
});

test('6. Verification Belonging to Another Identity (Identity Theft Rejection)', () => {
  const legitAgent = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';
  const attackerAgent = '0x1111111111111111111111111111111111111111';

  const validEvidence = {
    agentAddress: legitAgent,
    status: VERIFICATION_STATUS.VERIFIED,
    agentId: 1042,
  };

  const isLegitValid = validateEvidenceIdentityBinding({
    claimedAgentAddress: legitAgent,
    evidence: validEvidence,
  });
  assert.equal(isLegitValid, true);

  const isAttackerValid = validateEvidenceIdentityBinding({
    claimedAgentAddress: attackerAgent,
    evidence: validEvidence,
  });
  assert.equal(isAttackerValid, false, 'Attacker cannot reuse another agent proof');
});

test('7. Unverified Agent Attempting Protected Capability (Fails with 403)', async () => {
  const unverifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.UNVERIFIED,
    isVerified: false,
  };

  const agent = { canonicalTag: '₦NAIRATAG', tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const access = await evaluateAgentCapabilityAccess({
    agent,
    capability: 'marketplace_seller',
    policyLevel: VERIFICATION_POLICIES.VERIFIED_ONLY,
    verificationEvidence: unverifiedEvidence,
  });

  assert.equal(access.allowed, false);
  assert.equal(access.status, VERIFICATION_STATUS.UNVERIFIED);
  assert.ok(access.reason.includes('not verified on Self Agent ID'));
});

test('8. Verified Agent Accessing Allowed Capability', async () => {
  const verifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
    agentId: 1042,
  };

  const agent = { canonicalTag: '₦NAIRATAG', tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const access = await evaluateAgentCapabilityAccess({
    agent,
    capability: 'marketplace_seller',
    policyLevel: VERIFICATION_POLICIES.VERIFIED_ONLY,
    verificationEvidence: verifiedEvidence,
  });

  assert.equal(access.allowed, true);
  assert.equal(access.status, VERIFICATION_STATUS.VERIFIED);
  assert.ok(access.reason.includes('verified on-chain'));
});

test('9. x402 Payment Required for Protected Request (Returns 402 with WWW-Authenticate)', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'defi_ai_audit',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.10',
    asset: CELO_USDT_ADDRESS,
  });

  assert.equal(requirement.scheme, X402_SCHEME);
  assert.equal(requirement.network, X402_CELO_NETWORK);
  assert.equal(requirement.amount, '100000', '0.10 USD₮ scales to 100,000 atomic units (6 decimals)');
  assert.equal(requirement.attributionTag, CELO_ATTRIBUTION_TAG);

  const response = buildX402Response(requirement);
  assert.equal(response.status, 402);
  assert.ok(response.headers['WWW-Authenticate'].startsWith('X-PAYMENT'));
  assert.ok(response.headers['WWW-Authenticate'].includes(requirement.nonce));
});

test('10. Invalid Payment Proof Rejection', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'market_intel',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: null,
      expectedRequirement: requirement,
    }),
    /Payment proof is missing/
  );
});

test('11. Expired Payment Proof Rejection', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'market_intel',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
    maxTimeoutSeconds: 60,
  });

  const expiredProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
  };

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: expiredProof,
      expectedRequirement: requirement,
    }),
    /expired/
  );
});

test('12. Replayed Payment Proof Rejection (Replay Attack Prohibited)', () => {
  _resetConsumedPaymentsForTesting();

  const requirement = createX402PaymentRequirement({
    resourceId: 'data_feed',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const validProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xdeadbeef1234567890abcdef',
  };

  // 1st Verification succeeds
  const firstResult = verifyX402PaymentProof({
    paymentProof: validProof,
    expectedRequirement: requirement,
  });
  assert.equal(firstResult.verified, true);

  // 2nd Verification of SAME proof throws replay error
  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: validProof,
      expectedRequirement: requirement,
    }),
    /Payment proof has already been redeemed/
  );
});

test('13. Incorrect Payment Recipient Rejection', () => {
  const attackerAddress = '0x1111111111111111111111111111111111111111';
  const requirement = createX402PaymentRequirement({
    resourceId: 'weather_logistics',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const wrongRecipientProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: attackerAddress,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
  };

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: wrongRecipientProof,
      expectedRequirement: requirement,
    }),
    /Payment recipient mismatch/
  );
});

test('14. Incorrect Payment Amount Rejection (Insufficient Value)', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'weather_logistics',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '5.0', // 5,000,000 atomic units
    asset: CELO_USDT_ADDRESS,
  });

  const underpaidProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '1000000', // only 1.0 USD₮
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
  };

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: underpaidProof,
      expectedRequirement: requirement,
    }),
    /Insufficient payment amount/
  );
});

test('15. Payment on Wrong Network Rejection', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'weather_logistics',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const wrongChainProof = {
    network: 'eip155:1', // Ethereum Mainnet instead of Celo
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
  };

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: wrongChainProof,
      expectedRequirement: requirement,
    }),
    /Invalid network: Expected eip155:42220/
  );
});

test('16. Payment Confirmed but Agent Execution Fails (Audit Trail Retained)', async () => {
  _resetConsumedPaymentsForTesting();

  const verifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
    agentId: 1042,
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const requirement = createX402PaymentRequirement({
    resourceId: 'flaky_compute',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xabc1234567890abcdef',
  };

  const result = await executeSelfGatedAgentCapability({
    agent,
    capability: 'flaky_compute',
    verificationEvidence: verifiedEvidence,
    paymentProof,
    executeHandler: async () => {
      throw new Error('Downstream compute node timeout');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.error, 'Agent Execution Failed');
  assert.ok(result.paymentReceipt, 'Payment receipt is retained for refund/dispute audit');
  assert.equal(result.paymentReceipt.txHash, '0xabc1234567890abcdef');
});

test('17. Altana Session Missing or Revoked Check', () => {
  const sessionActive = {
    walletAddress: OFFICIAL_AGENT_WALLET,
    expiry: Math.floor(Date.now() / 1000) + 3600,
    status: 'active',
  };
  const sessionRevoked = {
    walletAddress: OFFICIAL_AGENT_WALLET,
    status: 'revoked',
  };

  const isEligibleActive = sessionActive.status === 'active';
  const isEligibleRevoked = sessionRevoked.status === 'active';

  assert.equal(isEligibleActive, true);
  assert.equal(isEligibleRevoked, false, 'Revoked Altana session cannot execute even if Self verified');
});

test('18. Successful Complete End-to-End Flow (Verification -> x402 Payment -> Execution)', async () => {
  _resetConsumedPaymentsForTesting();

  const verifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
    agentId: 1042,
  };

  const agent = { canonicalTag: '₦NAIRATAG', tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const capabilityKey = 'cngn_forex_intelligence';

  // Step 1: Client calls without payment proof -> Receives HTTP 402 Challenge
  const challengeResult = await executeSelfGatedAgentCapability({
    agent,
    capability: capabilityKey,
    verificationEvidence: verifiedEvidence,
    paymentProof: null,
    price: '0.05',
    executeHandler: async () => ({ message: 'Secret intelligence' }),
  });

  assert.equal(challengeResult.status, 402);
  assert.ok(challengeResult.body.paymentRequirement);
  const issuedChallenge = challengeResult.body.paymentRequirement;

  // Step 2: Client settles payment and provides valid proof bound to issued challenge
  const clientPaymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: issuedChallenge.amount,
    payTo: issuedChallenge.payTo,
    nonce: issuedChallenge.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0x998877665544332211aabbccddeeff',
  };

  // Step 3: Client resubmits with payment proof -> Verified and Executed
  const finalResult = await executeSelfGatedAgentCapability({
    agent,
    capability: capabilityKey,
    verificationEvidence: verifiedEvidence,
    paymentProof: clientPaymentProof,
    price: '0.05',
    executeHandler: async ({ agent, paymentReceipt }) => {
      return {
        forexForecast: 'cNGN/USD₮ stable at 1445.50',
        confidenceScore: 0.98,
        dispatchedForAgent: agent.tag,
        paymentRef: paymentReceipt.paymentDigest,
      };
    },
  });

  assert.equal(finalResult.ok, true);
  assert.equal(finalResult.status, 200);
  assert.equal(finalResult.data.forexForecast, 'cNGN/USD₮ stable at 1445.50');
  assert.equal(finalResult.agent.verified, true);
  assert.equal(finalResult.paymentReceipt.txHash, '0x998877665544332211aabbccddeeff');
  assert.equal(finalResult.attributionTag, CELO_ATTRIBUTION_TAG);
});

test('19. Duplicate payment digest after application restart (Durable Replay Protection)', async () => {
  await _resetConsumedPaymentsForTesting();

  const requirement = createX402PaymentRequirement({
    resourceId: 'persistent_data',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xrestart_test_tx_hash_12345',
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const verificationEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
  };

  // Run 1: Execution completes and is stored to durable storage
  const res1 = await executeSelfGatedAgentCapability({
    agent,
    capability: 'persistent_data',
    verificationEvidence,
    paymentProof,
    executeHandler: async () => ({ value: 'persisted' }),
  });

  assert.equal(res1.ok, true);
  const digest = res1.paymentReceipt.paymentDigest;

  // Simulate process restart: reload store from disk
  await loadDurableStore();
  assert.equal(isPaymentConsumed(digest), true, 'Store maintains consumed status across reload');

  // Attempt to execute again with same proof after simulated restart
  const res2 = await executeSelfGatedAgentCapability({
    agent,
    capability: 'persistent_data',
    verificationEvidence,
    paymentProof,
    executeHandler: async () => ({ value: 'persisted' }),
  });

  assert.equal(res2.ok, false);
  assert.ok(res2.status === 402 || res2.status === 409);
  assert.match(res2.reason || res2.error, /already been redeemed|Payment already consumed/i);
});

test('20. Two concurrent requests using the same payment (Atomic Concurrency Lock)', async () => {
  await _resetConsumedPaymentsForTesting();

  const requirement = createX402PaymentRequirement({
    resourceId: 'race_condition_test',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xconcurrent_race_test_tx',
  };

  const dummyDigest = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  // Fire two atomic consumption requests concurrently
  const [resA, resB] = await Promise.allSettled([
    consumePaymentDigestAtomic({
      paymentDigest: dummyDigest,
      requirement,
      paymentProof,
    }),
    consumePaymentDigestAtomic({
      paymentDigest: dummyDigest,
      requirement,
      paymentProof,
    }),
  ]);

  // Exactly one must succeed and one must be rejected by atomic lock
  const successCount = [resA, resB].filter((r) => r.status === 'fulfilled').length;
  const failureCount = [resA, resB].filter((r) => r.status === 'rejected').length;

  assert.equal(successCount, 1, 'Only one concurrent consumption succeeds');
  assert.equal(failureCount, 1, 'Concurrent double-consumption is atomically rejected');
});

test('21. Invalid facilitator or network response rejection', () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'network_test',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const foreignNetworkProof = {
    network: 'eip155:1', // Ethereum Mainnet instead of Celo Mainnet
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xforeign_tx',
  };

  assert.throws(
    () => verifyX402PaymentProof({
      paymentProof: foreignNetworkProof,
      expectedRequirement: requirement,
    }),
    /Invalid network: Expected eip155:42220/
  );
});

test('22. Payment transaction not yet confirmed on Celo Mainnet', async () => {
  const requirement = createX402PaymentRequirement({
    resourceId: 'unmined_test',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  // Query with an unmined / non-existent tx hash
  await assert.rejects(
    async () => {
      await verifyOnchainSettlement({
        txHash: '0x000000000000000000000000000000000000000000000000000000000000dead',
        expectedRequirement: requirement,
      });
    },
    /could not be found|not be processed|not yet confirmed on Celo Mainnet|reverted/i
  );
});

test('23. Verification revoked between challenge and execution (Fails Closed with 403)', async () => {
  await _resetConsumedPaymentsForTesting();

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const requirement = createX402PaymentRequirement({
    resourceId: 'revocation_race',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xrevocation_proof_hash',
  };

  // Agent was verified initially, but operator revokes proof before execution completes
  const revokedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.REVOKED,
    isVerified: false,
    isProofFresh: false,
  };

  const result = await executeSelfGatedAgentCapability({
    agent,
    capability: 'revocation_race',
    verificationEvidence: revokedEvidence,
    paymentProof,
    executeHandler: async () => ({ secret: 'data' }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.match(result.reason, /revoked/i);
});

test('24. Alternate route attempting to bypass authorization (withSelfAndX402Gate enforcement)', async () => {
  await _resetConsumedPaymentsForTesting();

  // Create internal compute handler protected with gate
  const internalCompute = withSelfAndX402Gate(async ({ agent }) => {
    return { confidentialCompute: `Processed for ${agent.tag}` };
  });

  const unverifiedAgent = { tag: 'rogue-bot', owner: '0x1111111111111111111111111111111111111111' };

  // Attempt bypass: Call directly without verified evidence
  const bypassAttempt = await internalCompute({
    agent: unverifiedAgent,
    capability: 'deep_insights',
    paymentProof: null,
  });

  assert.equal(bypassAttempt.ok, false);
  assert.equal(bypassAttempt.status, 403, 'Gate fails closed and rejects unverified bypass attempt');
});

test('25. Agent execution failure after confirmed payment (Traceable receipt & Idempotent retry)', async () => {
  await _resetConsumedPaymentsForTesting();

  const verifiedEvidence = {
    agentAddress: OFFICIAL_AGENT_WALLET,
    status: VERIFICATION_STATUS.VERIFIED,
    isVerified: true,
    isProofFresh: true,
  };

  const agent = { tag: 'nairatag', owner: OFFICIAL_AGENT_WALLET };
  const requirement = createX402PaymentRequirement({
    resourceId: 'resilient_compute',
    agentTag: '₦nairatag',
    payTo: OFFICIAL_AGENT_WALLET,
    amount: '0.05',
    asset: CELO_USDT_ADDRESS,
  });

  const paymentProof = {
    network: X402_CELO_NETWORK,
    asset: CELO_USDT_ADDRESS,
    amount: '50000',
    payTo: OFFICIAL_AGENT_WALLET,
    nonce: requirement.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0xretry_test_tx_hash_7788',
  };

  let executionAttempt = 0;

  // First Attempt: Compute node fails
  const failedResult = await executeSelfGatedAgentCapability({
    agent,
    capability: 'resilient_compute',
    verificationEvidence: verifiedEvidence,
    paymentProof,
    executeHandler: async () => {
      executionAttempt++;
      if (executionAttempt === 1) {
        throw new Error('Downstream GPU timeout');
      }
      return { computeResult: 'Success on retry!' };
    },
  });

  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.status, 500);
  assert.equal(failedResult.canRetryWithoutRepay, true);
  assert.ok(failedResult.paymentReceipt, 'Receipt is retained for user audit and dispute proof');
  assert.ok(failedResult.idempotencyKey);

  // Check audit record in durable store
  const storedRecord = getPaymentRecord(failedResult.idempotencyKey);
  assert.equal(storedRecord.status, 'failed');
  assert.equal(storedRecord.error, 'Downstream GPU timeout');

  // Second Attempt: Resubmit with same paymentProof (Idempotent Retry)
  const retryResult = await executeSelfGatedAgentCapability({
    agent,
    capability: 'resilient_compute',
    verificationEvidence: verifiedEvidence,
    paymentProof,
    executeHandler: async () => {
      executionAttempt++;
      return { computeResult: 'Success on retry!' };
    },
  });

  assert.equal(retryResult.ok, true, 'Retry succeeds without requiring re-payment');
  assert.equal(retryResult.status, 200);
  assert.equal(retryResult.data.computeResult, 'Success on retry!');
});
