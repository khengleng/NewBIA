import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/jwt-auth';
import { generateSecureToken } from '../utils/security';
import { createSign } from 'crypto';
import axios from 'axios';
import { ethers } from 'ethers';

const router = Router();
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://blockchain-service:9100';

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

    const response = await axios.get(`${BLOCKCHAIN_SERVICE_URL}/api/blockchain/dcep/list`, {
      params: { owner: address },
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      return res.status(response.status).json({ code: response.status, msg: 'DCEP list failed' });
    }

    const items = (response.data?.items || []).map((item: any) => ({
      serial_number: item.serialNumber,
      owner: item.owner,
      money_type: item.moneyType,
      signature: item.signature,
    }));

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
    const privateKey = loadPrivateKey();
    if (!privateKey) {
      return res.status(500).json({ code: 500, msg: 'Central bank signing key not configured' });
    }

    const serialNumber = generateSecureToken(24);
    const signature = signSerialNumber(serialNumber, privateKey);
    const tokenId = ethers.toBigInt(ethers.hexlify(ethers.toUtf8Bytes(serialNumber))).toString();

    const dcep = {
      serial_number: serialNumber,
      owner: address,
      money_type: moneyType,
      signature,
    };

    const response = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/dcep/mint`,
      {
        ownerAddress: address,
        tokenId,
        moneyType,
        serialNumber,
        signature,
      },
      { validateStatus: () => true },
    );

    if (response.status >= 400) {
      return res.status(response.status).json({ code: response.status, msg: 'DCEP mint failed' });
    }

    return res.json({ code: 0, msg: 'success', result: dcep });
  } catch (error) {
    console.error('DCEP mint error:', error);
    return res.status(500).json({ code: 500, msg: 'failed' });
  }
});

router.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fromAddress = String(req.body?.fromAddress || '').toLowerCase();
    const fromPublicKey = String(req.body?.fromPublicKey || '').trim();
    const signedTransactionRawData = String(req.body?.signedTransactionRawData || '').trim();
    if (!fromAddress || !signedTransactionRawData) {
      return res.status(400).json({ code: 400, msg: 'fromAddress and signedTransactionRawData are required' });
    }

    if (fromPublicKey) {
      const computed = ethers.computeAddress(fromPublicKey);
      if (computed.toLowerCase() !== fromAddress) {
        return res.status(400).json({ code: 400, msg: 'fromPublicKey does not match fromAddress' });
      }
    }

    const response = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/dcep/transfer`,
      {
        fromAddress,
        signedTransactionRawData,
      },
      { validateStatus: () => true },
    );

    if (response.status >= 400) {
      return res.status(response.status).json({ code: response.status, msg: response.data?.error || 'DCEP transfer failed' });
    }

    return res.json({ code: 0, msg: 'success', result: response.data });
  } catch (error) {
    console.error('DCEP transfer error:', error);
    return res.status(500).json({ code: 500, msg: 'failed' });
  }
});

export default router;
