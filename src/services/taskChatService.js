/**
 * @file taskChatService.js
 * @description Dedicated in-place Project Workspace & Escrow Chat for NairaTag Celo Milestone Bounties.
 * Backed by Supabase PostgreSQL `celo_task_messages` table for real-time multi-user communication.
 */

const STORAGE_PREFIX = 'nairatag_task_chat_';
const SUPABASE_REST_URL = 'https://bbpdupijsgdghemfpijr.supabase.co/rest/v1/celo_task_messages';
const SUPABASE_ANON_KEY = 'sb_publishable_3mRhhwX9BhnJyobyCX7uWw_h2-idCPf';

const IN_HOUSE_AGENTS = new Set(['₦NAIRATAG', '₦BLOOM', '₦DEFILLAMA', '₦METEO', '₦COINGECKO', 'NAIRATAG', 'BLOOM', 'DEFILLAMA', 'METEO', 'COINGECKO']);

/**
 * Returns default chronological milestone events for a task.
 */
export function getDefaultMilestoneEvents(task) {
  if (!task) return [];
  const events = [];
  const creator = task.creatorTag?.replace(/^₦/, '').toUpperCase() || 'CLIENT';
  const rewardLabel = `${task.rewardAmount || task.rewardUSDC || 0} ${task.rewardToken === 'USDT' ? 'USD₮' : (task.rewardToken || 'USD₮')}`;

  // 1. Escrow Lock Event
  events.push({
    id: `event_created_${task.id}`,
    task_id: task.id,
    type: 'system',
    sender: 'system',
    senderTag: 'ESCROW',
    role: 'system',
    text: `🔒 Milestone Escrow Funded: ${rewardLabel} locked on Celo Mainnet by ₦${creator}.`,
    timestamp: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
  });

  // 2. Work Started Event (if ongoing or later)
  if (task.status === 'in_progress' || task.status === 'submitted' || task.status === 'releasing' || task.status === 'paid') {
    const worker = task.assignedWorkerTag?.replace(/^₦/, '').toUpperCase() || 'FREELANCER';
    events.push({
      id: `event_started_${task.id}`,
      task_id: task.id,
      type: 'system',
      sender: 'system',
      senderTag: 'PROTOCOL',
      role: 'system',
      text: `⚡ Work In Progress: ₦${worker} claimed this milestone bounty and began implementation.`,
      timestamp: task.startedAt ? new Date(task.startedAt).getTime() : Date.now(),
    });
  }

  // 3. Deliverable Submitted Event (if submitted or later)
  if (task.status === 'submitted' || task.status === 'releasing' || task.status === 'paid') {
    events.push({
      id: `event_submitted_${task.id}`,
      task_id: task.id,
      type: 'system',
      sender: 'system',
      senderTag: 'DELIVERABLE',
      role: 'system',
      text: `📩 Deliverable Submitted for Review: "${task.submissionDeliverable || task.deliverable || 'Work completed'}"`,
      timestamp: task.submittedAt ? new Date(task.submittedAt).getTime() : Date.now(),
    });
  }

  // 4. Milestone Approved & Paid Event
  if (task.status === 'paid') {
    const delivered = task.payoutDelivered || rewardLabel;
    const worker = task.assignedWorkerTag?.replace(/^₦/, '').toUpperCase() || 'FREELANCER';
    events.push({
      id: `event_paid_${task.id}`,
      task_id: task.id,
      type: 'system',
      sender: 'system',
      senderTag: 'SETTLED',
      role: 'system',
      text: `🎉 Milestone Escrow Approved: Settled ${delivered} to ₦${worker} via Textile FX Corridor (celo_9f7deabd99a6).`,
      timestamp: task.paidAt ? new Date(task.paidAt).getTime() : Date.now(),
    });
  }

  return events;
}

/**
 * Loads all chat messages for a specific task from Supabase, falling back to localStorage.
 */
export async function getTaskChatMessages(taskId, task) {
  if (!taskId) return [];
  const key = `${STORAGE_PREFIX}${taskId}`;

  // 1. Query Supabase for shared multi-user chat
  try {
    const res = await fetch(`${SUPABASE_REST_URL}?task_id=eq.${encodeURIComponent(taskId)}&order=created_at.asc`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    }).catch(() => null);

    if (res && res.ok) {
      const rows = await res.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped = rows.map((r) => ({
          id: r.id,
          type: r.role === 'system' ? 'system' : r.role === 'agent' ? 'agent' : 'user',
          sender: r.sender,
          senderTag: r.sender_tag,
          role: r.role || 'user',
          text: r.text,
          timestamp: new Date(r.created_at).getTime(),
        }));

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(key, JSON.stringify(mapped));
          } catch {}
        }
        return mapped;
      }
    }
  } catch (err) {
    console.debug('[TaskChatService] Supabase fetch bypassed:', err?.message);
  }

  // 2. Read from localStorage if available
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  // 3. Fallback to default chronological milestone events
  const initial = getDefaultMilestoneEvents(task);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(initial));
    } catch {}
  }

  // Seed default milestone event to Supabase in background
  if (initial.length > 0) {
    for (const evt of initial) {
      fetch(SUPABASE_REST_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          id: evt.id,
          task_id: taskId,
          sender: evt.sender,
          sender_tag: evt.senderTag,
          role: evt.role || 'system',
          text: evt.text,
          created_at: new Date(evt.timestamp).toISOString(),
        }),
      }).catch(() => null);
    }
  }

  return initial;
}

/**
 * Saves a new message to the task chat and persists to Supabase.
 */
export async function sendTaskChatMessage(taskId, { sender, senderTag, role, text, isAgent = false }, task) {
  if (!taskId || !text?.trim()) return null;
  const key = `${STORAGE_PREFIX}${taskId}`;

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const messageRole = role || (isAgent ? 'agent' : 'user');
  const timestamp = Date.now();

  const newMsg = {
    id: messageId,
    type: messageRole === 'system' ? 'system' : isAgent ? 'agent' : 'user',
    sender: sender || 'user',
    senderTag: senderTag || '₦YOU',
    role: messageRole,
    text: text.trim(),
    timestamp,
  };

  // 1. Update localStorage cache immediately
  let updated = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : [];
      updated = [...existing, newMsg];
      window.localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      updated = [newMsg];
    }
  } else {
    updated = [newMsg];
  }

  // 2. Persist to Supabase in background
  try {
    fetch(SUPABASE_REST_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: messageId,
        task_id: taskId,
        sender: sender || 'user',
        sender_tag: senderTag || '₦YOU',
        role: messageRole,
        text: text.trim(),
        created_at: new Date(timestamp).toISOString(),
      }),
    }).catch(() => null);
  } catch {}

  return { message: newMsg, allMessages: updated };
}

/**
 * Checks whether the task creator is an autonomous platform AI agent.
 */
export function isTaskCreatorAgent(task) {
  if (!task?.creatorTag) return false;
  const clean = task.creatorTag.replace(/^₦/, '').toUpperCase();
  return IN_HOUSE_AGENTS.has(clean) || IN_HOUSE_AGENTS.has(task.creatorTag);
}

/**
 * Generates an intelligent in-character response ONLY IF task creator is an autonomous AI agent.
 */
export function generateAgentTaskReply(task, userPrompt) {
  if (!isTaskCreatorAgent(task)) return null;

  const cleanPrompt = (userPrompt || '').toLowerCase();
  const rewardStr = `${task.rewardAmount || task.rewardUSDC || 0} ${task.rewardToken === 'USDT' ? 'USD₮' : (task.rewardToken || 'USD₮')}`;

  if (cleanPrompt.includes('submit') || cleanPrompt.includes('done') || cleanPrompt.includes('finished') || cleanPrompt.includes('pr') || cleanPrompt.includes('link')) {
    return `Thanks for the update! Please paste your deliverable link in the submission box above. Once submitted, I will review the code and approve the ${rewardStr} milestone escrow release on Celo.`;
  }

  if (cleanPrompt.includes('escrow') || cleanPrompt.includes('fund') || cleanPrompt.includes('locked') || cleanPrompt.includes('safe') || cleanPrompt.includes('pay')) {
    return `The ${rewardStr} bounty is fully locked in NairaTag Milestone Escrow on Celo Mainnet. Funds can only be released upon milestone approval or returned via dispute window.`;
  }

  if (cleanPrompt.includes('help') || cleanPrompt.includes('question') || cleanPrompt.includes('spec') || cleanPrompt.includes('requirement')) {
    return `Regarding "${task.title}": The primary deliverable is "${task.deliverable || 'Public verification link or demo'}". Ensure all requirements adhere to Celo Mainnet standards with sub-second finality.`;
  }

  return `Noted! I'm tracking this milestone. As soon as deliverables are ready, submit them here so we can verify and settle the ${rewardStr} payment via Textile FX.`;
}
