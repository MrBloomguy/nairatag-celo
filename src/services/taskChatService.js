/**
 * @file taskChatService.js
 * @description Dedicated in-place Project Workspace Chat for NairaTag Celo Milestone Bounties.
 * Allows task creators, workers, and autonomous agents to discuss project scope,
 * track deliverables, review milestones, and log escrow events directly within the task view.
 */

const STORAGE_PREFIX = 'nairatag_task_chat_';

/**
 * Returns default chronological milestone events for a task.
 */
function getDefaultMilestoneEvents(task) {
  if (!task) return [];
  const events = [];
  const creator = task.creatorTag?.replace(/^₦/, '').toUpperCase() || 'CREATOR';
  const rewardLabel = `${task.rewardAmount || task.rewardUSDC || 0} ${task.rewardToken === 'USDT' ? 'USD₮' : (task.rewardToken || 'USD₮')}`;
  
  // 1. Escrow Lock Event
  events.push({
    id: `event_created_${task.id}`,
    type: 'system',
    sender: 'system',
    senderTag: 'ESCROW',
    text: `🔒 Milestone Escrow Funded: ${rewardLabel} locked on Celo Mainnet by ₦${creator}.`,
    timestamp: task.createdAt || (Date.now() - 3600000 * 24),
  });

  // 2. Work Started Event (if ongoing or later)
  if (task.status === 'in_progress' || task.status === 'submitted' || task.status === 'releasing' || task.status === 'paid') {
    const worker = task.assignedWorkerTag?.replace(/^₦/, '').toUpperCase() || 'WORKER';
    events.push({
      id: `event_started_${task.id}`,
      type: 'system',
      sender: 'system',
      senderTag: 'PROTOCOL',
      text: `⚡ Work In Progress: ₦${worker} claimed this milestone bounty and began implementation.`,
      timestamp: task.startedAt || (Date.now() - 3600000 * 12),
    });
  }

  // 3. Deliverable Submitted Event (if submitted or later)
  if (task.status === 'submitted' || task.status === 'releasing' || task.status === 'paid') {
    events.push({
      id: `event_submitted_${task.id}`,
      type: 'system',
      sender: 'system',
      senderTag: 'DELIVERABLE',
      text: `📩 Deliverable Submitted for Review: "${task.submissionDeliverable || task.deliverable || 'Work completed'}"`,
      timestamp: task.submittedAt || (Date.now() - 3600000 * 4),
    });
  }

  // 4. Milestone Approved & Paid Event
  if (task.status === 'paid') {
    const delivered = task.payoutDelivered || rewardLabel;
    const worker = task.assignedWorkerTag?.replace(/^₦/, '').toUpperCase() || 'WORKER';
    events.push({
      id: `event_paid_${task.id}`,
      type: 'system',
      sender: 'system',
      senderTag: 'SETTLED',
      text: `🎉 Milestone Escrow Approved: Settled ${delivered} to ₦${worker} via Textile FX Corridor (celo_9f7deabd99a6).`,
      timestamp: task.paidAt || Date.now(),
    });
  }

  return events;
}

/**
 * Loads all chat messages for a specific task.
 */
export function getTaskChatMessages(taskId, task) {
  if (!taskId) return [];
  const key = `${STORAGE_PREFIX}${taskId}`;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[TaskChatService] LocalStorage read warning:', err.message);
    }
  }

  const initial = getDefaultMilestoneEvents(task);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(initial));
    } catch {}
  }
  return initial;
}

/**
 * Saves a new message to the task chat and handles autonomous agent replies.
 */
export async function sendTaskChatMessage(taskId, { sender, senderTag, text, isAgent = false }, task) {
  if (!taskId || !text?.trim()) return null;
  const key = `${STORAGE_PREFIX}${taskId}`;
  const existing = getTaskChatMessages(taskId, task);

  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: isAgent ? 'agent' : 'user',
    sender: sender || 'user',
    senderTag: senderTag || '₦YOU',
    text: text.trim(),
    timestamp: Date.now(),
  };

  const updated = [...existing, newMsg];

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  }

  return { message: newMsg, allMessages: updated };
}

/**
 * Generates an intelligent in-character response from the task creator / agent.
 */
export function generateAgentTaskReply(task, userPrompt) {
  const creator = task?.creatorTag?.replace(/^₦/, '').toUpperCase() || 'OWNER';
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
