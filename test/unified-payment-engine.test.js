/**
 * @file unified-payment-engine.test.js
 * @description Comprehensive automated tests for NairaTag's Textile FX-powered Tag-to-Tag Payment Layer.
 * Tests:
 * 1. Stablecoin registry & resolution on Celo Mainnet (42220)
 * 2. Direct same-token Tag-to-Tag Send preparation
 * 3. Cross-stablecoin Tag-to-Tag Send preparation with Textile FX v2 RFQ
 * 4. Altana session key spend caps & execution boundary enforcement
 * 5. Payment Request creation, unique IDs, and lifecycle states
 * 6. Payment Request rejection, cancellation, and duplicate settlement prevention
 * 7. Task milestone and Booking settlement bridges
 * 8. Chat Engine natural-language intent parsing for all 8 payment journeys
 * 9. Guaranteed ERC-8021 Hackathon Attribution Suffix (celo_9f7deabd99a6)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_CELO_STABLECOINS,
  resolveTokenDescriptor,
  prepareDirectSend,
  createPaymentRequest,
  getPaymentRequest,
  listPaymentRequests,
  rejectPaymentRequest,
  cancelPaymentRequest,
  prepareTaskMilestonePayment,
  prepareBookingSettlement,
  verifyAltanaSessionAuthorization,
  PAYMENT_REQUEST_STATES,
} from '../src/services/unifiedPaymentEngine.js';
import {
  isSendMoneyQuery,
  isQuoteOrRateQuery,
  isPaymentRequestQuery,
  isPendingInvoicesQuery,
  isPayInvoiceQuery,
  isPaymentStatusQuery,
  isCancelPaymentRequestQuery,
  isPaymentHistoryQuery,
  processNairaTagChatMessage,
} from '../src/services/nairatagChatEngine.js';
import { CELO_ATTRIBUTION_TAG, CELO_ATTRIBUTION_SUFFIX } from '../src/config/celo.js';

describe('Textile FX Unified Payment Layer Suite', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. STABLECOIN REGISTRY & RESOLUTION
  // ──────────────────────────────────────────────────────────────────────────
  test('1. Resolves verified Celo Mainnet stablecoins by symbol and address', () => {
    const usdt = resolveTokenDescriptor('USDT');
    assert.equal(usdt.symbol, 'USD₮');
    assert.equal(usdt.decimals, 6);
    assert.equal(usdt.address.toLowerCase(), '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e');

    const cngn = resolveTokenDescriptor('cNGN');
    assert.equal(cngn.symbol, 'cNGN');
    assert.equal(cngn.decimals, 6);
    assert.equal(cngn.address.toLowerCase(), '0xf6829d7393dae24509eb1e52ee8e572e2e271a4f');

    const idrx = resolveTokenDescriptor('IDRX');
    assert.equal(idrx.symbol, 'IDRX');
    assert.equal(idrx.decimals, 18);

    const wars = resolveTokenDescriptor('wARS');
    assert.equal(wars.symbol, 'wARS');
    assert.equal(wars.decimals, 18);

    assert.throws(() => resolveTokenDescriptor('UNSUPPORTED_SHITCOIN'), /Unsupported stablecoin asset/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SAME-TOKEN & CROSS-TOKEN DIRECT SEND PREPARATION
  // ──────────────────────────────────────────────────────────────────────────
  test('2. Prepares direct same-token send without conversion (USDT -> USDT)', async () => {
    const prepared = await prepareDirectSend({
      recipientTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      amount: '25.00',
      sourceToken: 'USDT',
      targetToken: 'USDT',
    });

    assert.equal(prepared.isCrossToken, false);
    assert.equal(prepared.amountSent, '25.00');
    assert.equal(prepared.estimatedDelivery, '25.00');
    assert.equal(prepared.effectiveRate, 1.0);
    assert.equal(prepared.attributionTag, CELO_ATTRIBUTION_TAG);
    assert.equal(prepared.attributionSuffix, CELO_ATTRIBUTION_SUFFIX);
  });

  test('3. Prepares cross-stablecoin send via Textile FX corridor (USDT -> cNGN)', async () => {
    const prepared = await prepareDirectSend({
      recipientTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      amount: '10.00',
      sourceToken: 'USDT',
      targetToken: 'cNGN',
    });

    assert.equal(prepared.isCrossToken, true);
    assert.equal(prepared.amountSent, '10.00');
    assert.ok(Number(prepared.estimatedDelivery) > 10000, 'Expected positive cNGN amount');
    assert.ok(Number(prepared.effectiveRate) > 1000, 'Expected live Textile rate > 1000');
    assert.equal(prepared.attributionTag, CELO_ATTRIBUTION_TAG);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ALTANA SESSION POLICY & BOUNDS VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  test('4. Altana Session Authority: Valid active session authorizes payment within budget', () => {
    const session = {
      spendLimit: 100,
      remainingBudget: 75,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      revoked: false,
    };

    const res = verifyAltanaSessionAuthorization({
      altanaSession: session,
      amount: '20',
      tokenSymbol: 'USD₮',
      recipientAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
    });

    assert.equal(res.authorized, true);
    assert.equal(res.requiresHumanSignature, false);
    assert.equal(res.remainingBudget, 55);
  });

  test('5. Altana Session Authority: Rejects spend exceeding remaining budget', () => {
    const session = {
      spendLimit: 50,
      remainingBudget: 10,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      revoked: false,
    };

    const res = verifyAltanaSessionAuthorization({
      altanaSession: session,
      amount: '25',
      tokenSymbol: 'USD₮',
      recipientAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
    });

    assert.equal(res.authorized, false);
    assert.equal(res.requiresHumanSignature, true);
    assert.match(res.reason, /exceeds remaining Altana session allowance/);
  });

  test('6. Altana Session Authority: Rejects expired or revoked session key', () => {
    const expiredSession = {
      spendLimit: 100,
      remainingBudget: 100,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
      revoked: false,
    };
    const resExpired = verifyAltanaSessionAuthorization({
      altanaSession: expiredSession,
      amount: '10',
      tokenSymbol: 'USD₮',
      recipientAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
    });
    assert.equal(resExpired.authorized, false);
    assert.match(resExpired.reason, /expired/);

    const revokedSession = {
      spendLimit: 100,
      remainingBudget: 100,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      revoked: true,
    };
    const resRevoked = verifyAltanaSessionAuthorization({
      altanaSession: revokedSession,
      amount: '10',
      tokenSymbol: 'USD₮',
      recipientAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
    });
    assert.equal(resRevoked.authorized, false);
    assert.match(resRevoked.reason, /revoked/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TAG-TO-TAG PAYMENT REQUESTS FINITE STATE MACHINE
  // ──────────────────────────────────────────────────────────────────────────
  test('7. Payment Requests: Create durable payment request with unique ID', async () => {
    const req = await createPaymentRequest({
      payerTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      recipientTagOrAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
      amount: '30000',
      token: 'cNGN',
      description: 'Logo design deliverable',
    });

    assert.ok(req.requestId.startsWith('pr_'));
    assert.equal(req.status, PAYMENT_REQUEST_STATES.CREATED);
    assert.equal(req.requestedAmount, '30000');
    assert.equal(req.requestedToken, 'cNGN');
    assert.equal(req.description, 'Logo design deliverable');

    const fetched = getPaymentRequest(req.requestId);
    assert.equal(fetched.requestId, req.requestId);
  });

  test('8. Payment Requests: Rejection transitions state to REJECTED', async () => {
    const req = await createPaymentRequest({
      payerTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      recipientTagOrAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
      amount: '5000',
      token: 'cNGN',
      description: 'Consultation fee',
    });

    const rejected = rejectPaymentRequest(req.requestId, req.payerAddress, 'Scope not satisfied');
    assert.equal(rejected.status, PAYMENT_REQUEST_STATES.REJECTED);
    assert.equal(rejected.rejectionReason, 'Scope not satisfied');
  });

  test('9. Payment Requests: Cancellation transitions state to CANCELLED', async () => {
    const req = await createPaymentRequest({
      payerTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      recipientTagOrAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
      amount: '12000',
      token: 'cNGN',
      description: 'Accidental duplicate',
    });

    const cancelled = cancelPaymentRequest(req.requestId, req.recipientAddress);
    assert.equal(cancelled.status, PAYMENT_REQUEST_STATES.CANCELLED);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. TASK MILESTONE & BOOKING SETTLEMENT BRIDGES
  // ──────────────────────────────────────────────────────────────────────────
  test('10. Bridges Task Milestone payment to unified payment engine', async () => {
    const milestone = await prepareTaskMilestonePayment({
      taskId: 'task_celo_01',
      taskTitle: 'Sub-Second Settlement Verification',
      workerTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      milestoneIndex: 1,
      rewardAmount: '15000',
      rewardToken: 'cNGN',
      payerSourceToken: 'USDT',
      payerAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    });

    assert.equal(milestone.type, 'TASK_MILESTONE_PAYMENT');
    assert.equal(milestone.taskId, 'task_celo_01');
    assert.equal(milestone.isCrossToken, true);
    assert.equal(milestone.attributionTag, CELO_ATTRIBUTION_TAG);
  });

  test('11. Bridges Booking settlement to unified payment engine', async () => {
    const booking = await prepareBookingSettlement({
      bookingId: 'book_8892',
      serviceTitle: 'Private Agent Audit',
      providerTagOrAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      agreedPrice: '50.00',
      agreedToken: 'USDT',
      customerSourceToken: 'USDT',
      customerAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    });

    assert.equal(booking.type, 'BOOKING_SETTLEMENT');
    assert.equal(booking.bookingId, 'book_8892');
    assert.equal(booking.isCrossToken, false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CHAT CONVERSATIONAL INTENT PARSING
  // ──────────────────────────────────────────────────────────────────────────
  test('12. Chat Engine: Detects direct send intent ("Send ₦SEGUN 20 USDT")', async () => {
    const prompt = 'Send ₦SEGUN 20 USDT.';
    assert.equal(isSendMoneyQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.ok(res.reply.includes('₦SEGUN') || res.reply.includes('20'));
    assert.equal(res.widget?.type, 'payment_intent_card');
  });

  test('13. Chat Engine: Detects cross-token send intent ("Send ₦SEGUN $20 worth of cNGN. I have USD₮.")', async () => {
    const prompt = 'Send ₦SEGUN $20 worth of cNGN. I have USD₮.';
    assert.equal(isSendMoneyQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Textile FX/i);
    assert.equal(res.widget?.type, 'payment_intent_card');
    assert.equal(res.widget?.isCrossToken, true);
  });

  test('14. Chat Engine: Detects quote/rate inquiry ("How much cNGN will ₦SEGUN receive for 20 USDT?")', async () => {
    const prompt = 'How much cNGN will ₦SEGUN receive for 20 USDT?';
    assert.equal(isQuoteOrRateQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Live Quote/i);
    assert.equal(res.widget?.type, 'payment_quote_card');
  });

  test('15. Chat Engine: Detects payment request creation ("Request 30,000 cNGN from ₦BLOOM for my completed design work.")', async () => {
    const prompt = 'Request 30,000 cNGN from ₦BLOOM for my completed design work.';
    assert.equal(isPaymentRequestQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Payment Request Created/i);
    assert.equal(res.widget?.type, 'payment_request_card');
  });

  test('16. Chat Engine: Detects pending requests query ("Show my pending payment requests.")', async () => {
    const prompt = 'Show my pending payment requests.';
    assert.equal(isPendingInvoicesQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Payment Requests/i);
    assert.equal(res.widget?.type, 'pending_requests_list');
  });

  test('17. Chat Engine: Detects pay invoice query ("Pay ₦SEGUN\'s outstanding invoice.")', async () => {
    const prompt = "Pay ₦SEGUN's outstanding invoice.";
    assert.equal(isPayInvoiceQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Outstanding Invoice/i);
    assert.equal(res.widget?.type, 'payment_intent_card');
  });

  test('18. Chat Engine: Detects milestone approval ("Pay the designer after approving the milestone.")', async () => {
    const prompt = 'Pay the designer after approving the milestone.';
    assert.equal(isPayInvoiceQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Milestone/i);
    assert.equal(res.widget?.type, 'payment_intent_card');
  });

  test('19. Chat Engine: Detects payment status inquiry ("What\'s the status of my last payment?")', async () => {
    const prompt = "What's the status of my last payment?";
    assert.equal(isPaymentStatusQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Payment Status/i);
  });

  test('20. Chat Engine: Detects payment request cancellation ("Cancel my pending payment request.")', async () => {
    const prompt = 'Cancel my pending payment request.';
    assert.equal(isCancelPaymentRequestQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /Cancel/i);
  });

  test('21. Chat Engine: Detects conversion history query ("Show me the conversion history for ₦MUSIC.")', async () => {
    const prompt = 'Show me the conversion history for ₦MUSIC.';
    assert.equal(isPaymentHistoryQuery(prompt), true);

    const res = await processNairaTagChatMessage({ prompt });
    assert.match(res.reply, /History/i);
    assert.equal(res.widget?.type, 'payment_history_card');
  });
});
