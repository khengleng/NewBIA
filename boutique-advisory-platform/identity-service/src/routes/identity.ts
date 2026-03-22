import { Router, Response } from 'express';

import { prisma } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/jwt-auth';

const router = Router();

router.post('/did/bind', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const did = String(req.body?.did || '').trim();
    if (!did) {
      return res.status(400).json({ error: 'DID is required' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        did,
        id: { not: user.id },
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'DID is already bound to another user' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { did }
    });

    return res.status(200).json({
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        firstName: updated.firstName,
        lastName: updated.lastName,
        did: updated.did,
      }
    });
  } catch (error) {
    console.error('Bind DID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
