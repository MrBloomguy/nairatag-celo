/**
 * @file bookingNotificationService.js
 * @description Dual-party notification and audit event dispatcher for NairaTag Booking Engine.
 */

export const BOOKING_NOTIFICATION_EVENTS = {
  BOOKING_REQUESTED: 'booking_requested',
  BOOKING_ACCEPTED: 'booking_accepted',
  BOOKING_REJECTED: 'booking_rejected',
  PAYMENT_REQUIRED: 'payment_required',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_RESCHEDULED: 'booking_rescheduled',
  BOOKING_COMPLETED: 'booking_completed',
};

// In-memory event audit log
const bookingEventLog = [];

/**
 * Dispatches an event to customer and provider audit logs.
 */
export function dispatchBookingNotification({
  event,
  booking,
  recipientTag,
  recipientAddress,
  metadata = {},
}) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event,
    bookingId: booking?.id,
    serviceTitle: booking?.serviceTitle,
    recipientTag: recipientTag ? String(recipientTag).toLowerCase().replace(/^[₦$@#]/, '') : null,
    recipientAddress: recipientAddress || null,
    metadata,
    timestamp,
    read: false,
  };

  bookingEventLog.unshift(entry);

  // If in browser environment, dispatch custom DOM event for live UI reactivity
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(new CustomEvent('nairatag:booking-event', { detail: entry }));
    } catch {
      // Ignored in non-browser testing
    }
  }

  return entry;
}

/**
 * Gets notification history for a user or agent.
 */
export function getBookingNotifications(identityTagOrAddress) {
  if (!identityTagOrAddress) return [];
  const query = String(identityTagOrAddress).toLowerCase().replace(/^[₦$@#]/, '');
  return bookingEventLog.filter(
    (e) => e.recipientTag === query || e.recipientAddress?.toLowerCase() === query
  );
}

/**
 * Retrieves the full immutable audit trail for a booking.
 */
export function getBookingAuditTrail(bookingId) {
  return bookingEventLog.filter((e) => e.bookingId === bookingId);
}
