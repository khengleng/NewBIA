import { Router, Response } from 'express';
import { AuthenticatedRequest, getAuditLogs, authorize } from '../middleware/authorize';

const router = Router();

// Get audit logs (Admins only)
router.get('/', authorize('audit_log.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const logs = getAuditLogs();
        return res.json({ logs });
    } catch (error) {
        console.error('Audit log error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
