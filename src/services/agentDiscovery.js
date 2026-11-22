const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'for', 'find', 'help', 'i', 'me', 'my',
  'of', 'please', 'the', 'to', 'use', 'with', 'who', 'what', 'that', 'this',
  'agent', 'agents', 'tool', 'tools', 'integration', 'integrations', 'capability',
]);

const UNAVAILABLE_STATES = new Set([
  'disabled', 'draft', 'pending', 'pending_approval', 'unpublished', 'suspended',
  'revoked', 'retired', 'unavailable', 'offline', 'degraded', 'unknown',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[₦$@#]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasPhrase(text, phrase) {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

function isUnavailable(agent) {
  const status = String(agent?.status || 'unknown').toLowerCase().replace(/[ -]+/g, '_');
  return UNAVAILABLE_STATES.has(status);
}

function getAliases(agent) {
  const values = [
    agent?.tag,
    agent?.name,
    agent?.displayName,
    ...(Array.isArray(agent?.aliases) ? agent.aliases : []),
    ...(Array.isArray(agent?.voiceAliases) ? agent.voiceAliases : []),
  ];
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function findExplicitTag(prompt) {
  const source = String(prompt || '').normalize('NFKC');
  const patterns = [
    /₦\s*([\p{L}\p{N}_-]{2,32})/u,
    /@\s*([\p{L}\p{N}_-]{2,32})/u,
    /\bnaira\s*tag\s+([\p{L}\p{N}_-]{2,32})/iu,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      const tag = normalizeText(match[1]).replace(/\s/g, '');
      // Avoid mistaking ordinary currency amounts such as ₦5,000 for an identity.
      if (/\d/.test(tag) && !/[a-z_]/i.test(tag)) continue;
      return tag;
    }
  }
  return null;
}

export function resolveAgentMention(prompt, agents = []) {
  const explicitTag = findExplicitTag(prompt);
  const available = agents.filter((agent) => !isUnavailable(agent));
  if (explicitTag) {
    const matches = available.filter((agent) => normalizeText(agent.tag).replace(/\s/g, '') === explicitTag);
    if (matches.length === 1) return { kind: 'resolved', agent: matches[0], source: 'tag' };
    if (matches.length > 1) return { kind: 'ambiguous', agents: matches, source: 'tag' };
    return { kind: 'unavailable', tag: explicitTag };
  }

  const normalizedPrompt = normalizeText(prompt);
  const matches = available
    .map((agent) => ({ agent, alias: getAliases(agent).filter((alias) => hasPhrase(normalizedPrompt, alias)).sort((a, b) => b.length - a.length)[0] }))
    .filter((entry) => entry.alias);
  const longestAlias = Math.max(0, ...matches.map((entry) => entry.alias.length));
  const strongest = matches.filter((entry) => entry.alias.length === longestAlias);
  const distinct = [...new Map(strongest.map(({ agent }) => [String(agent.id || agent.tag).toLowerCase(), agent])).values()];
  if (distinct.length === 1) return { kind: 'resolved', agent: distinct[0], source: 'alias' };
  if (distinct.length > 1) return { kind: 'ambiguous', agents: distinct, source: 'alias' };
  return { kind: 'none' };
}

function getCallableTools(agent) {
  if (isUnavailable(agent)) return [];
  const tools = Array.isArray(agent?.callableTools) ? agent.callableTools : [];
  return tools.filter((tool) => {
    if (typeof tool === 'string') return true;
    if (!tool || typeof tool !== 'object') return false;
    if (tool.enabled === false || tool.available === false || tool.callable === false) return false;
    if (tool.availability && !['enabled', 'available', 'healthy'].includes(String(tool.availability).toLowerCase())) return false;
    if (tool.status && UNAVAILABLE_STATES.has(String(tool.status).toLowerCase().replace(/[ -]+/g, '_'))) return false;
    return true;
  });
}

function getToolText(tool) {
  if (typeof tool === 'string') return normalizeText(tool);
  return normalizeText([
    tool.key, tool.name, tool.title, tool.description, tool.summary,
    tool.capability, tool.operation, ...(Array.isArray(tool.tags) ? tool.tags : []),
  ].filter(Boolean).join(' '));
}

export function discoverAgentsByCapability(request, agents = [], limit = 3, options = {}) {
  const requestTerms = normalizeText(request)
    .split(' ')
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  if (!requestTerms.length) return [];

  let candidatePool = agents.filter((agent) => !isUnavailable(agent));
  if (options.selfVerifiedOnly) {
    candidatePool = candidatePool.filter((agent) => agent.self?.verified === true || agent.status === 'verified');
  }

  return candidatePool
    .map((agent) => {
      const matchedTools = getCallableTools(agent).map((tool) => ({ tool, text: getToolText(tool) }))
        .map(({ tool, text }) => ({ tool, matches: requestTerms.filter((term) => hasPhrase(text, term)) }))
        .filter((entry) => entry.matches.length > 0)
        .sort((a, b) => b.matches.length - a.matches.length);
      const matchedTerms = [...new Set(matchedTools.flatMap((entry) => entry.matches))];
      return {
        agent,
        matchedTools: matchedTools.map((entry) => entry.tool),
        matchedTerms,
        score: matchedTerms.length,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || String(a.agent.tag).localeCompare(String(b.agent.tag)))
    .slice(0, Math.max(1, limit));
}

/**
 * Filters agents by their authoritative Self Agent ID verification status.
 * Supports: 'all', 'verified' (Self Verified), 'pending' (Verification Pending), 'unverified' (Not Verified).
 * 
 * @param {Array} agents - Candidate agents
 * @param {string} [filter='all'] - Target filter key
 * @returns {Array} Filtered agents
 */
export function filterAgentsByVerification(agents = [], filter = 'all') {
  if (!Array.isArray(agents)) return [];
  const normalizedFilter = String(filter || 'all').toLowerCase().trim();
  if (normalizedFilter === 'all') return agents;

  return agents.filter((agent) => {
    const isVerified = agent.self?.verified === true || agent.status === 'verified';
    const isPending = agent.self?.status === 'verification_pending' || agent.status === 'verification_pending';

    if (normalizedFilter === 'verified' || normalizedFilter === 'self_verified') {
      return isVerified;
    }
    if (normalizedFilter === 'pending' || normalizedFilter === 'verification_pending') {
      return isPending;
    }
    if (normalizedFilter === 'unverified') {
      return !isVerified && !isPending;
    }
    return true;
  });
}

export function isAgentDiscoveryRequest(prompt) {
  return /^\s*(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:find|show|search for|who is|who can|what agent|which agent)\b/i.test(String(prompt || ''));
}

/**
 * Standard NairaTag Reusable Booking Capability Definition (Phase 5 / ERC-8004)
 */
export const STANDARD_BOOKING_CAPABILITY = {
  name: 'booking',
  version: '1.0',
  enabled: true,
  supports: [
    'service_discovery',
    'availability',
    'booking_request',
    'booking_confirmation',
    'cancellation',
    'rescheduling',
  ],
};

/**
 * Checks if an agent declares the standardized booking capability.
 */
export function isBookingCapableAgent(agent) {
  if (!agent || isUnavailable(agent)) return false;
  const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  return capabilities.some((c) => {
    if (typeof c === 'string') return c.toLowerCase() === 'booking';
    return c?.name?.toLowerCase() === 'booking' && c.enabled !== false;
  });
}

