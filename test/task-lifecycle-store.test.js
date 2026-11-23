import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDurableTasks,
  saveDurableTask,
  updateTaskState,
  getTaskById,
  resetDurableTasks,
  SEED_TASKS,
  CELO_VERIFIED_ESCROW_TX,
} from '../src/services/durableTaskStore.js';
import { listCeloTasks, startCeloTask, submitCeloTask } from '../src/services/celoTasks.js';
import {
  getTaskChatMessages,
  sendTaskChatMessage,
  generateAgentTaskReply,
} from '../src/services/taskChatService.js';

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

  await t.test('7. Validates Celo Mainnet verified escrow deposit hash on seed tasks', () => {
    const tasks = getDurableTasks();
    assert.ok(tasks.length > 0);
    tasks.forEach((t) => {
      if (t.escrowTxHash) {
        assert.match(t.escrowTxHash, /^0x[0-9a-fA-F]{64}$/, 'Escrow tx hash must be a valid 64-char EVM hex hash');
      }
    });
    assert.equal(CELO_VERIFIED_ESCROW_TX, '0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7');
  });

  await t.test('8. Initializes in-place task workspace chat with chronological milestone logs', () => {
    const task = getTaskById('celo_task_1');
    const messages = getTaskChatMessages(task.id, task);
    assert.ok(Array.isArray(messages));
    assert.ok(messages.length >= 1, 'Should contain at least the initial Escrow Funded log');

    const escrowEvent = messages.find((m) => m.senderTag === 'ESCROW');
    assert.ok(escrowEvent, 'Must contain escrow lock milestone event');
    assert.ok(escrowEvent.text.includes('Milestone Escrow Funded'));
  });

  await t.test('9. Sends in-place project workspace message and appends to chat stream', async () => {
    const task = getTaskById('celo_task_1');
    const res = await sendTaskChatMessage(task.id, {
      sender: '0x653f773C9062e71A6554b42a9525fcD47fCC1693',
      senderTag: '₦SEGUN',
      text: 'Deliverable has been completed and verified with test suite passing.',
      isAgent: false,
    }, task);

    assert.ok(res);
    assert.ok(res.message);
    assert.equal(res.message.senderTag, '₦SEGUN');
    assert.ok(res.allMessages.length >= 2);
  });

  await t.test('10. Generates contextual intelligent agent replies for task milestones', () => {
    const task = getTaskById('celo_task_1');
    const reply1 = generateAgentTaskReply(task, 'I have completed and submitted the PR');
    assert.ok(reply1.includes('deliverable') || reply1.includes('review'));

    const reply2 = generateAgentTaskReply(task, 'Is the escrow locked safely on Celo?');
    assert.ok(reply2.includes('Milestone Escrow') || reply2.includes('Celo Mainnet'));

    const reply3 = generateAgentTaskReply(task, 'What are the requirements?');
    assert.ok(reply3.includes(task.title) || reply3.includes('deliverable'));
  });
});
