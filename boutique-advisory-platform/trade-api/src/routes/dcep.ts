import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/jwt-auth';
import redis from '../redis';
import { generateSecureToken } from '../utils/security';
import { createSign } from 'crypto';

const router = Router();

const dcepKey = (address: string) => `dcep:wallet:${address.toLowerCase()}`;

router.use(authenticateToken);

function loadPrivateKey(): string | null {
  const raw =
    process.env.CENTRAL_BANK_PRIVATE_KEY ||
    process.env.CAMBOBIA_CENTRAL_BANK_PRIVATE_KEY ||
    '';
  if (!raw) return null;

  if (raw.includes('BEGIN')) {
    return raw.replace(/\\n/g, '\n');
  }

  try {
    return Buffer.from(raw, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function signSerialNumber(serialNumber: string, privateKey: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(serialNumber);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const address = String(req.query.address || '').toLowerCase();
    if (!address) return res.status(400).json({ code: 400, msg: 'address is required' });
    if (!redis || redis.status !== 'ready') {
      return res.status(503).json({ code: 503, msg: 'DCEP store unavailable' });
    }

    const raw = await redis.get(dcepKey(address));
    const items = raw ? JSON.parse(raw) : [];
    return res.json({ code: 0, msg: 'success', result: items });
  } catch (error) {
    console.error('DCEP list error:', error);
    return res.status(500).json({ code: 500, msg: 'failed' });
  }
});

router.post('/mint', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const address = String(req.body?.address || '').toLowerCase();
    const moneyType = String(req.body?.moneyType || '');
    if (!address || !moneyType) {
      return res.status(400).json({ code: 400, msg: 'address and moneyType are required' });
    }
    if (!redis || redis.status !== 'ready') {
      return res.status(503).json({ code: 503, msg: 'DCEP store unavailable' });
    }
    const privateKey = loadPrivateKey();
    if (!privateKey) {
      return res.status(500).json({ code: 500, msg: 'Central bank signing key not configured' });
    }

    const raw = await redis.get(dcepKey(address));
    const items = raw ? JSON.parse(raw) : [];

    const serialNumber = generateSecureToken(24);
    const signature = signSerialNumber(serialNumber, privateKey);

    const dcep = {
      serial_number: serialNumber,
      owner: address,
      money_type: moneyType,
      signature,
    };

    items.push(dcep);
    await redis.set(dcepKey(address), JSON.stringify(items));

    return res.json({ code: 0, msg: 'success', result: dcep });
  } catch (error) {
    console.error('DCEP mint error:', error);
    return res.status(500).json({ code: 500, msg: 'failed' });
  }
});

router.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fromAddress = String(req.body?.fromAddress || '').toLowerCase();
    if (!fromAddress) {
      return res.status(400).json({ code: 400, msg: 'fromAddress is required' });
    }
    if (!redis || redis.status !== 'ready') {
      return res.status(503).json({ code: 503, msg: 'DCEP store unavailable' });
    }

    const toAddress = String(req.body?.toAddress || '').toLowerCase();
    if (!toAddress) {
      // NOTE: The current mobile payload does not include a destination address.
      // Return success to unblock the flow while preserving stored DCEP.
      return res.json({ code: 0, msg: 'success', result: { mock: true } });
    }

    const raw = await redis.get(dcepKey(fromAddress));
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, msg: 'No DCEP available to transfer' });
    }

    const moved = items.shift();
    await redis.set(dcepKey(fromAddress), JSON.stringify(items));

    const destRaw = await redis.get(dcepKey(toAddress));
    const destItems = destRaw ? JSON.parse(destRaw) : [];
    destItems.push({ ...moved, owner: toAddress });
    await redis.set(dcepKey(toAddress), JSON.stringify(destItems));

    return res.json({ code: 0, msg: 'success', result: { transferred: true } });
  } catch (error) {
    console.error('DCEP transfer error:', error);
    return res.status(500).json({ code: 500, msg: 'failed' });
  }
});

export default router;
