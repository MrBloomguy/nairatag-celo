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

const STORAGE_KEY = 'nairatag_celo_tasks_v1';
const PROGRESS_KEY = 'nairatag_celo_task_progress_v1';

export const SEED_TASKS = [
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
    escrowTxHash: '0x12a9ef44729174bdb389ce36242eea2f61587be40a867cf5b31d1beb70d2bb9',
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
    escrowTxHash: '0xee9d3d3a0a1eaae45b91045be3cd6892e85681de99ec97a58fcf14812238dbe1',
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
    escrowTxHash: '0xf5b31d1beb70d2bb97f7345d46729174bdb389ce36242eea2f61587be40a867c',
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
    escrowTxHash: '0x936d0299f23a6721d45a56f9ce29bd3f691e09defd927cf7836e3285b0791853',
    payoutHash: '0x05c44d7a279ad6e5567ad1d178f9dbef12aae546115247b5dc5ee61287b00baf',
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
    escrowTxHash: '0x7abbc0177162a76cfc1c465ca939f98aeb969e7838a1823e99e83b216eb6102a',
    description: 'Write a comprehensive technical tutorial explaining RFQ atomic settlement between USD₮ and cNGN with ERC-8021 tracking.',
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
  return updatedTask;
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
