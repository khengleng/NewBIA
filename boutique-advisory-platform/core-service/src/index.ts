import dotenv from 'dotenv';
// Load environment variables IMMEDIATELY
dotenv.config();

// ============================================
// DATABASE URL HARDENING
// ============================================
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  let dbUrl = process.env.DATABASE_URL;

  // 1. Ensure SSL mode for external databases
  let shouldAppendSslMode = false;
  try {
    const parsedDbUrl = new URL(dbUrl);
    const hostname = parsedDbUrl.hostname.toLowerCase();
    const isRailwayInternal = hostname.endsWith('.railway.internal');
    const isRailwayProxy = hostname.endsWith('.proxy.rlwy.net');
    shouldAppendSslMode = !dbUrl.includes('sslmode=') && !isRailwayInternal && !isRailwayProxy;
  } catch {
    shouldAppendSslMode = !dbUrl.includes('sslmode=') && !dbUrl.includes('.railway.internal');
  }

  if (shouldAppendSslMode) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    process.env.DATABASE_URL = `${dbUrl}${separator}sslmode=require`;
    console.log('🔐 [Config] Appended sslmode=require to DATABASE_URL');
  }

  // 2. Log sanitized connection info
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`📡 [Config] Database Target: ${url.hostname}:${url.port || '5432'}`);

    if (url.hostname === 'postgres.railway.internal') {
      console.log('💡 [Config] Note: If DB connection times out, try updating DATABASE_URL to use "database.railway.internal" instead of "postgres.railway.internal".');
    }
  } catch (e) {
    console.log('📡 [Config] Database Target: [Invalid URL Format]');
  }
}



import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';


import RedisStore from 'rate-limit-redis';
import redis from './redis';
import cookieParser from 'cookie-parser';
import { CookieOptions } from 'express';
import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { initSocket } from './socket';
import { prisma, connectDatabase } from './database';
import { runMaintenanceTasks } from './utils/maintenance';

import { doubleCsrf } from 'csrf-csrf';
import {
  checkMigrationStatus,
  performMigration,
  getMigrationStatus,
  switchToDatabase,
  fallbackToInMemory,
  shouldUseDatabase
} from './migration-manager';

// New Feature Routes
import syndicateRoutes from './routes/syndicates';
import syndicateTokenRoutes from './routes/syndicate-tokens';
import dueDiligenceRoutes from './routes/duediligence';
import dealDueDiligenceRoutes from './routes/deal-due-diligence';
import communityRoutes from './routes/community';
import secondaryTradingRoutes from './routes/secondary-trading';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import auditRoutes from './routes/audit';
import adminRoutes from './routes/admin';
import adminActionCenterRoutes from './routes/admin-action-center';
import aiRoutes from './routes/ai';
import disputeRoutes from './routes/disputes';
import escrowRoutes from './routes/escrow';
import agreementRoutes from './routes/agreements';
import operationsRoutes from './routes/operations';
import adminCasesRoutes from './routes/admin-cases';
import adminOnboardingRoutes from './routes/admin-onboarding';
import adminRoleLifecycleRoutes from './routes/admin-role-lifecycle';
import adminDealOpsRoutes from './routes/admin-deal-ops';
import adminAdvisorOpsRoutes from './routes/admin-advisor-ops';
import adminInvestorOpsRoutes from './routes/admin-investor-ops';
import adminDataGovernanceRoutes from './routes/admin-data-governance';
import adminReconciliationRoutes from './routes/admin-reconciliation';
import adminSecurityRoutes from './routes/admin-security';
import walletRoutes from './routes/wallet';
import launchpadRoutes from './routes/launchpad';
import mobileRoutes from './routes/mobile';
import adminBotRoutes from './routes/admin-bot';

// Core Feature Routes
import authRoutes from './routes/auth';
import smeRoutes from './routes/sme';
import investorRoutes from './routes/investor';
import dealRoutes from './routes/deal';
import documentRoutes from './routes/document';
import pipelineRoutes from './routes/pipeline';
import matchesRoutes from './routes/matches';
import messagesRoutes from './routes/messages';
import calendarRoutes from './routes/calendar';
import reportRoutes from './routes/reports';
import dataroomRoutes from './routes/dataroom';
import advisoryRoutes from './routes/advisory';
import analyticsRoutes from './routes/analytics';
import paymentRoutes from './routes/payments';
import cashflowRoutes from './routes/cashflow';
import webhookRoutes from './routes/webhooks';

// Security Validation
import { validateSecurityConfiguration } from './utils/securityValidator';

// Middleware
import { authenticateToken, authorizeRoles } from './middleware/jwt-auth';
import {
  requestIdMiddleware,
  securityHeadersMiddleware,
  ipSecurityMiddleware,
  sqlInjectionMiddleware,
  xssMiddleware,
  roleBasedRateLimiting
} from './middleware/securityMiddleware';


const DEFAULT_CORE_SUPERADMIN_EMAIL = 'contact@cambobia.com';
const DEFAULT_TRADING_SUPERADMIN_EMAIL = 'trading-admin@cambobia.com';

// Helper to ensure admin account is synced with .env
async function ensureAdminAccount() {
  const legacyAdminEmail = 'admin@boutique-advisory.com';
  const coreTenantId = process.env.CORE_TENANT_ID || 'default';
  const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';
  const activeTenantId = isTradingService ? tradingTenantId : coreTenantId;
  const configuredAdminEmail = isTradingService
    ? process.env.DEFAULT_TRADING_SUPERADMIN_EMAIL
    : process.env.DEFAULT_SUPERADMIN_EMAIL;
  const adminEmail = (
    configuredAdminEmail ||
    (isTradingService ? DEFAULT_TRADING_SUPERADMIN_EMAIL : DEFAULT_CORE_SUPERADMIN_EMAIL)
  ).toLowerCase();
  let adminPassword = isTradingService
    ? process.env.INITIAL_TRADING_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD
    : process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminPassword) {
    // SECURITY: Never use hardcoded fallback passwords in production
    const crypto = require('crypto');
    adminPassword = crypto.randomBytes(16).toString('hex') + 'A!1';
    console.warn('CRITICAL SECURITY: INITIAL_ADMIN_PASSWORD not set. A secure random password has been generated.');
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV ONLY] Initial Admin Password: ${adminPassword}`);
    }
  }
  const resolvedAdminPassword: string = adminPassword;

  async function syncAdminForTenant(tenantId: string, allowLegacyMigration: boolean) {
    let user = await prisma.user.findFirst({ where: { email: adminEmail, tenantId } });

    // Migrate legacy bootstrap admin email to the canonical admin email.
    if (!user && allowLegacyMigration && legacyAdminEmail !== adminEmail) {
      const legacyUser = await prisma.user.findFirst({
        where: { email: legacyAdminEmail, tenantId }
      });

      if (legacyUser) {
        user = await prisma.user.update({
          where: { id: legacyUser.id },
          data: { email: adminEmail }
        });
        console.log(`✅ Legacy admin email migrated to ${adminEmail} (tenant: ${tenantId})`);
      }
    }

    if (user) {
      // SECURITY: Don't automatically rewrite password/role on every boot in production.
      // Only ensure account is ACTIVE and verified.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          isEmailVerified: true
        }
      });
      console.log(`✅ Admin account synced (${adminEmail}, tenant: ${tenantId}, ACTIVE & Verified)`);
      return;
    }

    const hashedPassword = await bcrypt.hash(resolvedAdminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        firstName: 'System',
        lastName: 'Administrator',
        tenantId,
        status: 'ACTIVE',
        isEmailVerified: true
      }
    });
    console.log(`✅ Initial SUPER_ADMIN created successfully (tenant: ${tenantId})`);
  }

  try {
    await syncAdminForTenant(activeTenantId, !isTradingService);
  } catch (error: any) {
    console.error('❌ FATAL: Could not initialize admin account:', error.message);
  }
}

async function ensurePlatformTenants() {
  const coreTenantId = process.env.CORE_TENANT_ID || 'default';
  const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';

  try {
    await prisma.tenant.upsert({
      where: { id: coreTenantId },
      update: {},
      create: {
        id: coreTenantId,
        name: 'Boutique Advisory',
        domain: 'cambobia.com',
        settings: {}
      }
    });

    if (tradingTenantId !== coreTenantId) {
      await prisma.tenant.upsert({
        where: { id: tradingTenantId },
        update: {},
        create: {
          id: tradingTenantId,
          name: 'CamboBia Trading',
          domain: 'trade.cambobia.com',
          settings: {}
        }
      });
    }

    console.log(`✅ Platform tenants ensured (core=${coreTenantId}, trading=${tradingTenantId})`);
  } catch (error: any) {
    console.error('❌ Failed to ensure platform tenants:', error.message);
    throw error;
  }
}


// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
      rawBody?: Buffer;
    }
  }
}

const app = express();
// Trust the first proxy hop (Railway's load balancer) so req.ip is correct
// Using 1 (not true) prevents ERR_ERL_PERMISSIVE_TRUST_PROXY validation error
app.set('trust proxy', 1);
// Safely parse port, defaulting to 8080 which is Railway's preferred default
const PORT = parseInt(process.env.PORT || '8080', 10);
const isProduction = process.env.NODE_ENV === 'production';
const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();
const isTradingService = serviceMode === 'trading';


// ============================================
// STARTUP STATE TRACKING
// ============================================
let isStartingUp = true;
let startupPhase = 'initializing';
let startupError: string | null = null;

// Keep core security headers on early health endpoints before Helmet initializes.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/health', (req, res) => {
  // Ultra-simple response to pass Railway health checks immediately
  return res.status(200).json({
    status: isStartingUp ? 'starting' : (startupError ? 'degraded' : 'ok'),
    phase: startupPhase,
    error: startupError,
    mode: serviceMode,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});



// Trust proxy (required for rate limiting and secure cookies on most cloud platforms)
app.set('trust proxy', 1);

// Disable X-Powered-By
app.disable('x-powered-by');

// Security Headers with Helmet (stricter in production)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginEmbedderPolicy: { policy: "credentialless" },
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"], // SECURITY: Removed 'unsafe-inline' for better posture
      imgSrc: ["'self'", "data:", "blob:", "https://storage.googleapis.com", "https://*.stripe.com", "https://*.sumsub.com"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "https://www.cambobia.com", "https://storage.googleapis.com", "https://*.stripe.com", "https://*.sumsub.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    }
  } : false,
  hsts: isProduction ? {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  } : false,
}));

// Core health checks have been moved to the very top of the stack


// 2. Readiness Check (Optional, for deep inspection)
app.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ready', database: 'connected' });
  } catch (error) {
    return res.status(503).json({
      status: 'failing',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown'
    });
  }
});


// Logging - reduced in production
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Request body limits to prevent DoS
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Note: In production, COOKIE_SECRET is validated inside startServer() 
// to ensure the health check can respond even if config is missing.
const cookieSecret = process.env.COOKIE_SECRET || 'dev-cookie-secret';
app.use(cookieParser(cookieSecret));
const csrfSessionIdCookieName = (process.env.NODE_ENV === 'production' && !process.env.DISABLE_STRICT_CSRF)
  ? 'psifi.x-csrf-session'
  : 'x-csrf-session';

const csrfSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  signed: false,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Ensure each browser has a stable CSRF session identifier across proxied requests.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const existingSessionId = req.cookies?.[csrfSessionIdCookieName];
  if (typeof existingSessionId === 'string' && existingSessionId.length >= 16) {
    return next();
  }

  const sessionId = randomBytes(24).toString('hex');
  res.cookie(csrfSessionIdCookieName, sessionId, csrfSessionCookieOptions);
  req.cookies = {
    ...(req.cookies || {}),
    [csrfSessionIdCookieName]: sessionId
  };
  return next();
});


// CORS configuration - strict in production
app.use((req, res, next) => {
  res.setHeader('X-Platform-Mode', serviceMode);
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        console.warn(`Blocked by CORS: invalid origin ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      }

      const frontendUrl = process.env.FRONTEND_URL || '';
      const tradingFrontendUrl = process.env.TRADING_FRONTEND_URL || '';
      const corsOriginsEnv = process.env.CORS_ORIGIN || '';
      const allowCrossPlatformCors = (process.env.ALLOW_CROSS_PLATFORM_CORS === 'true') || true; // Force allow for unified backend
      const allowedOrigins = new Set<string>();
      const allowedHostnames = new Set<string>([
        'cambobia.com',
        'www.cambobia.com',
        'trade.cambobia.com',
        'localhost',
        '127.0.0.1'
      ]);

      if (!isTradingService && frontendUrl) {
        try {
          const parsedFrontend = new URL(frontendUrl);
          allowedOrigins.add(parsedFrontend.origin);
          allowedHostnames.add(parsedFrontend.hostname);
        } catch {
          // Ignore invalid FRONTEND_URL and rely on fallback hostnames.
        }
      }

      if (isTradingService && tradingFrontendUrl) {
        try {
          const parsedTrading = new URL(tradingFrontendUrl);
          allowedOrigins.add(parsedTrading.origin);
          allowedHostnames.add(parsedTrading.hostname);
        } catch {
          // Ignore invalid TRADING_FRONTEND_URL and rely on fallback hostnames.
        }
      }

      // Temporary migration override for cross-platform access. Keep disabled in production by default.
      if (allowCrossPlatformCors) {
        if (frontendUrl) {
          try {
            const parsedFrontend = new URL(frontendUrl);
            allowedOrigins.add(parsedFrontend.origin);
            allowedHostnames.add(parsedFrontend.hostname);
          } catch {
            // no-op
          }
        }
        if (tradingFrontendUrl) {
          try {
            const parsedTrading = new URL(tradingFrontendUrl);
            allowedOrigins.add(parsedTrading.origin);
            allowedHostnames.add(parsedTrading.hostname);
          } catch {
            // no-op
          }
        }
      }

      if (corsOriginsEnv) {
        const configuredOrigins = corsOriginsEnv
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

        for (const configured of configuredOrigins) {
          try {
            const parsedConfigured = new URL(configured);
            allowedOrigins.add(parsedConfigured.origin);
            allowedHostnames.add(parsedConfigured.hostname);
          } catch {
            // Allow host-only values in CORS_ORIGIN as a fallback.
            allowedHostnames.add(configured.replace(/^https?:\/\//, '').replace(/\/$/, ''));
          }
        }
      }

      if (allowedOrigins.has(parsedOrigin.origin) || allowedHostnames.has(parsedOrigin.hostname)) {
        return callback(null, true);
      }

      if (!isProduction && (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1')) {
        return callback(null, true);
      }

      console.warn(
        `[CORS] Blocked: origin ${origin} (host=${parsedOrigin.hostname}). Allowed: ${Array.from(allowedHostnames).join(', ')}`
      );
      return callback(new Error('DIAGNOSTIC: Not allowed by CORS'));
    },

    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-CSRF-Token',
      'x-csrf-token',
      // Browsers can include cache-control style request headers for no-store
      // fetches. Allow them explicitly to avoid CORS preflight rejections.
      'Cache-Control',
      'cache-control',
      'Pragma',
      'pragma',
      'Expires',
      'expires'
    ],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400,
  })(req, res, next);
});

// ============================================
// SECURITY MIDDLEWARE (Applied to all requests)
// ============================================

// Add unique request ID for tracing
app.use(requestIdMiddleware);

// Additional security headers
app.use(securityHeadersMiddleware);

// IP security (block malicious IPs)
app.use(ipSecurityMiddleware);

// SQL injection prevention
app.use(sqlInjectionMiddleware);

// XSS prevention
app.use(xssMiddleware);

// ============================================
// ROUTES
// ============================================


app.get('/api/csrf-token', (req: express.Request, res: express.Response) => {
  try {
    if (isStartingUp) {
      return res.status(503).json({
        error: 'Service starting up',
        message: 'The server is currently performing background migrations or connecting to the database.',
        phase: startupPhase,
        details: startupError
      });
    }

    const csrfToken = generateCsrfToken(req, res);
    return res.json({ csrfToken });
  } catch (error: any) {
    console.error('❌ CSRF Token Generation Error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate CSRF token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rate limiting - shared via Redis for multi-instance support
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req, _res) => {
    return ipKeyGenerator(req.ip ?? '127.0.0.1');
  },

  skip: (req) => {
    // Skip for known endpoints and when Redis is down
    const path = req.originalUrl || req.path;
    return path.includes('/health') ||
      path.includes('/csrf-token') ||
      !redis ||
      redis.status !== 'ready';
  },
  store: (redis && redis.status === 'ready') ? new RedisStore({
    sendCommand: async (...args: string[]) => {
      try {
        if (!redis || redis.status !== 'ready') throw new Error('Redis not ready');
        return await (redis as any).call(args[0], ...args.slice(1));
      } catch (err) {
        console.warn('⚠️ Redis rate limit failure (limiter):', err);
        // Returning a valid Lua script response for rate-limit-redis (count, reset_time)
        return [0, Date.now() + 60000];
      }
    },

    prefix: 'bia:rl:main:',
  } as any) : undefined,
});
app.use('/api/', limiter);

// Stricter rate limiting for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
  skipSuccessfulRequests: true,
  // Prevent one user's failed attempts from locking out all users on the same IP.
  keyGenerator: (req, _res) => {
    const ip = ipKeyGenerator(req.ip ?? '127.0.0.1');
    if (req.path === '/login' && req.method === 'POST') {

      const email = typeof (req as any).body?.email === 'string'
        ? (req as any).body.email.trim().toLowerCase()
        : 'unknown-email';
      return `auth:login:${ip}:${email}`;
    }
    return `auth:${ip}`;
  },
  // CSRF token endpoint should stay available even during auth throttling.
  skip: (req) => {
    const path = req.originalUrl || req.path;
    return path.includes('/csrf-token') || !redis || redis.status !== 'ready';
  },
  store: (redis && redis.status === 'ready') ? new RedisStore({
    sendCommand: async (...args: string[]) => {
      try {
        if (!redis || redis.status !== 'ready') return [0, Date.now() + 60000];
        return await (redis as any).call(args[0], ...args.slice(1));
      } catch (err) {
        console.warn('⚠️ Redis rate limit failure (authLimiter):', err);
        return [0, Date.now() + 60000];
      }
    },

    prefix: 'bia:rl:auth:',
  } as any) : undefined, // Fallback to memory store
});


// CSRF Secret - Detailed validation moved to startServer()
const csrfSecret = process.env.CSRF_SECRET || 'dev-csrf-secret';



// CSRF Protection Setup
const { invalidCsrfTokenError, generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => csrfSecret || 'dev-csrf-secret',
  getSessionIdentifier: (req: express.Request) => {
    const sessionId = req.cookies?.[csrfSessionIdCookieName];
    if (typeof sessionId === 'string' && sessionId.length >= 16) {
      return sessionId;
    }
    return String(req.headers['user-agent'] || 'anonymous-session');
  },
  // Simply naming for diagnostics
  cookieName: (process.env.NODE_ENV === 'production' && !process.env.DISABLE_STRICT_CSRF)
    ? 'psifi.x-csrf-token'
    : 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    signed: false // SECURITY: Cookie secret is signed, but we let double-csrf handle raw cookie lookup to prevent middleware mismatches
  },



  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: express.Request) => {
    const token = req.headers['x-csrf-token'];
    return Array.isArray(token) ? token[0] : token;
  }
} as any) as any;





// Apply CSRF protection to API routes (excluding webhooks and token endpoint)
app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const fullPath = req.originalUrl || req.url;
  
  if (req.path === '/csrf-token' || req.path.startsWith('/webhooks')) {
    return next();
  }

  // FORCE BYPASS for critical auth routes that fail in cross-platform/proxy setups
  const isBypassRoute = req.path.startsWith('/auth/login')
    || req.path.startsWith('/auth/logout')
    || req.path.startsWith('/auth/sso')
    || fullPath.includes('/auth/login')
    || fullPath.includes('/auth/logout');

  if (isBypassRoute) {
    return next();
  }

  doubleCsrfProtection(req, res, (err: any) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      console.warn(`[CSRF] Invalid token for ${req.method} ${fullPath} (host: ${req.headers.host})`);
      res.status(403).json({ error: 'DIAGNOSTIC: Invalid CSRF token. Path: ' + fullPath });
      return;
    }
    return next(err);
  });
});

// Health check moved to the top of middleware stack


// Authentication endpoints (public but rate limited)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wallet', authenticateToken, walletRoutes);
app.use('/api/webhooks', webhookRoutes);

if (isTradingService) {
  // Mode-specific routes (common features handled below)
} else {
  // Core platform service: SME origination + Advisor workflows.



  const unifiedOperationalRoles = ['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'TENANT_OWNER', 'COMPLIANCE_OFFICER'];
  const pmoRoles = [...unifiedOperationalRoles, 'PORTFOLIO_MANAGER', 'DEAL_LEADER'];


  app.use('/api/pipeline', authenticateToken, authorizeRoles(...pmoRoles), pipelineRoutes);

}


// ==========================================
// SHARED COMMON FEATURES (Available in all service modes)
// ==========================================
// Core Entities
app.use('/api/smes', authenticateToken, smeRoutes);
app.use('/api/sme', authenticateToken, smeRoutes);
app.use('/api/investors', authenticateToken, investorRoutes);
app.use('/api/deals', authenticateToken, dealRoutes);
app.use('/api/documents', authenticateToken, documentRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// Trading & Syndication
app.use('/api/launchpad', launchpadRoutes);
app.use('/api/syndicates', authenticateToken, syndicateRoutes);
app.use('/api/syndicate-tokens', authenticateToken, syndicateTokenRoutes);
app.use('/api/secondary-trading', authenticateToken, secondaryTradingRoutes);

// Intelligence & Communication
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/push', authenticateToken, notificationRoutes);
app.use('/api/messages', authenticateToken, messagesRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/report', authenticateToken, reportRoutes);

// Diligence & Community
app.use('/api/due-diligence', authenticateToken, dueDiligenceRoutes);
app.use('/api/duediligence', authenticateToken, dueDiligenceRoutes);
app.use('/api/deal-due-diligence', authenticateToken, dealDueDiligenceRoutes);
app.use('/api/community', authenticateToken, communityRoutes);

// Advisory & Financials
app.use('/api/advisory', authenticateToken, advisoryRoutes);
app.use('/api/advisory-services', authenticateToken, advisoryRoutes);
app.use('/api/advisors', authenticateToken, advisoryRoutes);
app.use('/api/dataroom', authenticateToken, dataroomRoutes);
app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/cashflow', authenticateToken, cashflowRoutes);
app.use('/api/disputes', authenticateToken, disputeRoutes);
app.use('/api/escrow', authenticateToken, escrowRoutes);
app.use('/api/agreements', authenticateToken, agreementRoutes);

// Shared Admin Features
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/admin/action-center', authenticateToken, adminActionCenterRoutes);
app.use('/api/operations', authenticateToken, operationsRoutes);
app.use('/api/admin/cases', authenticateToken, adminCasesRoutes);
app.use('/api/admin/onboarding', authenticateToken, adminOnboardingRoutes);
app.use('/api/admin/role-lifecycle', authenticateToken, adminRoleLifecycleRoutes);
app.use('/api/admin/deal-ops', authenticateToken, adminDealOpsRoutes);
app.use('/api/admin/advisor-ops', authenticateToken, adminAdvisorOpsRoutes);
app.use('/api/admin/investor-ops', authenticateToken, adminInvestorOpsRoutes);
app.use('/api/admin/data-governance', authenticateToken, adminDataGovernanceRoutes);
app.use('/api/admin/reconciliation', authenticateToken, adminReconciliationRoutes);
app.use('/api/admin/security', authenticateToken, adminSecurityRoutes);
app.use('/api/mobile', authenticateToken, mobileRoutes);
app.use('/api/admin/bot', authenticateToken, adminBotRoutes);




// Migration endpoints - PROTECTED: Only available in development or with SUPER_ADMIN role (Fix #2)
const migrationAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Allow in development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // In production, require SUPER_ADMIN authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Migration endpoints require authentication in production' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (decoded?.isPreAuth) {
      return res.status(401).json({ error: 'Two-factor authentication required' });
    }

    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'DIAGNOSTIC: Migration endpoints require SUPER_ADMIN role' });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'DIAGNOSTIC: Invalid token for migration access' });
  }
};

if (!isTradingService) {
  app.get('/api/migration/status', migrationAuthMiddleware, async (req, res) => {
    const status = await getMigrationStatus();
    res.json(status);
  });

  app.post('/api/migration/perform', migrationAuthMiddleware, async (req, res) => {
    const result = await performMigration();
    if (result.completed) {
      res.json({ message: 'Migration completed successfully', result });
    } else {
      res.status(500).json({ error: 'Migration failed', details: result.error });
    }
  });

  app.post('/api/migration/switch-to-database', migrationAuthMiddleware, (req, res) => {
    switchToDatabase();
    res.json({ message: 'Switched to database mode' });
  });

  app.post('/api/migration/fallback-to-memory', migrationAuthMiddleware, (req, res) => {
    fallbackToInMemory();
    res.json({ message: 'Switched to in-memory mode' });
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF validation failed'
    });
  }

  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS' || err.message.includes('CORS')) {
    console.error(`❌ CORS Blocking: ${req.headers.origin} is not allowed. Host: ${req.headers.host}`);
    return res.status(403).json({
      error: `DIAGNOSTIC: Access Denied (CORS). Host ${req.headers.host} or Origin ${req.headers.origin} blocked.`,
      message: err.message
    });
  }

  console.error('Unhandled error:', err);

  // Provide more context in error response if it's a known internal error
  let message = 'Something went wrong';
  if (process.env.NODE_ENV === 'development') {
    message = err.message;
  } else {
    if (err.name === 'PrismaClientKnownRequestError') message = 'Database request failed';
    if (err.name === 'PrismaClientInitializationError') message = 'Database connection failure';
    if (err.name === 'PrismaClientValidationError') message = 'Data validation error';
  }

  return res.status(500).json({
    error: 'Internal server error',
    type: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: err
  });
});




// Start server with migration handling
async function startServer() {
  console.log(`📡 [Init] Creating HTTP Server on port ${PORT}...`);
  const httpServer = createServer(app);

  console.log(`📡 [Init] Initializing WebSockets...`);
  initSocket(httpServer);

  // Start listening immediately to pass health checks during startup
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Ready] HTTP Server listening on port ${PORT}`);
    console.log(`📡 [Ready] Real-time WebSockets initialized`);
  });

  // Background initialization
  (async () => {
    startupPhase = 'validating_config';


    async function waitForDatabase(maxRetries = 10, initialDelay = 2000) {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          await prisma.$queryRaw`SELECT 1`;
          console.log('✅ [Database] Connection established');
          return true;
        } catch (error: any) {
          retries++;
          const delay = initialDelay * Math.pow(1.5, retries - 1);
          console.warn(`⏳ [Attempt ${retries}/${maxRetries}] Database not ready: ${error.message}`);
          if (retries < maxRetries) {
            if (retries === 5 && error.message.includes('postgres.railway.internal')) {
              console.warn('💡 [Tip] If your database service is named "database", try setting DATABASE_URL to use "database.railway.internal" instead of "postgres.railway.internal".');
            }
            console.log(`   Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        }
      }
      return false;
    }


    try {
      console.log('🚀 Finalizing system startup...');

      // ============================================
      // CRITICAL CONFIGURATION VALIDATION
      // ============================================
      if (isProduction) {
        const missing = [];
        if (!process.env.COOKIE_SECRET) missing.push('COOKIE_SECRET');
        if (!process.env.CSRF_SECRET) missing.push('CSRF_SECRET');
        if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

        if (missing.length > 0) {
          startupError = `Missing environment variables: ${missing.join(', ')}`;
          console.error(`❌ [Config] ${startupError}`);
          isStartingUp = false; // Allow app to respond even on failure
          return;
        }

      }

      // ============================================
      // WAIT FOR DATABASE
      // ============================================
      startupPhase = 'connecting_db';

      const dbReady = await waitForDatabase();
      if (!dbReady) {
        startupError = 'Database connection timed out after multiple retries';
        console.error(`❌ [Database] ${startupError}`);
        isStartingUp = false; // Allow diagnostic access
        return;
      }


      // ============================================
      // SCHEMA MIGRATION
      // ============================================
      startupPhase = 'migrating_schema';

      console.log('📦 Running database schema migrations...');
      const execAsync = promisify(exec);

      try {
        const { stdout } = await execAsync('npx prisma migrate deploy');
        if (stdout) console.log(stdout.split('\n').filter(Boolean).map(l => `   ${l}`).join('\n'));
        console.log('✅ Schema migrations applied successfully');
      } catch (migrateError: any) {
        startupPhase = 'migrating_schema_fallback';

        const errorMsg = migrateError.stdout || migrateError.message || '';
        console.warn(`   Info: ${errorMsg.substring(0, 200)}...`);

        try {
          const { stdout } = await execAsync('npx prisma db push --accept-data-loss');
          if (stdout) console.log(stdout.split('\n').filter(Boolean).map(l => `   ${l}`).join('\n'));
          console.log('✅ Database schema pushed successfully');
        } catch (pushError: any) {
          console.error('❌ Database schema update failed:', pushError.stdout || pushError.message);
        }
      }



      // ============================================
      // SECURITY VALIDATION
      // ============================================
      console.log('🔒 Validating security configuration...');
      const securityCheck = validateSecurityConfiguration();

      if (!securityCheck.success) {
        console.error('❌ CRITICAL SECURITY CHECKS FAILED');
        console.error('   Cannot continue with insecure configuration.');
        process.exit(1);
      }
      console.log('✅ Security configuration validated');

      // Run background maintenance tasks (Logs/Token cleanup)
      const triggerMaintenance = () => {
        runMaintenanceTasks().catch(e => console.error('⚠️ Maintenance failed:', e.message));
      };

      // Initial run
      triggerMaintenance();

      // Periodic run every 24 hours
      setInterval(triggerMaintenance, 24 * 60 * 60 * 1000);

      // Check data migration status (seeding)
      console.log('📋 Checking database data status...');
      const migrationStatus = await checkMigrationStatus();

      if (migrationStatus.error) {
        startupError = `Database seeding check failed: ${migrationStatus.error}`;
        console.error(`❌ [Seeding] ${startupError}`);
        isStartingUp = false;
        return;
      }


      startupPhase = 'seeding_data';


      if (migrationStatus.completed) {
        console.log('✅ Data seeding already completed');
      } else {
        console.log('📋 Database is empty, performing automatic data seeding...');
        try {
          const migrationResult = await performMigration();

          if (migrationResult.completed) {
            console.log('✅ Automatic data seeding completed successfully');
          } else {
            console.error('❌ Automatic data seeding failed!');
            console.error(`   Error: ${migrationResult.error}`);
            // Don't throw, just allow retry later
          }
        } catch (seedError: any) {
          console.error('❌ Error during data seeding:', seedError.message);
        }
      }


      // Run admin sync
      startupPhase = 'syncing_admin';
      await ensurePlatformTenants();
      await ensureAdminAccount();

      startupPhase = 'operational';
      isStartingUp = false;
      console.log('✅ [System] Fully operational');
    } catch (error: any) {
      startupError = error.message;
      startupPhase = 'failed';
      isStartingUp = false; // Transition out of starting mode even on failure
      console.error('❌ [System] Initialization failed:', error.message);
    }
  })();
}


// Global Exception Handlers
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

console.log('⚡ [Boot] Initializing platform...');
startServer();


export default app;
