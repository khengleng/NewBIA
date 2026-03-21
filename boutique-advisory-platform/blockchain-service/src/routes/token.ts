import { Router } from 'express';
import { config } from '../config';
import { balanceSchema, mintSchema } from '../lib/validators';
import { mockMintToken } from '../services/mock-chain';
import { getTokenBalanceOnBesu, mintTokenOnBesu } from '../services/besu-chain';

const router = Router();

router.post('/mint', (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const parsed = mintSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (config.mode === 'mock') {
    return res.json(mockMintToken());
  }

  try {
    const result = await mintTokenOnBesu({
      tokenName: parsed.data.tokenName,
      tokenSymbol: parsed.data.tokenSymbol,
      totalTokens: parsed.data.totalTokens,
      ownerAddress: parsed.data.ownerAddress,
    });
    return res.json({ status: 'MINTED', ...result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Mint failed' });
  }
});

router.post('/balance', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const parsed = balanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (config.mode === 'mock') {
    return res.json({ balance: '0', decimals: 0, status: 'MOCK' });
  }

  try {
    const result = await getTokenBalanceOnBesu(parsed.data);
    return res.json({ status: 'OK', ...result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Balance lookup failed' });
  }
});

export default router;
