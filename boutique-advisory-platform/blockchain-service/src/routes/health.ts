import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: config.mode, chainId: config.chainId });
});

export default router;
