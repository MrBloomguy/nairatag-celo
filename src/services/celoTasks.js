import { broadcastCeloPaidTaskToTelegram, broadcastCeloTaskToTelegram } from './celoSocialBroadcast.js';
const CELO_TASKS_API = import.meta.env.VITE_CELO_TASKS_API || (import.meta.env.DEV ? '/api/arc-tasks' : 'https://nairatag.ng/api/arc-tasks');
const CELO_CHAIN_ID = 42220;
const alertedPaidTasks = new Set();

function arcTasksUrl() {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://nairatag.ng';
  return new URL(CELO_TASKS_API, base);
}

function mapTask(row) {
  return {
    id: row.id,
    chainId: Number(row.chain_id),
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: row.category_label,
    creatorTag: row.creator_tag,
    deliverable: row.deliverable,
    rewardUSDC: Number(row.reward_usdc),
    points: Number(row.points),
    deadline: row.deadline_label,
    status: row.status,
    escrowStatus: row.escrow_status === 'not_integrated' ? 'Celo escrow contract not connected' : row.escrow_status,
    escrowContract: row.escrow_contract || null,
    createdAt: row.created_at,
  };
}

function mapProgress(progress) {
  return Object.fromEntries(Object.entries(progress || {}).map(([taskId, row]) => [taskId, {
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
  }]));
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Celo task service returned ${response.status}.`);
  }
  return payload;
}

export async function listCeloTasks(walletAddress = '') {
  const url = arcTasksUrl();
  if (walletAddress) url.searchParams.set('wallet', walletAddress);
  const payload = await readResponse(await fetch(url, { headers: { Accept: 'application/json' } }));
  const tasks = (payload.tasks || []).map(mapTask);
  const progress = mapProgress(payload.progress);
  if (walletAddress && typeof window !== 'undefined') {
    Object.entries(progress).filter(([taskId, row]) => row.status === 'paid' && !alertedPaidTasks.has(`${walletAddress.toLowerCase()}:${taskId}`)).forEach(([taskId]) => {
      const key = `${walletAddress.toLowerCase()}:${taskId}`;
      alertedPaidTasks.add(key);
      broadcastCeloPaidTaskToTelegram({ taskId, walletAddress }).catch((error) => {
        alertedPaidTasks.delete(key);
        console.warn('[Telegram task reward alert]', error.message);
      });
    });
  }
  return { tasks, progress };
}

export async function getCeloAgentCompletedTaskCount(agentWallet) {
  const url = arcTasksUrl();
  url.searchParams.set('agentWallet', agentWallet);
  const payload = await readResponse(await fetch(url, { headers: { Accept: 'application/json' } }));
  return Number(payload.completedTaskCount || 0);
}

/** Read task rewards for an agent wallet without triggering user notification broadcasts. */
export async function getCeloAgentTaskTotals(agentWallet) {
  if (!agentWallet) return { earnings: 0, pointsEarned: 0 };
  const url = arcTasksUrl();
  url.searchParams.set('wallet', agentWallet);
  const payload = await readResponse(await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  }));
  const tasksById = new Map((payload.tasks || []).map((task) => [String(task.id), task]));
  let earnings = 0;
  let pointsEarned = 0;
  for (const [taskId, progress] of Object.entries(payload.progress || {})) {
    const status = String(progress?.status || '').toLowerCase();
    const task = tasksById.get(String(taskId));
    if (!task) continue;
    if (status === 'paid') earnings += Number(task.reward_usdc ?? task.rewardUSDC) || 0;
    if (['approved', 'paid', 'completed'].includes(status)) pointsEarned += Number(task.points) || 0;
  }
  return { earnings, pointsEarned };
}

async function submitSignedAction({ action, taskId, walletAddress, deliverable, taskTitle, rewardUSDC, points }) {
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  if (!provider?.request) throw new Error('A compatible wallet is required to sign this task action.');
  const timestamp = Date.now();
  const message = [
    'NairaTag Celo Tasks',
    `Action: ${action}`,
    `Task: ${taskId}`,
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Chain: ${CELO_CHAIN_ID}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
  const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
  const payload = await readResponse(await fetch(CELO_TASKS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action, taskId, walletAddress, timestamp, signature, deliverable }),
  }));
  if (action === 'start' || action === 'submit') {
    broadcastCeloTaskToTelegram({ action, taskId, taskTitle, rewardUSDC, points, walletAddress, timestamp, signature })
      .catch((error) => console.warn('[Telegram task alert]', error.message));
  }
  return mapProgress({ [taskId]: payload.progress })[taskId];
}

export function startCeloTask({ taskId, walletAddress, taskTitle, rewardUSDC, points }) {
  return submitSignedAction({ action: 'start', taskId, walletAddress, taskTitle, rewardUSDC, points });
}

export function submitCeloTask({ taskId, walletAddress, deliverable, taskTitle, rewardUSDC, points }) {
  return submitSignedAction({ action: 'submit', taskId, walletAddress, deliverable, taskTitle, rewardUSDC, points });
}


// Backward compatibility aliases
export const listArcTasks = listCeloTasks;
export const getArcAgentCompletedTaskCount = getCeloAgentCompletedTaskCount;
export const getArcAgentTaskTotals = getCeloAgentTaskTotals;
export const startArcTask = startCeloTask;
export const submitArcTask = submitCeloTask;
