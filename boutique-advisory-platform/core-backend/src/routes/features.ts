import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authorize';
import { getRoleFeatureConfig } from '../services/role-features';

const router = Router();

// Get feature flags for current user (used by UI gating)
router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const role = req.user?.role || '';
    const { config } = await getRoleFeatureConfig(tenantId, role);
    return res.json({ role, features: config });
  } catch (error) {
    console.error('Error fetching role features:', error);
    return res.status(500).json({ error: 'Failed to load feature configuration' });
  }
});

export default router;
