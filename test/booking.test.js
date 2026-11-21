import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKING_CATEGORIES,
  PRICING_MODELS,
  BOOKING_MODES,
  AVAILABILITY_MODES,
  validateServiceDefinition,
  registerService,
  updateService,
  deactivateService,
  getService,
  searchServices,
} from '../src/services/bookingRegistryService.js';

import {
  DEFAULT_WORKING_HOURS,
  setProviderAvailability,
  getProviderAvailability,
  getAvailableSlots,
  validateSlotAvailability,
} from '../src/services/availabilityService.js';

import {
  createBookingRequest,
  providerAcceptBooking,
  providerRejectBooking,
  confirmBookingPayment,
  cancelBooking,
  rescheduleBooking,
  getBooking,
  listCustomerBookings,
  listProviderBookings,
  sweepExpiredReservations,
  BOOKING_STATUS,
  RESERVATION_TTL_MS,
} from '../src/services/bookingService.js';

import {
  buildBookingAuthorization,
  evaluateAgentBookingAuthorization,
  executeBookingX402Settlement,
  PAYMENT_STATUS,
} from '../src/services/bookingPaymentService.js';

import {
  STANDARD_BOOKING_CAPABILITY,
  isBookingCapableAgent,
} from '../src/services/agentDiscovery.js';

test('1. Service Registry: Validate and Register Valid Service', () => {
  const service = {
    id: `test_srv_music_${Date.now()}`,
    agentTag: 'music',
    title: 'Custom Beat Production & Mixing',
    description: 'High-end afrobeat and hiphop production stems.',
    category: 'music',
    pricingModel: PRICING_MODELS.FIXED,
    price: '35.00',
    currency: 'USDT',
    durationMinutes: 90,
    bookingMode: BOOKING_MODES.INSTANT,
    availabilityMode: AVAILABILITY_MODES.WORKING_HOURS,
    active: true,
  };

  const registered = registerService(service, { tag: 'music' });
  assert.equal(registered.id, service.id);
  assert.equal(registered.canonicalTag, '₦MUSIC');
  assert.equal(registered.price, '35.00');
  assert.equal(registered.active, true);
});

test('2. Service Registry: Reject Malformed or Invalid Currency / Pricing', () => {
  assert.throws(
    () => {
      validateServiceDefinition({
        id: 'bad_srv_1',
        agentTag: 'dev',
        title: 'Audit',
        category: 'development',
        pricingModel: 'fixed',
        price: '-10.00', // Negative
        currency: 'USDT',
      });
    },
    /Price must be a valid positive numeric string/
  );

  assert.throws(
    () => {
      validateServiceDefinition({
        id: 'bad_srv_2',
        agentTag: 'dev',
        title: 'Audit',
        category: 'non_existent_category', // Invalid category
        pricingModel: 'fixed',
        price: '10.00',
        currency: 'USDT',
      });
    },
    /Invalid category/
  );
});

test('3. Service Registry: Enforce Agent Identity Ownership', () => {
  const serviceId = `test_srv_dev_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'dev',
    title: 'Smart Contract Review',
    description: 'Code review session',
    category: 'development',
    pricingModel: PRICING_MODELS.HOURLY,
    price: '50.00',
    currency: 'USDT',
  }, { tag: 'dev' });

  // Impersonator ₦alice attempts to modify ₦dev service
  assert.throws(
    () => {
      updateService(serviceId, { price: '1.00' }, { tag: 'alice' });
    },
    /Unauthorized: Caller cannot modify service owned by ₦DEV/
  );

  // Legitimate owner ₦dev updates service
  const updated = updateService(serviceId, { price: '60.00' }, { tag: 'dev' });
  assert.equal(updated.price, '60.00');
});

test('4. Availability Service: Slot Generation & Working Hours in UTC', () => {
  const service = {
    id: 'test_srv_avail',
    agentTag: 'bloom',
    durationMinutes: 60,
  };

  // Configure provider working hours
  setProviderAvailability('bloom', {
    timezone: 'Africa/Lagos',
    workingHours: {
      monday: { start: '10:00', end: '13:00' }, // 3 hours = three 60-min slots
    },
    leadTimeHours: 0,
    bufferMinutes: 0,
  });

  // Monday: 2026-11-23
  const slots = getAvailableSlots(service, '2026-11-23', []);
  assert.ok(slots.length >= 3);
  assert.equal(slots[0].timeLabel, '10:00 UTC');
  assert.equal(slots[0].available, true);
});

test('5. Atomic Double-Booking Prevention: Concurrency Conflict Rejection', async () => {
  const serviceId = `test_double_book_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'design',
    title: 'Vector UI Sprint',
    description: 'Rapid UI design',
    category: 'design',
    pricingModel: PRICING_MODELS.FIXED,
    price: '20.00',
    currency: 'USDT',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
  }, { tag: 'design' });

  const slotStart = '2026-11-25T14:00:00.000Z';
  const slotEnd = '2026-11-25T15:00:00.000Z';

  // Customer 1 reserves slot
  const booking1 = await createBookingRequest({
    serviceId,
    customerTag: 'customer_one',
    slotStartTime: slotStart,
    slotEndTime: slotEnd,
  });
  assert.ok(booking1.id);
  assert.equal(booking1.status, BOOKING_STATUS.PENDING_PAYMENT);

  // Customer 2 attempts to reserve the EXACT SAME slot simultaneously
  await assert.rejects(
    async () => {
      await createBookingRequest({
        serviceId,
        customerTag: 'customer_two',
        slotStartTime: slotStart,
        slotEndTime: slotEnd,
      });
    },
    /DOUBLE_BOOKING_PREVENTED|already reserved/
  );
});

test('6. Reservation Auto-Expiry: Releases Locked Slot upon Payment Timeout', async () => {
  const serviceId = `test_expiry_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'video',
    title: 'Color Grading Review',
    description: 'HDR mastering session',
    category: 'video',
    pricingModel: PRICING_MODELS.FIXED,
    price: '40.00',
    currency: 'USDT',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
  }, { tag: 'video' });

  const slotStart = '2026-11-26T10:00:00.000Z';
  const slotEnd = '2026-11-26T11:00:00.000Z';

  const booking = await createBookingRequest({
    serviceId,
    customerTag: 'expiring_customer',
    slotStartTime: slotStart,
    slotEndTime: slotEnd,
  });

  // Manually backdate expiry to simulate TTL passage
  booking.expiresAt = new Date(Date.now() - 1000).toISOString();

  // Sweep should catch and expire it
  const swept = sweepExpiredReservations();
  assert.ok(swept >= 1);

  const refreshed = getBooking(booking.id);
  assert.equal(refreshed.status, BOOKING_STATUS.EXPIRED);

  // The expired slot can now be reserved by another customer without collision!
  const newBooking = await createBookingRequest({
    serviceId,
    customerTag: 'fresh_customer',
    slotStartTime: slotStart,
    slotEndTime: slotEnd,
  });
  assert.ok(newBooking.id);
  assert.equal(newBooking.status, BOOKING_STATUS.PENDING_PAYMENT);
});

test('7. Provider Approval Workflow: Accept & Reject Transitions', async () => {
  const serviceId = `test_approval_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'music',
    title: 'VIP Studio Session',
    description: 'Requires sound engineer review',
    category: 'music',
    pricingModel: PRICING_MODELS.FIXED,
    price: '75.00',
    currency: 'USDT',
    durationMinutes: 120,
    bookingMode: BOOKING_MODES.APPROVAL_REQUIRED,
  }, { tag: 'music' });

  const booking = await createBookingRequest({
    serviceId,
    customerTag: 'artist_dave',
    slotStartTime: '2026-11-27T16:00:00.000Z',
    slotEndTime: '2026-11-27T18:00:00.000Z',
  });

  assert.equal(booking.status, BOOKING_STATUS.PENDING_PROVIDER_APPROVAL);

  // Unauthorized stranger cannot accept
  assert.throws(
    () => {
      providerAcceptBooking(booking.id, { tag: 'stranger' });
    },
    /Unauthorized/
  );

  // Provider ₦music accepts
  const accepted = providerAcceptBooking(booking.id, { tag: 'music' });
  assert.equal(accepted.status, BOOKING_STATUS.PENDING_PAYMENT);
});

test('8. Agent Vault Integration: Rejects Agent Booking Exceeding Altana Budget', async () => {
  const serviceId = `test_altana_limit_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'dev',
    title: 'Dedicated Engineering Sprint',
    description: 'Architecture sprint',
    category: 'development',
    pricingModel: PRICING_MODELS.FIXED,
    price: '150.00', // 150 USDT
    currency: 'USDT',
    durationMinutes: 120,
    bookingMode: BOOKING_MODES.INSTANT,
  }, { tag: 'dev' });

  const booking = await createBookingRequest({
    serviceId,
    customerTag: 'purchasing_agent',
    slotStartTime: '2026-11-28T12:00:00.000Z',
    slotEndTime: '2026-11-28T14:00:00.000Z',
    isAgent: true,
  });

  // Altana session with only 50 USDT allowance
  const altanaSession = {
    spendLimit: 50.0,
    remainingBudget: 50.0,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    revoked: false,
  };

  await assert.rejects(
    async () => {
      await confirmBookingPayment({
        bookingId: booking.id,
        paymentDetails: {},
        altanaSession,
        isSimulation: true,
      });
    },
    /exceeds remaining session allowance/
  );
});

test('9. Self Protocol Gating: Blocks Unverified Agent from Protected Service', async () => {
  const serviceId = `test_self_gate_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'dev',
    title: 'Restricted Enterprise Key Custody Session',
    description: 'Requires Zero-Knowledge verified human passport backing',
    category: 'development',
    pricingModel: PRICING_MODELS.FIXED,
    price: '20.00',
    currency: 'USDT',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
    requiresSelfVerification: true, // Strictly gated
  }, { tag: 'dev' });

  const booking = await createBookingRequest({
    serviceId,
    customerTag: 'unverified_bot',
    slotStartTime: '2026-11-29T09:00:00.000Z',
    slotEndTime: '2026-11-29T10:00:00.000Z',
    isAgent: true,
  });

  const altanaSession = {
    spendLimit: 100.0,
    remainingBudget: 100.0,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    revoked: false,
  };

  // Attempting autonomous payment without humanSelfProof
  await assert.rejects(
    async () => {
      await confirmBookingPayment({
        bookingId: booking.id,
        paymentDetails: {},
        altanaSession,
        humanSelfProof: null, // Missing proof
        isSimulation: true,
      });
    },
    /HUMAN_VERIFICATION_REQUIRED/
  );
});

test('10. End-to-End Successful Booking: Altana + Self + x402 Settlement', async () => {
  const serviceId = `test_e2e_${Date.now()}`;
  registerService({
    id: serviceId,
    agentTag: 'nairatag',
    title: 'Cloud AI Inference Slot',
    description: 'Dedicated GPU hour',
    category: 'ai_compute',
    pricingModel: PRICING_MODELS.FIXED,
    price: '2.50',
    currency: 'USDT',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
    requiresSelfVerification: false,
  }, { tag: 'nairatag' });

  const booking = await createBookingRequest({
    serviceId,
    customerTag: 'buyer_agent',
    slotStartTime: '2026-11-30T15:00:00.000Z',
    slotEndTime: '2026-11-30T16:00:00.000Z',
    isAgent: true,
  });

  const altanaSession = {
    spendLimit: 10.0,
    remainingBudget: 10.0,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    revoked: false,
  };

  const confirmed = await confirmBookingPayment({
    bookingId: booking.id,
    paymentDetails: {},
    altanaSession,
    isSimulation: true,
  });

  assert.equal(confirmed.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(confirmed.paymentStatus, PAYMENT_STATUS.SETTLED);
  assert.ok(confirmed.paymentTxHash.startsWith('0xcelo_book_'));
  assert.ok(confirmed.settledAt);
});

test('11. Standard Booking Capability Check for Autonomous Agents', () => {
  assert.equal(STANDARD_BOOKING_CAPABILITY.name, 'booking');
  assert.ok(STANDARD_BOOKING_CAPABILITY.supports.includes('service_discovery'));
  assert.ok(STANDARD_BOOKING_CAPABILITY.supports.includes('availability'));

  const sampleAgent = {
    tag: 'music',
    status: 'active',
    capabilities: [STANDARD_BOOKING_CAPABILITY],
  };

  assert.equal(isBookingCapableAgent(sampleAgent), true);
  assert.equal(isBookingCapableAgent({ tag: 'offline', status: 'offline' }), false);
});
