import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDurableTasks,
  saveDurableTask,
  updateTaskState,
  getTaskById,
  resetDurableTasks,
  SEED_TASKS
} from '../src/services/durableTaskStore.js';
import { listCeloTasks, startCeloTask, submitCeloTask } from '../src/services/celoTasks.js';

test('Durable Task Store & Lifecycle Suite', async (t) => {
  // Reset clean state before tests
  resetDurableTasks();

  await t.test('1. Pre-seeds default Celo Mainnet bounties across multiple categories & states', () => {
    const tasks = getDurableTasks();
    assert.ok(Array.isArray(tasks));
    assert.ok(tasks.length >= 4);

    const openTask = tasks.find((t) => t.status === 'open');
    assert.ok(openTask, 'Should contain at least one open task');
    assert.equal(openTask.chainId, 42220);
    assert.ok(openTask.escrowStatus.includes('Escrow'));

    const inProgressTask = tasks.find((t) => t.status === 'in_progress');
    assert.ok(inProgressTask, 'Should contain an in_progress task');
    assert.ok(inProgressTask.assignedWorkerTag);

    const submittedTask = tasks.find((t) => t.status === 'submitted');
    assert.ok(submittedTask, 'Should contain a submitted task');
    assert.ok(submittedTask.submissionDeliverable);

    const paidTask = tasks.find((t) => t.status === 'paid');
    assert.ok(paidTask, 'Should contain a paid task');
    assert.ok(paidTask.payoutHash);
  });

  await t.test('2. Saves a new bounty with creating & open status', () => {
    const newBounty = {
      id: `test_bounty_${Date.now()}`,
      chainId: 42220,
      title: 'Build Liquidity Rebalancer for cNGN',
      category: 'dev',
      categoryLabel: '⚡ Engineering',
      status: 'open',
      rewardAmount: 60,
      rewardToken: 'USDT',
      rewardUSDC: 60,
      rewardNGN: '≈ ₦86,880 cNGN',
      points: 600,
      deadline: '7 days left',
      creatorTag: '₦SEGUN',
      creatorAddress: '0x653f773C9062e71A6554b42a9525fcD47fCC1693',
      escrowStatus: '🔒 Funded in Escrow',
      escrowTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      description: 'Implement automated liquidity rebalancer between Uniswap v3 and Curve.',
      deliverable: 'GitHub PR with integration tests.',
    };

    saveDurableTask(newBounty);

    const retrieved = getTaskById(newBounty.id);
    assert.ok(retrieved);
    assert.equal(retrieved.title, newBounty.title);
    assert.equal(retrieved.status, 'open');
  });

  await t.test('3. Transitions task lifecycle: open -> in_progress (Ongoing)', async () => {
    const taskId = 'celo_task_1';
    const workerTag = '₦BLOOM';
    const workerAddress = '0x7c269150bbab5a4208a0d0a8310ba9e2d7e4af26';

    const progress = await startCeloTask({
      taskId,
      walletAddress: workerAddress,
      workerTag,
      taskTitle: 'Build Webhook Listener for Celo Mainnet',
      rewardUSDC: 35,
      points: 350,
    });

    assert.equal(progress.status, 'in_progress');

    const updated = getTaskById(taskId);
    assert.equal(updated.status, 'in_progress');
    assert.equal(updated.assignedWorkerTag, workerTag);
    assert.equal(updated.assignedWorkerAddress, workerAddress);
    assert.ok(updated.startedAt);
  });

  await t.test('4. Transitions task lifecycle: in_progress -> submitted (In Review)', async () => {
    const taskId = 'celo_task_1';
    const deliverable = 'https://github.com/nairatag-protocol/webhook-listener - PR #42 with live Celo RPC subscription tests passing.';

    const progress = await submitCeloTask({
      taskId,
      walletAddress: '0x7c269150bbab5a4208a0d0a8310ba9e2d7e4af26',
      deliverable,
      taskTitle: 'Build Webhook Listener for Celo Mainnet',
      rewardUSDC: 35,
      points: 350,
    });

    assert.equal(progress.status, 'submitted');

    const updated = getTaskById(taskId);
    assert.equal(updated.status, 'submitted');
    assert.equal(updated.submissionDeliverable, deliverable);
    assert.ok(updated.submittedAt);
  });

  await t.test('5. Transitions task lifecycle: submitted -> releasing -> paid (Settled)', () => {
    const taskId = 'celo_task_1';

    // Step A: Releasing
    updateTaskState(taskId, {
      status: 'releasing',
    });
    let task = getTaskById(taskId);
    assert.equal(task.status, 'releasing');
    assert.ok(task.escrowStatus.includes('Releasing'));

    // Step B: Paid & Settled
    const payoutHash = '0x1090dbd75d9e2e0a57ee5ad6d205fcf649eaa8df25912c551402074cca119981';
    const payoutDelivered = '50,680.00 cNGN';

    updateTaskState(taskId, {
      status: 'paid',
      payoutHash,
      payoutDelivered,
      payoutToken: 'cNGN',
      paidAt: Date.now(),
    });

    task = getTaskById(taskId);
    assert.equal(task.status, 'paid');
    assert.equal(task.payoutHash, payoutHash);
    assert.equal(task.payoutDelivered, payoutDelivered);
    assert.ok(task.escrowStatus.includes('Released'));
  });

  await t.test('6. listCeloTasks returns full durable tasks and progress mapping', async () => {
    const { tasks, progress } = await listCeloTasks();
    assert.ok(tasks.length >= 4);
    assert.ok(progress['celo_task_1']);
    assert.equal(progress['celo_task_1'].status, 'paid');
  });
});
