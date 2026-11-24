/**
 * @file api/tasks.js
 * @description Official Celo Tasks & Bounties Persistent REST API for NairaTag Protocol.
 * Backed by Supabase PostgreSQL `celo_tasks` table with global cross-client synchronization.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bbpdupijsgdghemfpijr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3mRhhwX9BhnJyobyCX7uWw_h2-idCPf';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/celo_tasks`;

  try {
    if (req.method === 'GET') {
      const response = await fetch(`${endpoint}?select=*&order=created_at.desc`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase query failed: ${response.status} ${response.statusText}`);
      }

      const tasks = await response.json();
      return res.status(200).json({
        ok: true,
        count: tasks.length,
        tasks,
      });
    }

    if (req.method === 'POST') {
      const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const row = {
        id: raw.id || `task_${Date.now()}`,
        chain_id: Number(raw.chainId || raw.chain_id || 42220),
        title: raw.title || 'Untitled Bounty',
        description: raw.description || '',
        category: raw.category || 'dev',
        category_label: raw.categoryLabel || raw.category_label || '⚡ Engineering',
        creator_tag: raw.creatorTag || raw.creator_tag || '₦YOU',
        creator_address: raw.creatorAddress || raw.creator_wallet || raw.creator_address || null,
        deliverable: raw.deliverable || '',
        reward_amount: Number(raw.rewardAmount || raw.reward_amount || raw.rewardUSDC || 0),
        reward_token: raw.rewardToken || raw.reward_token || 'USDT',
        reward_usdc: Number(raw.rewardUSDC || raw.reward_usdc || 0),
        reward_ngn: raw.rewardNGN || raw.reward_ngn || '',
        points: Number(raw.points || 0),
        deadline: raw.deadline || raw.deadline_label || '3 days left',
        applicants: Number(raw.applicants || 0),
        status: raw.status || 'open',
        escrow_status: raw.escrowStatus || raw.escrow_status || '🔒 Funded in Escrow',
        escrow_contract: raw.escrowContract || raw.escrow_contract || '0x9f3de805eAa94516d216d6f1add78860B291BB76',
        escrow_tx_hash: raw.escrowTxHash || raw.escrow_tx_hash || null,
        assigned_worker_tag: raw.assignedWorkerTag || raw.assigned_worker_tag || null,
        assigned_worker_address: raw.assignedWorkerAddress || raw.assigned_worker_address || null,
        submission_deliverable: raw.submissionDeliverable || raw.submission_deliverable || null,
        payout_hash: raw.payoutHash || raw.payout_hash || null,
        payout_delivered: raw.payoutDelivered || raw.payout_delivered || null,
        payout_token: raw.payoutToken || raw.payout_token || null,
        created_at: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(row),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase insert failed: ${response.status} - ${errText}`);
      }

      const inserted = await response.json();
      return res.status(201).json({
        ok: true,
        task: inserted[0] || row,
      });
    }

    if (req.method === 'PATCH') {
      const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const taskId = req.query?.id || raw.id;
      if (!taskId) {
        return res.status(400).json({ ok: false, error: 'Missing taskId' });
      }

      const updates = {};
      if (raw.status) updates.status = raw.status;
      if (raw.escrowStatus || raw.escrow_status) updates.escrow_status = raw.escrowStatus || raw.escrow_status;
      if (raw.assignedWorkerTag || raw.assigned_worker_tag) updates.assigned_worker_tag = raw.assignedWorkerTag || raw.assigned_worker_tag;
      if (raw.assignedWorkerAddress || raw.assigned_worker_address) updates.assigned_worker_address = raw.assignedWorkerAddress || raw.assigned_worker_address;
      if (raw.submissionDeliverable || raw.submission_deliverable) updates.submission_deliverable = raw.submissionDeliverable || raw.submission_deliverable;
      if (raw.payoutHash || raw.payout_hash) updates.payout_hash = raw.payoutHash || raw.payout_hash;
      if (raw.payoutDelivered || raw.payout_delivered) updates.payout_delivered = raw.payoutDelivered || raw.payout_delivered;
      if (raw.payoutToken || raw.payout_token) updates.payout_token = raw.payoutToken || raw.payout_token;
      updates.updated_at = new Date().toISOString();

      const response = await fetch(`${endpoint}?id=eq.${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase update failed: ${response.status} - ${errText}`);
      }

      const updated = await response.json();
      return res.status(200).json({
        ok: true,
        task: updated[0] || updates,
      });
    }

    return res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('[API /tasks Error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
