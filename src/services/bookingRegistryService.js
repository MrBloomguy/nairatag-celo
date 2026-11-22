/**
 * @file bookingRegistryService.js
 * @description Standardized Service Registry for the NairaTag Booking Engine.
 * 
 * Capabilities:
 * - Common BookableService schema validation.
 * - Dynamic service registration, updates, and deactivation.
 * - Agent ownership & authorization enforcement.
 * - Configurable category directory.
 * - Seed catalog of verified initial services for sovereign Celo agents.
 */

export const BOOKING_CATEGORIES = [
  { id: 'music', label: 'Music Production', icon: 'Headphones', desc: 'Mixing, mastering, beats & session engineering' },
  { id: 'video', label: 'Video Production', icon: 'Video', desc: 'Editing, color grading, motion graphics & shoots' },
  { id: 'design', label: 'Design', icon: 'Palette', desc: 'Brand identity, UI/UX, 3D assets & vector art' },
  { id: 'development', label: 'Development', icon: 'Code', desc: 'Full-stack engineering, smart contracts & integrations' },
  { id: 'transportation', label: 'Transportation', icon: 'Car', desc: 'Logistics, dispatch & local transport routes' },
  { id: 'travel', label: 'Travel', icon: 'Plane', desc: 'Itineraries, booking coordination & concierge' },
  { id: 'consultations', label: 'Consultations', icon: 'Users', desc: 'Technical, advisory & strategy sessions' },
  { id: 'ai_compute', label: 'AI & Compute', icon: 'Cpu', desc: 'Dedicated inference slots, GPU hours & batch jobs' },
  { id: 'business', label: 'Business Services', icon: 'Briefcase', desc: 'Accounting, operations & legal research' },
  { id: 'other', label: 'Other Services', icon: 'Sparkles', desc: 'Bespoke agent tasks & specialized services' },
];

export const PRICING_MODELS = {
  FIXED: 'fixed',
  HOURLY: 'hourly',
  PER_SESSION: 'per_session',
  QUOTE: 'quote',
};

export const BOOKING_MODES = {
  INSTANT: 'instant',
  APPROVAL_REQUIRED: 'approval_required',
  REQUEST_QUOTE: 'request_quote',
};

export const AVAILABILITY_MODES = {
  WORKING_HOURS: 'working_hours',
  FIXED_SLOTS: 'fixed_slots',
  MANUAL: 'manual',
};

import { loadDurableEntityStore, persistDurableEntityStore } from './durableBookingStore.js';

// In-memory persistent registry store
const servicesStore = new Map();

export const MOCK_SERVICE_IDS = [
  'srv_nairatag_orchestration_01',
  'srv_music_mix_01',
  'srv_video_edit_01',
  'srv_design_brand_01',
  'srv_dev_consult_01',
  'srv_ride_dispatch_01',
  'srv_travel_concierge_01',
  'srv_compute_cluster_01',
];

/**
 * Purges any legacy mock/seed services from memory and durable storage.
 */
export function purgeMockServices() {
  let changed = false;
  for (const id of MOCK_SERVICE_IDS) {
    if (servicesStore.has(id)) {
      servicesStore.delete(id);
      changed = true;
    }
  }
  if (changed) {
    persistDurableEntityStore('services', servicesStore).catch(() => {});
  }
}

// Initialize durable persistence
loadDurableEntityStore('services', servicesStore)
  .then(() => {
    purgeMockServices();
  })
  .catch(() => {});

/**
 * Validates a BookableService definition.
 * Money amounts must be exact strings (integer or exact decimal), never loose floats.
 */
export function validateServiceDefinition(service) {
  if (!service || typeof service !== 'object') throw new Error('Service definition is required');
  if (!service.id || typeof service.id !== 'string') throw new Error('Service id is required');
  if (!service.agentTag || typeof service.agentTag !== 'string') throw new Error('Agent tag is required');
  if (!service.title || service.title.trim().length < 3) throw new Error('Service title must be at least 3 characters');
  if (!service.category || !BOOKING_CATEGORIES.some((c) => c.id === service.category)) {
    throw new Error(`Invalid category: ${service.category}. Must be one of configured categories.`);
  }
  if (!Object.values(PRICING_MODELS).includes(service.pricingModel)) {
    throw new Error(`Invalid pricing model: ${service.pricingModel}`);
  }
  if (service.pricingModel !== PRICING_MODELS.QUOTE) {
    if (!service.price || typeof service.price !== 'string' || isNaN(Number(service.price)) || Number(service.price) <= 0) {
      throw new Error('Price must be a valid positive numeric string (e.g. "25.00")');
    }
  }
  if (!['USDT', 'cNGN', 'CELO'].includes(service.currency)) {
    throw new Error('Currency must be USDT, cNGN, or CELO on Celo Mainnet');
  }
  if (service.durationMinutes && (typeof service.durationMinutes !== 'number' || service.durationMinutes <= 0)) {
    throw new Error('Duration must be a positive integer in minutes');
  }
  return true;
}

/**
 * Normalizes an agent tag (removes leading ₦, @, $, lowercases).
 */
export function normalizeTag(tag) {
  return String(tag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
}

/**
 * Registers a new bookable service. Enforces agent identity ownership.
 */
export function registerService(serviceData, callerIdentity = {}) {
  validateServiceDefinition(serviceData);
  const normalizedAgentTag = normalizeTag(serviceData.agentTag);
  const callerTag = normalizeTag(callerIdentity.tag || callerIdentity.agentTag || callerIdentity.address);

  // If caller identity is supplied, verify caller owns this agent tag
  if (callerTag && callerTag !== normalizedAgentTag && callerIdentity.role !== 'admin') {
    throw new Error(`Unauthorized: Agent ₦${callerTag.toUpperCase()} cannot register services for ₦${normalizedAgentTag.toUpperCase()}`);
  }

  // Self Agent ID Verification Gate
  if (callerIdentity && callerIdentity.selfVerified === false) {
    throw new Error(`Self Agent ID Verification Required: Agent ₦${normalizedAgentTag.toUpperCase()} cannot publish bookable services until its human owner completes Self proof-of-human verification.`);
  }

  const existing = servicesStore.get(serviceData.id);
  if (existing && normalizeTag(existing.agentTag) !== normalizedAgentTag) {
    throw new Error(`Service ID collision: ${serviceData.id} is already registered to ₦${existing.agentTag.toUpperCase()}`);
  }

  const now = new Date().toISOString();
  const record = {
    ...serviceData,
    agentTag: normalizedAgentTag,
    canonicalTag: `₦${normalizedAgentTag.toUpperCase()}`,
    pricingModel: serviceData.pricingModel || PRICING_MODELS.FIXED,
    currency: serviceData.currency || 'USDT',
    bookingMode: serviceData.bookingMode || BOOKING_MODES.INSTANT,
    availabilityMode: serviceData.availabilityMode || AVAILABILITY_MODES.WORKING_HOURS,
    durationMinutes: serviceData.durationMinutes || 60,
    advancePaymentRequired: serviceData.advancePaymentRequired ?? true,
    humanBookingEnabled: serviceData.humanBookingEnabled ?? true,
    agentBookingEnabled: serviceData.agentBookingEnabled ?? true,
    requiresSelfVerification: Boolean(serviceData.requiresSelfVerification),
    cancellationPolicy: serviceData.cancellationPolicy || 'Free cancellation up to 24 hours before session.',
    active: serviceData.active ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  servicesStore.set(record.id, record);
  persistDurableEntityStore('services', servicesStore).catch(() => {});
  return record;
}

/**
 * Updates an existing bookable service with authorization check.
 */
export function updateService(serviceId, patch, callerIdentity = {}) {
  const existing = servicesStore.get(serviceId);
  if (!existing) throw new Error(`Service not found: ${serviceId}`);

  const callerTag = normalizeTag(callerIdentity.tag || callerIdentity.agentTag || callerIdentity.address);
  if (callerTag && callerTag !== existing.agentTag && callerIdentity.role !== 'admin') {
    throw new Error(`Unauthorized: Caller cannot modify service owned by ₦${existing.agentTag.toUpperCase()}`);
  }

  const updated = {
    ...existing,
    ...patch,
    id: existing.id, // Immutable ID
    agentTag: existing.agentTag, // Immutable Owner
    canonicalTag: existing.canonicalTag,
    updatedAt: new Date().toISOString(),
  };

  validateServiceDefinition(updated);
  servicesStore.set(serviceId, updated);
  persistDurableEntityStore('services', servicesStore).catch(() => {});
  return updated;
}

/**
 * Deactivates a service (soft delete).
 */
export function deactivateService(serviceId, callerIdentity = {}) {
  return updateService(serviceId, { active: false }, callerIdentity);
}

/**
 * Retrieves a single service by ID.
 */
export function getService(serviceId) {
  return servicesStore.get(serviceId) || null;
}

/**
 * Searches and filters services across the marketplace.
 */
export function searchServices({
  query = '',
  category = null,
  agentTag = null,
  activeOnly = true,
  pricingModel = null,
  requiresSelf = null,
  limit = 50,
} = {}) {
  const results = [];
  const normalizedQuery = query.trim().toLowerCase();
  const targetTag = agentTag ? normalizeTag(agentTag) : null;

  for (const service of servicesStore.values()) {
    if (activeOnly && !service.active) continue;
    if (category && service.category !== category) continue;
    if (targetTag && service.agentTag !== targetTag) continue;
    if (pricingModel && service.pricingModel !== pricingModel) continue;
    if (requiresSelf !== null && service.requiresSelfVerification !== requiresSelf) continue;

    if (normalizedQuery) {
      const match =
        service.title.toLowerCase().includes(normalizedQuery) ||
        service.description.toLowerCase().includes(normalizedQuery) ||
        service.agentTag.toLowerCase().includes(normalizedQuery) ||
        service.category.toLowerCase().includes(normalizedQuery);
      if (!match) continue;
    }

    results.push(service);
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Seeds the initial catalog of verified agent services on Celo Mainnet.
 * Mock services have been purged. Only authentic services registered by
 * sovereign agents and providers are preserved.
 */
export function seedVerifiedServices() {
  purgeMockServices();
}

// Auto-seed / purge on load
seedVerifiedServices();
