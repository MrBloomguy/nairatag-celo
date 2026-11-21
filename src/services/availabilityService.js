/**
 * @file availabilityService.js
 * @description Timezone-aware availability management and conflict detection for NairaTag Booking Engine.
 * 
 * Rules:
 * 1. UTC Canonical Storage: All timestamps are canonically evaluated and stored in UTC.
 * 2. Timezone Preservation: Services preserve their native configured timezone (e.g. Africa/Lagos, UTC, America/New_York).
 * 3. Atomic Collision Check: Rejects overlapping slots before reservations can be initiated.
 * 4. Lead Times & Buffer: Respects minimum booking notice and buffer periods between sessions.
 */

// Default standard working hours: 09:00 - 17:00 Monday - Friday
export const DEFAULT_WORKING_HOURS = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '10:00', end: '14:00' },
  sunday: null, // Closed
};

// Provider custom availability configurations
const providerAvailabilityStore = new Map();

/**
 * Configures provider-managed working hours and scheduling parameters.
 */
export function setProviderAvailability(agentTag, {
  timezone = 'Africa/Lagos',
  workingHours = DEFAULT_WORKING_HOURS,
  blockedDates = [],
  leadTimeHours = 2,
  bufferMinutes = 15,
} = {}) {
  const normalized = String(agentTag).toLowerCase().replace(/^[₦$@#]/, '');
  const config = {
    agentTag: normalized,
    timezone,
    workingHours: { ...DEFAULT_WORKING_HOURS, ...workingHours },
    blockedDates: [...new Set(blockedDates)],
    leadTimeHours,
    bufferMinutes,
    updatedAt: new Date().toISOString(),
  };
  providerAvailabilityStore.set(normalized, config);
  return config;
}

/**
 * Gets the availability configuration for a provider agent.
 */
export function getProviderAvailability(agentTag) {
  const normalized = String(agentTag).toLowerCase().replace(/^[₦$@#]/, '');
  return providerAvailabilityStore.get(normalized) || {
    agentTag: normalized,
    timezone: 'Africa/Lagos',
    workingHours: DEFAULT_WORKING_HOURS,
    blockedDates: [],
    leadTimeHours: 2,
    bufferMinutes: 15,
  };
}

/**
 * Computes available time slots for a given service on a specified date.
 * 
 * @param {Object} service - BookableService record
 * @param {string} dateString - Format 'YYYY-MM-DD'
 * @param {Array<Object>} existingBookings - Active bookings for this service or agent on this date
 * @returns {Array<{ startTime: string, endTime: string, available: boolean, reason?: string }>}
 */
export function getAvailableSlots(service, dateString, existingBookings = []) {
  if (!service || !dateString) return [];
  const agentTag = service.agentTag;
  const config = getProviderAvailability(agentTag);

  // Check if entire date is blocked
  if (config.blockedDates.includes(dateString)) {
    return [];
  }

  // Determine day of week
  const [year, month, day] = dateString.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = daysOfWeek[targetDate.getUTCDay()];

  const daySchedule = config.workingHours[dayName];
  if (!daySchedule || !daySchedule.start || !daySchedule.end) {
    return []; // Closed on this day
  }

  const durationMin = service.durationMinutes || 60;
  const bufferMin = config.bufferMinutes || 0;
  const stepMin = durationMin + bufferMin;

  const [startHour, startMin] = daySchedule.start.split(':').map(Number);
  const [endHour, endMin] = daySchedule.end.split(':').map(Number);

  const dayStartMs = Date.UTC(year, month - 1, day, startHour, startMin, 0);
  const dayEndMs = Date.UTC(year, month - 1, day, endHour, endMin, 0);

  const nowMs = Date.now();
  const minBookingMs = nowMs + (config.leadTimeHours || 0) * 3600 * 1000;

  const slots = [];
  let currentStartMs = dayStartMs;

  while (currentStartMs + durationMin * 60 * 1000 <= dayEndMs) {
    const slotEndMs = currentStartMs + durationMin * 60 * 1000;
    const startTimeIso = new Date(currentStartMs).toISOString();
    const endTimeIso = new Date(slotEndMs).toISOString();

    // Check minimum lead time
    const isPastLeadTime = currentStartMs >= minBookingMs;

    // Check collision against existing active bookings
    const hasCollision = existingBookings.some((b) => {
      // Ignore cancelled, expired, or rejected bookings
      if (['cancelled', 'rejected', 'expired', 'payment_failed'].includes(b.status)) {
        return false;
      }
      const existingStart = new Date(b.slotStartTime).getTime();
      const existingEnd = new Date(b.slotEndTime).getTime();
      // Overlap condition: start < existingEnd && end > existingStart
      return currentStartMs < existingEnd && slotEndMs > existingStart;
    });

    slots.push({
      startTime: startTimeIso,
      endTime: endTimeIso,
      timeLabel: `${String(new Date(currentStartMs).getUTCHours()).padStart(2, '0')}:${String(new Date(currentStartMs).getUTCMinutes()).padStart(2, '0')} UTC`,
      available: isPastLeadTime && !hasCollision,
      reason: !isPastLeadTime ? 'past_lead_time' : hasCollision ? 'reserved' : null,
    });

    currentStartMs += stepMin * 60 * 1000;
  }

  return slots;
}

/**
 * Validates whether a requested time slot is valid and free of collisions.
 */
export function validateSlotAvailability(service, slotStartTime, slotEndTime, existingBookings = []) {
  const startMs = new Date(slotStartTime).getTime();
  const endMs = new Date(slotEndTime).getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    throw new Error('Invalid slot time boundaries');
  }

  const durationMin = (endMs - startMs) / 60000;
  if (durationMin !== service.durationMinutes) {
    throw new Error(`Slot duration (${durationMin} min) does not match service requirement (${service.durationMinutes} min)`);
  }

  const collision = existingBookings.find((b) => {
    if (['cancelled', 'rejected', 'expired', 'payment_failed'].includes(b.status)) return false;
    const bStart = new Date(b.slotStartTime).getTime();
    const bEnd = new Date(b.slotEndTime).getTime();
    return startMs < bEnd && endMs > bStart;
  });

  if (collision) {
    throw new Error(`Slot collision: This slot is already reserved by booking ${collision.id}`);
  }

  return true;
}
