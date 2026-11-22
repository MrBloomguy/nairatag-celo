import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getAgentPoints,
  awardVerificationPoints,
  awardActionPoints,
  calculateAgentTier,
  getPointsLeaderboard,
  REWARD_ACTIONS,
  _resetPointsStoreForTesting,
} from '../src/services/agentPointsService.js';

import {
  processNairaTagChatMessage,
  isVerificationQuery,
  extractReferencedAgentTag,
  OFFICIAL_PLATFORM_AGENT,
} from '../src/services/nairatagChatEngine.js';

test('1. Points Engine: Initial Platform Agent Pre-Seeded Points', async () => {
  await _resetPointsStoreForTesting();
  const nairatagPoints = await getAgentPoints('nairatag');
  assert.ok(nairatagPoints.totalPoints >= 1000, '₦nairatag should have at least 1000 points');
  assert.equal(nairatagPoints.level, 3, '₦nairatag should be Tier 3 Master Protocol Agent');
  assert.equal(nairatagPoints.verifiedBonusClaimed, true, '₦nairatag has claimed verification bonus');
});

test('2. Points Engine: Award 500 Trust Points on Self Verification', async () => {
  await _resetPointsStoreForTesting();
  const testTag = 'testagent';
  const initial = await getAgentPoints(testTag);
  assert.equal(initial.totalPoints, 0);
  assert.equal(initial.verifiedBonusClaimed, false);

  const awardResult = await awardVerificationPoints(testTag, {
    nullifier: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  });

  assert.equal(awardResult.success, true);
  assert.equal(awardResult.pointsAwarded, 500);
  assert.equal(awardResult.totalPoints, 500);
  assert.equal(awardResult.level, 2, '500 points elevates agent to Tier 2 Sovereign');

  const updated = await getAgentPoints(testTag);
  assert.equal(updated.totalPoints, 500);
  assert.equal(updated.verifiedBonusClaimed, true);
});

test('3. Points Engine: Idempotency Blocks Duplicate 500-Point Bonus', async () => {
  const testTag = 'testagent';
  const secondAttempt = await awardVerificationPoints(testTag, {
    nullifier: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  });

  assert.equal(secondAttempt.success, false);
  assert.equal(secondAttempt.alreadyClaimed, true);
  assert.equal(secondAttempt.pointsAwarded, 0);
  assert.equal(secondAttempt.totalPoints, 500, 'Total points remain 500 without duplication');
});

test('4. Points Engine: Tier & Multiplier Calculations', () => {
  const tier1 = calculateAgentTier(200);
  assert.equal(tier1.level, 1);
  assert.equal(tier1.tier, 'Novice Agent');

  const tier2 = calculateAgentTier(750);
  assert.equal(tier2.level, 2);
  assert.equal(tier2.tier, 'Verified Sovereign Agent');

  const tier3 = calculateAgentTier(1500);
  assert.equal(tier3.level, 3);
  assert.equal(tier3.tier, 'Master Protocol Agent');
});

test('5. Points Engine: Action Rewards (Publish Capacity & Escrow Tasks)', async () => {
  const testTag = 'testagent';
  const serviceResult = await awardActionPoints(testTag, REWARD_ACTIONS.SERVICE_PUBLISHED, {
    description: 'Smart Contract Audit Service',
  });
  assert.equal(serviceResult.pointsAwarded, 250);
  assert.equal(serviceResult.totalPoints, 750);

  const taskResult = await awardActionPoints(testTag, REWARD_ACTIONS.TASK_COMPLETED, {
    description: 'Sub-second Forex Routing Milestone',
  });
  assert.equal(taskResult.pointsAwarded, 150);
  assert.equal(taskResult.totalPoints, 900);
});

test('6. Points Engine: Leaderboard Sorts by Total Points', async () => {
  const leaderboard = await getPointsLeaderboard();
  assert.ok(leaderboard.length >= 2);
  assert.equal(leaderboard[0].rank, 1);
  assert.ok(leaderboard[0].totalPoints >= leaderboard[1].totalPoints, 'Rank 1 has highest points');
});

test('7. Chat Engine: Intent Detection for Verification Queries', () => {
  assert.equal(isVerificationQuery('How do I verify my agent?'), true);
  assert.equal(isVerificationQuery('Is @bloom verified?'), true);
  assert.equal(isVerificationQuery('Check Self Agent ID status'), true);
  assert.equal(isVerificationQuery('What are Trust Points?'), true);
  assert.equal(isVerificationQuery('What is the weather in Lagos?'), false);
});

test('8. Chat Engine: Referenced Agent Tag Extraction', () => {
  assert.equal(extractReferencedAgentTag('Is @bloom verified?'), 'bloom');
  assert.equal(extractReferencedAgentTag('Check verification for ₦meteo now'), 'meteo');
  assert.equal(extractReferencedAgentTag('Verify my agent please', null), null);
});

test('9. Chat Engine: Official ₦NAIRATAG Master Agent Verification Response', async () => {
  const result = await processNairaTagChatMessage({
    prompt: 'Are you verified with Self?',
    walletAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    currentAgent: OFFICIAL_PLATFORM_AGENT,
    allAgents: [OFFICIAL_PLATFORM_AGENT],
  });

  assert.ok(result.reply.includes('₦NAIRATAG'));
  assert.ok(result.reply.includes('0xaC3DF9ABf80d0F5c020C06B04Cced27763355944'));
  assert.ok(result.widget, 'Widget must be attached');
  assert.equal(result.widget.type, 'self_verification');
  assert.equal(result.widget.agentTag, 'nairatag');
  assert.equal(result.widget.isVerified, true);
  assert.equal(result.widget.pointsEarnable, 500);
});

test('10. Chat Engine: In-Chat Verification for Unverified Agent', async () => {
  const unverifiedAgent = {
    tag: 'unverifiedbot',
    name: 'Unverified Bot',
    address: '0x000000000000000000000000000000000000dEaD',
    ownerAddress: '0x000000000000000000000000000000000000dEaD',
  };

  const result = await processNairaTagChatMessage({
    prompt: 'Is @unverifiedbot verified?',
    walletAddress: '0x000000000000000000000000000000000000dEaD',
    currentAgent: OFFICIAL_PLATFORM_AGENT,
    allAgents: [OFFICIAL_PLATFORM_AGENT, unverifiedAgent],
  });

  assert.ok(result.reply.includes('Unverified (Human Proof Required)'));
  assert.ok(result.reply.includes('+500 Trust Points'));
  assert.ok(result.widget);
  assert.equal(result.widget.type, 'self_verification');
  assert.equal(result.widget.agentTag, 'unverifiedbot');
  assert.equal(result.widget.isVerified, false);
});

test('11. Chat Engine: Sovereign Agent Leaderboard Query', async () => {
  const result = await processNairaTagChatMessage({
    prompt: 'Show me the top agents leaderboard',
    walletAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    currentAgent: OFFICIAL_PLATFORM_AGENT,
    allAgents: [OFFICIAL_PLATFORM_AGENT],
  });

  assert.ok(result.reply.includes('Leaderboard'));
  assert.ok(result.widget);
  assert.equal(result.widget.type, 'points_leaderboard');
  assert.ok(Array.isArray(result.widget.leaderboard));
});
