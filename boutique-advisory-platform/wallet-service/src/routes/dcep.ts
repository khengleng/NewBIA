import { Router, Response } from 'express';
import axios from 'axios';
import type { AuthenticatedRequest } from '../middleware/jwt-auth';

const router = Router();

const TRADE_API_URL =
  process.env.TRADE_API_URL ||
  process.env.TRADING_API_URL ||
  process.env.RAILWAY_SERVICE_BIA_TRADE_API_INTERNAL_URL ||
  process.env.RAILWAY_SERVICE_BIA_TRADE_API_URL ||
  'http://bia-trade-api.railway.internal:8080';

function buildHeaders(req: AuthenticatedRequest) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (req.headers.authorization) {
    headers.authorization = String(req.headers.authorization);
  }
  if (req.headers.cookie) {
    headers.cookie = String(req.headers.cookie);
  }
  return headers;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const response = await axios.get(`${TRADE_API_URL}/v2/token`, {
      params: req.query,
      headers: buildHeaders(req),
      validateStatus: () => true,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('DCEP list proxy failed:', error?.message || error);
    return res.status(502).json({ code: 502, msg: 'DCEP list proxy failed' });
  }
});

router.post('/mint', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const response = await axios.post(`${TRADE_API_URL}/v2/token/mint`, req.body, {
      headers: buildHeaders(req),
      validateStatus: () => true,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('DCEP mint proxy failed:', error?.message || error);
    return res.status(502).json({ code: 502, msg: 'DCEP mint proxy failed' });
  }
});

router.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const response = await axios.post(`${TRADE_API_URL}/v2/token/transfer`, req.body, {
      headers: buildHeaders(req),
      validateStatus: () => true,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('DCEP transfer proxy failed:', error?.message || error);
    return res.status(502).json({ code: 502, msg: 'DCEP transfer proxy failed' });
  }
});

export default router;
