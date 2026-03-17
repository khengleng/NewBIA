import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { cmApiClient } from '../config/external-services';
import { prisma } from '../database';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
    did?: string;
  };
  tenantId?: string;
}

// Middleware to extract tenant from request
export const extractTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Extract tenant from subdomain or header
    const tenantId = req.headers['x-tenant-id'] as string ||
      req.subdomains[0] ||
      process.env.DEFAULT_TENANT_ID || 'default';

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    req.tenantId = tenantId;
    next();
    return;
  } catch (error) {
    console.error('Tenant extraction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to authenticate using CM Keycloak
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.substring(7);

    // Verify token with CM Keycloak
    try {
      const response = await cmApiClient.post('/auth/realms/master/protocol/openid-connect/userinfo', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const userInfo = response.data;

      // Find user in our database
      const user = await prisma.user.findFirst({
        where: {
          email: userInfo.email,
          tenantId: req.tenantId
        },
        include: {
          tenant: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found in tenant' });
      }

      req.user = {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        did: user.did || undefined
      };

      next();
      return;
    } catch (keycloakError) {
      console.error('Keycloak verification failed:', keycloakError instanceof Error ? keycloakError.message : 'Unknown error');
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Role-based authorization middleware
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
    return;
  };
};

// DID integration middleware
export const extractDid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.did) {
      // User already has DID, continue
      next();
      return;
    }

    // Extract DID from DID infrastructure if available
    const didHeader = req.headers['x-did'] as string;
    if (didHeader) {
      // Update user with DID
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { did: didHeader }
      });
      req.user!.did = didHeader;
    }

    next();
  } catch (error) {
    console.error('DID extraction error:', error);
    next(); // Continue even if DID extraction fails
  }
};
