import { broadcastCeloPaidTaskToTelegram, broadcastCeloTaskToTelegram } from './celoSocialBroadcast.js';
import { getDurableTasks, saveDurableTask, updateTaskState, getTaskById } from './durableTaskStore.js';

const CELO_TASKS_API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CELO_TASKS_API)
  || (typeof import.meta !== 'undefined' && import.meta.env?.DEV ? '/api/arc-tasks' : 'https://nairatag.ng/api/arc-tasks');
const CELO_CHAIN_ID = 42220;
const alertedPaidTasks = new Set();

function arcTasksUrl() {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://nairatag.ng';
  return new URL(CELO_TASKS_API, base);
}

function mapTask(row) {
  return {
    id: row.id,
    chainId: Number(row.chain_id || row.chainId || CELO_CHAIN_ID),
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: row.category_label || row.categoryLabel,
    creatorTag: row.creator_tag || row.creatorTag,
    deliverable: row.deliverable,
    rewardAmount: Number(row.rewardAmount || row.reward_amount || row.rewardUSDC || row.reward_usdc || 0),
    rewardToken: row.rewardToken || row.reward_token || 'USDT',
    rewardUSDC: Number(row.reward_usdc || row.rewardUSDC || 0),
    rewardNGN: row.reward_ngn || row.rewardNGN,
    points: Number(row.points || 0),
    deadline: row.deadline_label || row.deadline || '3 days left',
    status: row.status || 'open',
    escrowStatus: row.escrow_status || row.escrowStatus || '🔒 Funded in Escrow',
    escrowContract: row.escrow_contract || null,
    escrowTxHash: row.escrow_tx_hash || row.escrowTxHash || null,
    assignedWorkerTag: row.assigned_worker_tag || row.assignedWorkerTag || null,
    assignedWorkerAddress: row.assigned_worker_address || row.assignedWorkerAddress || null,
    submissionDeliverable: row.submission_deliverable || row.submissionDeliverable || null,
    payoutHash: row.payout_hash || row.payoutHash || null,
    payoutDelivered: row.payout_delivered || row.payoutDelivered || null,
    payoutToken: row.payout_token || row.payoutToken || null,
    createdAt: row.created_at || row.createdAt || Date.now(),
  };
}

export async function listCeloTasks(walletAddress = '') {
  // 1. Load local durable tasks first (guaranteed offline/cross-session reliability)
  const localTasks = getDurableTasks().map(mapTask);
  const localProgress = {};
  for (const t of localTasks) {
    localProgress[t.id] = {
      status: t.status,
      startedAt: t.startedAt || null,
      submittedAt: t.submittedAt || null,
      reviewedAt: t.paidAt || null,
    };
  }

  // 2. Attempt remote sync if API is responding
  try {
    const url = arcTasksUrl();
    if (walletAddress) url.searchParams.set('wallet', walletAddress);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    }).catch(() => null);

    if (timeoutId) clearTimeout(timeoutId);

    if (res && res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (payload.ok && Array.isArray(payload.tasks) && payload.tasks.length > 0) {
        const remoteTasks = payload.tasks.map(mapTask);
        // Merge remote tasks with local tasks, keeping local custom/updated state prioritized
        const remoteIds = new Set(remoteTasks.map((t) => t.id));
        const merged = [
          ...localTasks.filter((lt) => !remoteIds.has(lt.id)),
          ...remoteTasks,
        ];
        return { tasks: merged, progress: { ...localProgress, ...(payload.progress || {}) } };
      }
    }
  } catch (err) {
    // Graceful offline fallback
    console.debug('[listCeloTasks] Remote fetch bypassed, using durable store:', err.message);
  }

  // Return durable store records
  return { tasks: localTasks, progress: localProgress };
}

export async function getCeloAgentCompletedTaskCount(agentWallet) {
  const { tasks, progress } = await listCeloTasks(agentWallet);
  const completed = Object.values(progress).filter((p) => p.status === 'paid' || p.status === 'completed').length;
  return completed;
}

export async function getCeloAgentTaskTotals(agentWallet) {
  if (!agentWallet) return { earnings: 0, pointsEarned: 0 };
  const { tasks, progress } = await listCeloTasks(agentWallet);
  const tasksById = new Map(tasks.map((task) => [String(task.id), task]));
  let earnings = 0;
  let pointsEarned = 0;
  for (const [taskId, prog] of Object.entries(progress)) {
    const status = String(prog?.status || '').toLowerCase();
    const task = tasksById.get(String(taskId));
    if (!task) continue;
    if (status === 'paid') earnings += Number(task.rewardAmount || task.rewardUSDC) || 0;
    if (['approved', 'paid', 'completed'].includes(status)) pointsEarned += Number(task.points) || 0;
  }
  return { earnings, pointsEarned };
}

export async function startCeloTask({ taskId, walletAddress, workerTag, taskTitle, rewardUSDC, points }) {
  // Update local durable store immediately
  const updated = updateTaskState(taskId, {
    status: 'in_progress',
    assignedWorkerTag: workerTag || '₦WORKER',
    assignedWorkerAddress: walletAddress,
    startedAt: Date.now(),
  });

  // Attempt background signature & Telegram broadcast if available
  try {
    broadcastCeloTaskToTelegram({
      action: 'start',
      taskId,
      taskTitle: taskTitle || updated.title,
      rewardUSDC: rewardUSDC || updated.rewardUSDC,
      points: points || updated.points,
      walletAddress,
      timestamp: Date.now(),
    }).catch(() => {});
  } catch {}

  return {
    status: 'in_progress',
    startedAt: updated.startedAt,
    submittedAt: null,
    reviewedAt: null,
  };
}

export async function submitCeloTask({ taskId, walletAddress, deliverable, taskTitle, rewardUSDC, points }) {
  // Update local durable store immediately
  const updated = updateTaskState(taskId, {
    status: 'submitted',
    submissionDeliverable: deliverable,
    submittedAt: Date.now(),
  });

  // Attempt background broadcast
  try {
    broadcastCeloTaskToTelegram({
      action: 'submit',
      taskId,
      taskTitle: taskTitle || updated.title,
      rewardUSDC: rewardUSDC || updated.rewardUSDC,
      points: points || updated.points,
      walletAddress,
      timestamp: Date.now(),
    }).catch(() => {});
  } catch {}

  return {
    status: 'submitted',
    startedAt: updated.startedAt,
    submittedAt: updated.submittedAt,
    reviewedAt: null,
  };
}

// Backward compatibility aliases
export const listArcTasks = listCeloTasks;
export const getArcAgentCompletedTaskCount = getCeloAgentCompletedTaskCount;
export const getArcAgentTaskTotals = getCeloAgentTaskTotals;
export const startArcTask = startCeloTask;
export const submitArcTask = submitCeloTask;
