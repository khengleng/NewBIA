import { Router } from 'express';
import { config } from '../config';
import { listDcepOnBesu, mintDcepOnBesu, transferSignedDcepOnBesu } from '../services/besu-chain';

const router = Router();

router.post('/mint', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const ownerAddress = String(req.body?.ownerAddress || '').trim();
  const tokenId = String(req.body?.tokenId || '').trim();
  const moneyType = String(req.body?.moneyType || '').trim();
  const serialNumber = String(req.body?.serialNumber || '').trim();
  const signature = String(req.body?.signature || '').trim();

  if (!ownerAddress || !tokenId || !moneyType || !serialNumber || !signature) {
    return res.status(400).json({ error: 'Missing required fields for mint' });
  }

  if (config.mode === 'mock') {
    return res.json({ status: 'MOCK', txHash: '0xmock' });
  }

  try {
    const result = await mintDcepOnBesu({
      ownerAddress,
      tokenId,
      moneyType,
      serialNumber,
      signature,
    });
    return res.json({ status: 'MINTED', ...result });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'Mint failed' });
  }
});

router.get('/list', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const ownerAddress = String(req.query.owner || '').trim();
  if (!ownerAddress) {
    return res.status(400).json({ error: 'owner is required' });
  }

  if (config.mode === 'mock') {
    return res.json({ status: 'MOCK', items: [] });
  }

  try {
    const items = await listDcepOnBesu(ownerAddress);
    return res.json({ status: 'OK', items });
  } catch (error: any) {
    return res.status(500).json({ status: 'FAILED', error: error?.message || 'List failed' });
  }
});

router.post('/transfer', async (req, res) => {
  if (config.mode === 'disabled') {
    return res.status(503).json({ status: 'DISABLED', error: 'Blockchain gateway disabled' });
  }

  const signedRawTransaction = String(req.body?.signedTransactionRawData || '').trim();
  const fromAddress = String(req.body?.fromAddress || '').trim();
  const toAddress = String(req.body?.toAddress || '').trim();

  if (!signedRawTransaction || !fromAddress) {
    return res.status(400).json({ error: 'signedTransactionRawData and fromAddress are required' });
  }

  if (config.mode === 'mock') {
    return res.json({ status: 'MOCK', txHash: '0xmock' });
  }

  try {
    const result = await transferSignedDcepOnBesu({
      signedRawTransaction,
      expectedFrom: fromAddress,
      expectedTo: toAddress || undefined,
    });
    return res.json({ status: 'OK', ...result });
  } catch (error: any) {
    return res.status(400).json({ status: 'FAILED', error: error?.message || 'Transfer failed' });
  }
});

export default router;
