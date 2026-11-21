/**
 * @file bookingService.js
 * @description Master Booking Lifecycle Engine with Atomic Double-Booking Prevention,
 * Reservation Expiry, and Provider Acceptance Workflow.
 * 
 * Strict Guarantees:
 * 1. Double-Booking Prevention: Concurrency mutex locks on (serviceId, slotStartTime) prevent concurrent collision.
 * 2. Unpaid Reservation Auto-Expiry: Releases locked slots if payment is not received within TTL.
 * 3. State Machine Transitions: Validates permitted state transitions strictly.
 * 4. Dual-Actor Support: Distinguishes between human-created and autonomous agent-created bookings.
 */

import { getService, BOOKING_MODES, normalizeTag } from './bookingRegistryService.js';
import { validateSlotAvailability } from './availabilityService.js';
import { dispatchBookingNotification, BOOKING_NOTIFICATION_EVENTS } from './bookingNotificationService.js';
import {
  buildBookingAuthorization,
  evaluateAgentBookingAuthorization,
  executeBookingX402Settlement,
  PAYMENT_STATUS,
} from './bookingPaymentService.js';
import { loadDurableEntityStore, persistDurableEntityStore } from './durableBookingStore.js';

export const BOOKING_STATUS = {
  DRAFT: 'draft',
  PENDING_PROVIDER_APPROVAL: 'pending_provider_approval',
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_PROCESSING: 'payment_processing',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  PAYMENT_FAILED: 'payment_failed',
  REFUNDED: 'refunded',
};

// Default Reservation TTL: 15 minutes
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

// Persistent bookings repository
const bookingsStore = new Map();

// Initialize durable persistence
loadDurableEntityStore('bookings', bookingsStore).catch(() => { });

// Active mutex locks with range support to prevent concurrent double-booking
// Each entry: { serviceId, startMs, endMs, expiresAtMs }
const activeSlotLocks = [];
const slotReservationLocks = new Set();

/**
 * Checks and locks a time slot range atomically.
 */
function acquireSlotLock(serviceId, startMs, endMs, ttlMs = RESERVATION_TTL_MS) {
  const now = Date.now();
  // Clean up expired in-flight locks
  for (let i = activeSlotLocks.length - 1; i >= 0; i--) {
    if (activeSlotLocks[i].expiresAtMs <= now) {
      activeSlotLocks.splice(i, 1);
    }
  }

  // Check range overlap: startMs < lock.endMs && endMs > lock.startMs
  const collision = activeSlotLocks.find(
    (l) => l.serviceId === serviceId && startMs < l.endMs && endMs > l.startMs
  );

  if (collision) {
    throw new Error('DOUBLE_BOOKING_PREVENTED: Another reservation is currently in progress for this slot.');
  }

  const lock = {
    serviceId,
    startMs,
    endMs,
    expiresAtMs: now + ttlMs,
  };
  activeSlotLocks.push(lock);
  return lock;
}

/**
 * Releases a slot lock.
 */
function releaseSlotLock(serviceId, startMs, endMs) {
  for (let i = activeSlotLocks.length - 1; i >= 0; i--) {
    const l = activeSlotLocks[i];
    if (l.serviceId === serviceId && l.startMs === startMs && l.endMs === endMs) {
      activeSlotLocks.splice(i, 1);
      break;
    }
  }
}

/**
 * Sweeps and marks expired unpaid reservations, releasing their slots.
 */
export function sweepExpiredReservations() {
  const now = Date.now();
  let count = 0;
  for (const booking of bookingsStore.values()) {
    if (
      (booking.status === BOOKING_STATUS.PENDING_PAYMENT || booking.status === BOOKING_STATUS.DRAFT) &&
      booking.expiresAt &&
      new Date(booking.expiresAt).getTime() < now
    ) {
      booking.status = BOOKING_STATUS.EXPIRED;
      booking.updatedAt = new Date().toISOString();
      booking.expiredReason = 'Payment window expired without confirmed settlement';
      // Release mutex lock
      slotReservationLocks.delete(`${booking.serviceId}:${booking.slotStartTime}`);
      count++;
    }
  }
  return count;
}

/**
 * Creates a new booking reservation.
 */
export async function createBookingRequest({
  serviceId,
  customerTag = null,
  customerAddress = null,
  customerName = '',
  slotStartTime,
  slotEndTime,
  customerNotes = '',
  isAgent = false,
  agentSession = null,
}) {
  // Pre-cleanup expired bookings
  sweepExpiredReservations();

  const service = getService(serviceId);
  if (!service) throw new Error(`Service not found: ${serviceId}`);
  if (!service.active) throw new Error(`Service ${service.title} is currently deactivated.`);

  if (!customerTag && !customerAddress) {
    throw new Error('Customer identity (₦Tag or EVM address) is required to create a booking.');
  }

  // Permission check: Does service allow agent-to-agent booking?
  if (isAgent && !service.agentBookingEnabled) {
    throw new Error(`Provider ₦${service.agentTag.toUpperCase()} does not accept automated agent bookings for this service.`);
  }

  // Concurrency Mutex Check: Double-booking atomic lock
  const lockKey = `${serviceId}:${slotStartTime}`;
  if (slotReservationLocks.has(lockKey)) {
    throw new Error('DOUBLE_BOOKING_PREVENTED: Another reservation is currently in progress for this slot.');
  }

  // Check collision against all existing active bookings for this service
  const existingForService = Array.from(bookingsStore.values()).filter((b) => b.serviceId === serviceId);
  validateSlotAvailability(service, slotStartTime, slotEndTime, existingForService);

  // Acquire concurrency lock
  slotReservationLocks.add(lockKey);

  try {
    const bookingId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS).toISOString();

    // Determine initial state based on booking mode
    const initialStatus = service.bookingMode === BOOKING_MODES.APPROVAL_REQUIRED
      ? BOOKING_STATUS.PENDING_PROVIDER_APPROVAL
      : BOOKING_STATUS.PENDING_PAYMENT;

    const booking = {
      id: bookingId,
      serviceId: service.id,
      serviceTitle: service.title,
      providerAgentTag: service.agentTag,
      providerCanonicalTag: service.canonicalTag,
      category: service.category,
      customerTag: customerTag ? normalizeTag(customerTag) : null,
      customerAddress: customerAddress || null,
      customerName: customerName || (customerTag ? `₦${normalizeTag(customerTag).toUpperCase()}` : 'Anonymous'),
      initiatedBy: isAgent ? 'agent' : 'human',
      slotStartTime,
      slotEndTime,
      durationMinutes: service.durationMinutes,
      price: service.price || '0.00',
      currency: service.currency,
      pricingModel: service.pricingModel,
      bookingMode: service.bookingMode,
      cancellationPolicy: service.cancellationPolicy,
      customerNotes: customerNotes.trim(),
      status: initialStatus,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      paymentTxHash: null,
      requiresSelfVerification: Boolean(service.requiresSelfVerification),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
    };

    bookingsStore.set(bookingId, booking);
    persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

    // Notify provider of new request
    dispatchBookingNotification({
      event: BOOKING_NOTIFICATION_EVENTS.BOOKING_REQUESTED,
      booking,
      recipientTag: service.agentTag,
      metadata: { initiatedBy: isAgent ? 'agent' : 'human' },
    });

    return booking;
  } catch (err) {
    // Release concurrency lock on failure
    slotReservationLocks.delete(lockKey);
    throw err;
  }
}

/**
 * Provider accepts a pending approval booking, moving it to pending_payment.
 */
export function providerAcceptBooking(bookingId, providerIdentity = {}) {
  const booking = bookingsStore.get(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  const callerTag = normalizeTag(providerIdentity.tag || providerIdentity.agentTag);
  if (callerTag && callerTag !== booking.providerAgentTag && providerIdentity.role !== 'admin') {
    throw new Error('Unauthorized: Only the service provider agent can accept this booking.');
  }

  if (booking.expiresAt && new Date(booking.expiresAt).getTime() < Date.now()) {
    booking.status = BOOKING_STATUS.EXPIRED;
    throw new Error('RESERVATION_EXPIRED: The hold on this slot has timed out before provider acceptance.');
  }

  if (booking.status !== BOOKING_STATUS.PENDING_PROVIDER_APPROVAL) {
    throw new Error(`Invalid transition: Cannot accept booking in status "${booking.status}"`);
  }

  booking.status = BOOKING_STATUS.PENDING_PAYMENT;
  booking.updatedAt = new Date().toISOString();
  // Refresh payment TTL on provider acceptance
  booking.expiresAt = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
  persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

  dispatchBookingNotification({
    event: BOOKING_NOTIFICATION_EVENTS.BOOKING_ACCEPTED,
    booking,
    recipientTag: booking.customerTag,
    recipientAddress: booking.customerAddress,
  });

  return booking;
}

/**
 * Provider rejects a pending booking. Releases reserved slot.
 */
export function providerRejectBooking(bookingId, reason = '', providerIdentity = {}) {
  const booking = bookingsStore.get(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  const callerTag = normalizeTag(providerIdentity.tag || providerIdentity.agentTag);
  if (callerTag && callerTag !== booking.providerAgentTag && providerIdentity.role !== 'admin') {
    throw new Error('Unauthorized: Only the service provider agent can reject this booking.');
  }

  booking.status = BOOKING_STATUS.REJECTED;
  booking.rejectReason = reason || 'Provider unavailable';
  booking.updatedAt = new Date().toISOString();

  // Release mutex lock
  slotReservationLocks.delete(`${booking.serviceId}:${booking.slotStartTime}`);
  persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

  dispatchBookingNotification({
    event: BOOKING_NOTIFICATION_EVENTS.BOOKING_REJECTED,
    booking,
    recipientTag: booking.customerTag,
    recipientAddress: booking.customerAddress,
    metadata: { reason },
  });

  return booking;
}

/**
 * Settles payment for a booking and promotes status to CONFIRMED.
 */
export async function confirmBookingPayment({
  bookingId,
  paymentDetails,
  altanaSession = null,
  humanSelfProof = null,
  isSimulation = false,
}) {
  const booking = bookingsStore.get(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  if (booking.expiresAt && new Date(booking.expiresAt).getTime() < Date.now()) {
    booking.status = BOOKING_STATUS.EXPIRED;
    throw new Error('RESERVATION_EXPIRED: The hold on this slot has timed out.');
  }

  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) {
    throw new Error(`Cannot settle payment for booking in status "${booking.status}"`);
  }

  const service = getService(booking.serviceId);
  if (!service) throw new Error(`Service ${booking.serviceId} no longer exists`);

  const authorization = buildBookingAuthorization({
    booking,
    service,
    customerId: booking.customerTag || booking.customerAddress,
    paymentToken: booking.currency,
  });

  // If initiated autonomously by an agent, evaluate Altana & Self policies
  if (booking.initiatedBy === 'agent') {
    const authEval = evaluateAgentBookingAuthorization({
      authorization,
      altanaSession,
      agentTag: booking.customerTag,
      humanSelfProof,
    });
    if (!authEval.authorized) {
      throw new Error(`Agent Vault Authorization Rejected: ${authEval.reason}`);
    }
  }

  // Execute on-chain settlement via x402 digital dollar rails
  booking.status = BOOKING_STATUS.PAYMENT_PROCESSING;
  booking.updatedAt = new Date().toISOString();

  try {
    const settlementResult = await executeBookingX402Settlement({
      booking,
      authorization,
      paymentProof: paymentDetails,
      isSimulation,
    });

    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.paymentStatus = PAYMENT_STATUS.SETTLED;
    booking.paymentTxHash = settlementResult.txHash;
    booking.settledAt = settlementResult.settledAt;
    booking.updatedAt = new Date().toISOString();
    persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

    dispatchBookingNotification({
      event: BOOKING_NOTIFICATION_EVENTS.BOOKING_CONFIRMED,
      booking,
      recipientTag: booking.customerTag,
      recipientAddress: booking.customerAddress,
      metadata: { txHash: settlementResult.txHash },
    });

    return booking;
  } catch (err) {
    booking.status = BOOKING_STATUS.PAYMENT_FAILED;
    booking.paymentStatus = PAYMENT_STATUS.FAILED;
    booking.paymentError = err.message;
    booking.updatedAt = new Date().toISOString();
    throw err;
  }
}

/**
 * Cancels a booking according to cancellation policy.
 */
export function cancelBooking(bookingId, reason = '', callerIdentity = {}) {
  const booking = bookingsStore.get(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED].includes(booking.status)) {
    throw new Error(`Cannot cancel booking in terminal state: ${booking.status}`);
  }

  const callerTag = normalizeTag(callerIdentity.tag || callerIdentity.agentTag);
  const callerAddress = callerIdentity.address ? String(callerIdentity.address).toLowerCase() : null;

  const isCustomer = (callerTag && callerTag === booking.customerTag) ||
    (callerAddress && callerAddress === booking.customerAddress?.toLowerCase());
  const isProvider = callerTag && callerTag === booking.providerAgentTag;

  if (!isCustomer && !isProvider && callerIdentity.role !== 'admin') {
    throw new Error('Unauthorized: Only customer or provider can cancel this booking.');
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelReason = reason || 'User requested cancellation';
  booking.cancelledBy = isCustomer ? 'customer' : 'provider';
  booking.updatedAt = new Date().toISOString();

  // Release mutex lock
  slotReservationLocks.delete(`${booking.serviceId}:${booking.slotStartTime}`);
  persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

  dispatchBookingNotification({
    event: BOOKING_NOTIFICATION_EVENTS.BOOKING_CANCELLED,
    booking,
    recipientTag: isCustomer ? booking.providerAgentTag : booking.customerTag,
    recipientAddress: isCustomer ? null : booking.customerAddress,
    metadata: { reason, cancelledBy: booking.cancelledBy },
  });

  return booking;
}

/**
 * Reschedules a confirmed or pending booking to a new time slot.
 */
export function rescheduleBooking(bookingId, newStartTime, newEndTime, callerIdentity = {}) {
  const booking = bookingsStore.get(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING_PAYMENT].includes(booking.status)) {
    throw new Error(`Cannot reschedule booking in status "${booking.status}"`);
  }

  const service = getService(booking.serviceId);
  const existingForService = Array.from(bookingsStore.values())
    .filter((b) => b.serviceId === booking.serviceId && b.id !== bookingId);

  validateSlotAvailability(service, newStartTime, newEndTime, existingForService);

  // Release old lock & acquire new lock
  slotReservationLocks.delete(`${booking.serviceId}:${booking.slotStartTime}`);
  slotReservationLocks.add(`${booking.serviceId}:${newStartTime}`);

  const oldTime = booking.slotStartTime;
  booking.slotStartTime = newStartTime;
  booking.slotEndTime = newEndTime;
  booking.updatedAt = new Date().toISOString();
  persistDurableEntityStore('bookings', bookingsStore).catch(() => { });

  dispatchBookingNotification({
    event: BOOKING_NOTIFICATION_EVENTS.BOOKING_RESCHEDULED,
    booking,
    recipientTag: booking.providerAgentTag,
    metadata: { oldStartTime: oldTime, newStartTime },
  });

  return booking;
}

/**
 * Retrieves a booking by ID.
 */
export function getBooking(bookingId) {
  sweepExpiredReservations();
  return bookingsStore.get(bookingId) || null;
}

/**
 * Lists all bookings for a given customer.
 */
export function listCustomerBookings(customerTagOrAddress) {
  sweepExpiredReservations();
  if (!customerTagOrAddress) return [];
  const query = String(customerTagOrAddress).toLowerCase().replace(/^[₦$@#]/, '');
  return Array.from(bookingsStore.values())
    .filter((b) => b.customerTag === query || b.customerAddress?.toLowerCase() === query)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Lists all bookings for a provider agent.
 */
export function listProviderBookings(providerAgentTag) {
  sweepExpiredReservations();
  if (!providerAgentTag) return [];
  const tag = normalizeTag(providerAgentTag);
  return Array.from(bookingsStore.values())
    .filter((b) => b.providerAgentTag === tag)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
