/**
 * @file durableTaskStore.js
 * @description Production-grade durable persistence layer for NairaTag Celo Tasks & Milestone Bounties.
 * 
 * Supports full lifecycle states:
 * - 'creating' / 'escrow_locking': Locking funds in milestone escrow contract.
 * - 'open': Escrow funded, seeking applicants/workers.
 * - 'in_progress' / 'ongoing': Assigned or started by worker.
 * - 'submitted': Deliverable submitted, pending creator/reviewer milestone approval.
 * - 'releasing': Milestone escrow release in progress via Textile FX RFQ corridor.
 * - 'paid': Settled on Celo Mainnet with confirmed transaction hash and ERC-8021 attribution.
 */

const STORAGE_KEY = 'nairatag_celo_tasks_v2';
const PROGRESS_KEY = 'nairatag_celo_task_progress_v2';

// Canonical Celo Mainnet verified transaction hash for escrow seed commitments
export const CELO_VERIFIED_ESCROW_TX = '0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7';

export const SEED_TASKS = [
  {
    id: 'task_user_live_001',
    chainId: 42220,
    title: 'Deploy & Test Multi-Currency Escrow Settlement',
    category: 'dev',
    categoryLabel: '⚡ Engineering',
    status: 'submitted',
    rewardAmount: 0.0003,
    rewardToken: 'USDT',
    rewardUSDC: 0.0003,
    rewardNGN: '≈ ₦0.43 cNGN',
    points: 10,
    deadline: '3 days left',
    applicants: 1,
    creatorTag: '₦0xc519...3C95',
    creatorAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    assignedWorkerTag: '₦0x5a84...5955',
    assignedWorkerAddress: '0x5a84e3DbDBF449B082db8C8E4579E369d4725955',
    submissionDeliverable: 'i, am done with the task, hope you like it',
    escrowStatus: '🔒 Funded in Escrow',
    escrowContract: '0x9f3de805eAa94516d216d6f1add78860B291BB76',
    escrowTxHash: '0xd0e920ec7a28bf3957fe31b023befb85c9f9b3a41fa1fd59fa7b7c7ccbb48060',
    description: 'On-chain verification milestone for sovereign escrow settlement with ERC-8021 metadata attribution on Celo Mainnet.',
    deliverable: 'Verify on-chain escrow funding on CeloScan and complete milestone submission.',
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'task_user_live_002',
    chainId: 42220,
    title: 'Test 20374',
    category: 'content',
    categoryLabel: '✍️ Content',
    status: 'open',
    rewardAmount: 0.0005,
    rewardToken: 'USDT',
    rewardUSDC: 0.0005,
    rewardNGN: '≈ ₦0.724 cNGN',
    points: 0,
    deadline: '3 days left',
    applicants: 0,
    creatorTag: '₦0xc519...3C95',
    creatorAddress: '0xc519729BF6D15e5984702BBa2C553f1c74A73C95',
    escrowStatus: '🔒 Funded in Escrow',
    escrowContract: '0x9f3de805eAa94516d216d6f1add78860B291BB76',
    escrowTxHash: '0x885cfc29fd0521021c4354b1af61cdd58d410abb79ef01f395c393b1d5c39221',
    description: 'Community bounty on Celo Mainnet with automated milestone escrow settlement.',
    deliverable: 'Public verification link, GitHub PR, or live demo.',
    createdAt: Date.now() - 3600000 * 1,
  },
  {
    id: 'celo_task_1',
    chainId: 42220,
    title: 'Build Webhook Listener for Celo Mainnet',
    category: 'dev',
    categoryLabel: '⚡ Engineering',
    status: 'open',
    rewardAmount: 35,
    rewardToken: 'USDT',
    rewardUSDC: 35,
    rewardNGN: '≈ ₦50,680 cNGN',
    points: 350,
    deadline: '3 days left',
    applicants: 2,
    creatorTag: '₦NAIRATAG',
    creatorAddress: '0x4444444444444444444444444444444444444444',
    escrowStatus: '🔒 Funded in Escrow',
    escrowTxHash: CELO_VERIFIED_ESCROW_TX,
    description: 'Implement an automated webhook listener tracking ERC-20 transfers for USDT, cNGN, and CELO with sub-second websocket delivery.',
    deliverable: 'Open source GitHub PR or repo link with automated tests verifying Celo RPC event subscriptions.',
    createdAt: Date.now() - 3600000 * 24 * 2,
  },
  {
    id: 'celo_task_2',
    chainId: 42220,
    title: 'Textile FX Corridors UI Redesign',
    category: 'design',
    categoryLabel: '🎨 Design',
    status: 'in_progress',
    rewardAmount: 45000,
    rewardToken: 'cNGN',
    rewardUSDC: 31.08,
    rewardNGN: '₦45,000 cNGN',
    points: 310,
    deadline: '5 days left',
    applicants: 1,
    creatorTag: '₦BLOOM',
    creatorAddress: '0x7c269150bbab5a4208a0d0a8310ba9e2d7e4af26',
    assignedWorkerTag: '₦DESIGNER',
    assignedWorkerAddress: '0x5555555555555555555555555555555555555555',
    startedAt: Date.now() - 3600000 * 12,
    escrowStatus: '🔒 Locked in Escrow',
    escrowTxHash: CELO_VERIFIED_ESCROW_TX,
    description: 'Create high-conversion Figma and Tailwind CSS components for instant multi-maker RFQ cross-stablecoin quotes.',
    deliverable: 'Figma design system link or PR with responsive React components.',
    createdAt: Date.now() - 3600000 * 24 * 3,
  },
  {
    id: 'celo_task_3',
    chainId: 42220,
    title: 'DeFi TVL & Liquidity Indexer for Celo Stables',
    category: 'data',
    categoryLabel: '📊 Data & AI',
    status: 'submitted',
    rewardAmount: 50,
    rewardToken: 'USDT',
    rewardUSDC: 50,
    rewardNGN: '≈ ₦72,400 cNGN',
    points: 500,
    deadline: '1 day left',
    applicants: 1,
    creatorTag: '₦DEFILLAMA',
    creatorAddress: '0xbfa1f5df5992925b6a742880df9e4757c2c96ce6',
    assignedWorkerTag: '₦ALICE',
    assignedWorkerAddress: '0x1111111111111111111111111111111111111111',
    startedAt: Date.now() - 3600000 * 24,
    submittedAt: Date.now() - 3600000 * 2,
    submissionDeliverable: 'https://github.com/nairatag-protocol/celo-tvl-indexer - Subgraph and cron sync live indexing cNGN & USD₮ liquidity pools on Uniswap v3 & Curve on Celo.',
    escrowStatus: '🔒 Funded in Escrow',
    escrowTxHash: CELO_VERIFIED_ESCROW_TX,
    description: 'Deploy an indexed telemetry feed tracking live Uniswap v3 & Curve pool balances for cNGN and USD₮ pairs.',
    deliverable: 'Live query endpoint or tested repository.',
    createdAt: Date.now() - 3600000 * 24 * 4,
  },
  {
    id: 'celo_task_4',
    chainId: 42220,
    title: 'Sub-Second Settlement Benchmarks on Celo',
    category: 'test',
    categoryLabel: '🧪 Testing',
    status: 'paid',
    rewardAmount: 25,
    rewardToken: 'USDT',
    rewardUSDC: 25,
    rewardNGN: '≈ ₦36,200 cNGN',
    points: 250,
    deadline: 'Completed',
    applicants: 1,
    creatorTag: '₦NAIRATAG',
    creatorAddress: '0x4444444444444444444444444444444444444444',
    assignedWorkerTag: '₦SEGUN',
    assignedWorkerAddress: '0x653f773c9062e71a6554b42a9525fcd47fcc1693',
    startedAt: Date.now() - 3600000 * 48,
    submittedAt: Date.now() - 3600000 * 20,
    paidAt: Date.now() - 3600000 * 5,
    submissionDeliverable: 'https://github.com/nairatag-protocol/celo-benchmarks - 1,000 tx batch completed with avg finality of 984ms on Celo Mainnet.',
    escrowStatus: '✅ Released & Settled',
    escrowTxHash: CELO_VERIFIED_ESCROW_TX,
    payoutHash: CELO_VERIFIED_ESCROW_TX,
    payoutDelivered: '36,256.64 cNGN',
    payoutToken: 'cNGN',
    description: 'Benchmark sub-second finality and zero-gas UX across 1,000 real-world micro-transactions on Celo Mainnet.',
    deliverable: 'Benchmark report and automated test execution log.',
    createdAt: Date.now() - 3600000 * 24 * 5,
  },
  {
    id: 'celo_task_5',
    chainId: 42220,
    title: 'Content Guide: Using Textile FX Corridors on Celo',
    category: 'content',
    categoryLabel: '✍️ Content',
    status: 'open',
    rewardAmount: 20,
    rewardToken: 'CELO',
    rewardUSDC: 9.0,
    rewardNGN: '≈ ₦13,032 cNGN',
    points: 100,
    deadline: '4 days left',
    applicants: 0,
    creatorTag: '₦NAIRATAG',
    creatorAddress: '0x4444444444444444444444444444444444444444',
    escrowStatus: '🔒 Funded in Escrow',
    escrowTxHash: CELO_VERIFIED_ESCROW_TX,
    description: 'Write a technical tutorial explaining RFQ atomic settlement between USD₮ and cNGN with ERC-8021 tracking.',
    deliverable: 'Markdown article or published Medium/Mirror link with code snippets.',
    createdAt: Date.now() - 3600000 * 18,
  },
];

let inMemoryTasks = null;
let inMemoryProgress = null;

function notifyTaskUpdate(task) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nairatag-tasks-updated', { detail: { task } }));
  }
}

/**
 * Loads all durable tasks.
 */
export function getDurableTasks() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[DurableTaskStore] LocalStorage read error:', err.message);
    }
  }

  if (inMemoryTasks) {
    return inMemoryTasks;
  }

  // Initialize with seed tasks
  inMemoryTasks = JSON.parse(JSON.stringify(SEED_TASKS));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryTasks));
    } catch {}
  }
  return inMemoryTasks;
}

/**
 * Saves a new task or updates an existing one in the store.
 */
export function saveDurableTask(task) {
  if (!task || !task.id) {
    throw new Error('Task must have a valid id.');
  }

  const tasks = getDurableTasks();
  const index = tasks.findIndex((t) => t.id === task.id);

  if (index >= 0) {
    tasks[index] = { ...tasks[index], ...task };
  } else {
    tasks.unshift(task);
  }

  inMemoryTasks = tasks;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn('[DurableTaskStore] Save failed:', err.message);
    }
  }

  notifyTaskUpdate(task);
  syncTaskToRemote(task);
  return task;
}

/**
 * Updates the lifecycle state of a task:
 * - 'open' -> 'in_progress'
 * - 'in_progress' -> 'submitted'
 * - 'submitted' -> 'releasing' -> 'paid'
 */
export function updateTaskState(taskId, updates = {}) {
  const tasks = getDurableTasks();
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index < 0) {
    throw new Error(`Task ${taskId} not found.`);
  }

  const existing = tasks[index];
  const nextStatus = updates.status || existing.status;

  const updatedTask = {
    ...existing,
    ...updates,
    status: nextStatus,
  };

  // Sync escrowStatus message
  if (nextStatus === 'paid') {
    updatedTask.escrowStatus = '✅ Released & Settled';
  } else if (nextStatus === 'releasing') {
    updatedTask.escrowStatus = '⚡ Releasing via Textile FX...';
  } else if (nextStatus === 'submitted') {
    updatedTask.escrowStatus = '📩 Deliverable Under Review';
  } else if (nextStatus === 'in_progress') {
    updatedTask.escrowStatus = '🟡 Work in Progress';
  } else if (nextStatus === 'open') {
    updatedTask.escrowStatus = '🔒 Funded in Escrow';
  }

  tasks[index] = updatedTask;
  inMemoryTasks = tasks;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn('[DurableTaskStore] Update failed:', err.message);
    }
  }

  notifyTaskUpdate(updatedTask);
  syncTaskPatchToRemote(taskId, updates);
  return updatedTask;
}

const SUPABASE_REST_URL = 'https://bbpdupijsgdghemfpijr.supabase.co/rest/v1/celo_tasks';
const SUPABASE_ANON_KEY = 'sb_publishable_3mRhhwX9BhnJyobyCX7uWw_h2-idCPf';

export async function syncTaskToRemote(task) {
  try {
    const apiRes = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).catch(() => null);

    if (apiRes && apiRes.ok) return true;

    // Direct Supabase REST fallback
    const res = await fetch(SUPABASE_REST_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: task.id,
        chain_id: task.chainId || 42220,
        title: task.title,
        description: task.description || '',
        category: task.category,
        category_label: task.categoryLabel,
        creator_tag: task.creatorTag,
        creator_address: task.creatorAddress,
        deliverable: task.deliverable,
        reward_amount: task.rewardAmount,
        reward_token: task.rewardToken,
        reward_usdc: task.rewardUSDC,
        reward_ngn: task.rewardNGN,
        points: task.points,
        deadline: task.deadline,
        applicants: task.applicants || 0,
        status: task.status,
        escrow_status: task.escrowStatus,
        escrow_contract: task.escrowContract,
        escrow_tx_hash: task.escrowTxHash,
        assigned_worker_tag: task.assignedWorkerTag,
        assigned_worker_address: task.assignedWorkerAddress,
        submission_deliverable: task.submissionDeliverable,
        payout_hash: task.payoutHash,
        payout_delivered: task.payoutDelivered,
        payout_token: task.payoutToken,
        created_at: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
      }),
    }).catch(() => null);
    return res && res.ok;
  } catch (err) {
    console.debug('[DurableTaskStore] Background sync ignored:', err?.message);
    return false;
  }
}

export async function syncTaskPatchToRemote(taskId, updates) {
  try {
    const apiRes = await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => null);

    if (apiRes && apiRes.ok) return;

    const patchBody = {};
    if (updates.status) patchBody.status = updates.status;
    if (updates.escrowStatus) patchBody.escrow_status = updates.escrowStatus;
    if (updates.assignedWorkerTag) patchBody.assigned_worker_tag = updates.assignedWorkerTag;
    if (updates.assignedWorkerAddress) patchBody.assigned_worker_address = updates.assignedWorkerAddress;
    if (updates.submissionDeliverable) patchBody.submission_deliverable = updates.submissionDeliverable;
    if (updates.payoutHash) patchBody.payout_hash = updates.payoutHash;
    if (updates.payoutDelivered) patchBody.payout_delivered = updates.payoutDelivered;
    if (updates.payoutToken) patchBody.payout_token = updates.payoutToken;
    patchBody.updated_at = new Date().toISOString();

    await fetch(`${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    }).catch(() => null);
  } catch (err) {
    console.debug('[DurableTaskStore] Background patch ignored:', err?.message);
  }
}

/**
 * Retrieves a single task by ID.
 */
export function getTaskById(taskId) {
  const tasks = getDurableTasks();
  return tasks.find((t) => t.id === taskId) || null;
}

/**
 * Reset back to clean seed data.
 */
export function resetDurableTasks() {
  inMemoryTasks = JSON.parse(JSON.stringify(SEED_TASKS));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryTasks));
    } catch {}
  }
  notifyTaskUpdate(null);
  return inMemoryTasks;
}
