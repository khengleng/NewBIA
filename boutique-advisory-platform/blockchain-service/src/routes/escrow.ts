import { Router } from 'express';
import { config } from '../config';
import { escrowAllocateSchema, escrowCommitSchema, escrowRefundSchema } from '../lib/validators';
import { mockEscrowTx } from '../services/mock-chain';
import { allocateEscrowOnBesu, commitEscrowOnBesu, refundEscrowOnBesu } from '../services/besu-chain';

const router = Router();

router.post('/commit', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const parsed = escrowCommitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (config.mode === 'mock') {
    return res.json(mockEscrowTx());
  }

  try {
    const result = await commitEscrowOnBesu(parsed.data);
    return res.json({ status: 'SUBMITTED', ...result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Escrow commit failed' });
  }
});

router.post('/allocate', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const parsed = escrowAllocateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (config.mode === 'mock') {
    return res.json(mockEscrowTx());
  }

  try {
    const result = await Promise.all(
      parsed.data.allocations.map((alloc) =>
        allocateEscrowOnBesu({ offeringId: parsed.data.offeringId, investorId: alloc.investorId, tokens: alloc.tokens })
      )
    );
    return res.json({ status: 'SUBMITTED', results: result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Escrow allocation failed' });
  }
});

router.post('/refund', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const parsed = escrowRefundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (config.mode === 'mock') {
    return res.json(mockEscrowTx());
  }

  try {
    const result = await Promise.all(
      parsed.data.investors.map((investorId) =>
        refundEscrowOnBesu({ offeringId: parsed.data.offeringId, investorId, amount: 0 })
      )
    );
    return res.json({ status: 'SUBMITTED', results: result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Escrow refund failed' });
  }
});

export default router;
