import { Router, Request, Response, NextFunction } from 'express';

import bcrypt from 'bcryptjs';

import { clearAuthCookies, getAuthCookieNames, issueTokensAndSetCookies } from '../utils/auth-utils';
import { getTenantId } from '../utils/tenant-utils';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import {
  validatePasswordStrength,
  generateSecureToken,
  hashToken,
  logAuditEvent,
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
  sanitizeEmail,
  encryptData,
  decryptData
} from '../utils/security';
import { isBreachedPassword } from '../utils/breached-passwords';
import { getPlatformFrontendUrl, sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../utils/email';
import { generateMfaSecret, generateQrCode, verifyMfaToken, generateBackupCodes } from '../utils/mfa';
import {
  authenticateToken,
  AuthenticatedRequest
} from '../middleware/jwt-auth';
import redis from '../redis';
import { isAdminLikeRole, normalizeRole } from '../lib/roles';

const router = Router();
const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();
const isTradingService = serviceMode === 'trading';
const coreTenantId = process.env.CORE_TENANT_ID || 'default';
const ssoTokenTtlSeconds = Number(process.env.SSO_TOKEN_TTL_SECONDS || 120);
const ssoAllowedRoles = new Set(['INVESTOR']);
const tradingLocalAllowedRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'SUPPORT', 'INVESTOR']);
const defaultCoreSuperadminEmail = 'contact@cambobia.com';
const defaultTradingSuperadminEmail = 'trading-admin@cambobia.com';

router.use((_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

function getSsoInternalApiKey(): string {
  const key = process.env.SSO_INTERNAL_API_KEY;
  if (!key) {
    throw new Error('SSO_INTERNAL_API_KEY not configured');
  }
  return key;
}

function getCoreSsoConsumeUrl(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.CORE_SSO_CONSUME_URL) {
    throw new Error('CORE_SSO_CONSUME_URL not configured');
  }
  return process.env.CORE_SSO_CONSUME_URL || 'http://backend.railway.internal:8080/api/auth/sso/trading/consume';
}

async function consumeSsoCodeOnce(code: string): Promise<any | null> {
  const redisKey = `sso:trading:code:${code}`;
  const lua = `
    local value = redis.call('GET', KEYS[1])
    if value then
      redis.call('DEL', KEYS[1])
    end
    return value
  `;
  const payload = await redis.eval(lua, 1, redisKey) as string | null;
  if (!payload) return null;
  return JSON.parse(payload);
}

function getTradingFrontendBaseUrl(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.TRADING_FRONTEND_URL) {
    throw new Error('TRADING_FRONTEND_URL not configured');
  }
  return (process.env.TRADING_FRONTEND_URL || 'https://trade.cambobia.com').replace(/\/+$/, '');
}

function isTradingRequest(req: Request): boolean {
  // Check cookie naming first
  if (getAuthCookieNames(req).accessToken.startsWith('tr_')) return true;
  
  // Hard check on host for login requests or when cookies aren't set yet
  const hostCandidates = [
    String(req.headers['x-forwarded-host'] || '').split(',')[0].trim(),
    String(req.headers['host'] || '').trim(),
    req.hostname
  ];
  return hostCandidates.some(h => h && (
    h === 'trade.cambobia.com' || 
    h.endsWith('.trade.cambobia.com') || 
    h.includes('trading.railway') || 
    h.includes('trade-')
  ));
}

function getCoreSuperadminEmail(): string {
  return (process.env.DEFAULT_SUPERADMIN_EMAIL || defaultCoreSuperadminEmail).toLowerCase();
}

function getTradingSuperadminEmail(): string {
  return (process.env.DEFAULT_TRADING_SUPERADMIN_EMAIL || defaultTradingSuperadminEmail).toLowerCase();
}

function getRequestFrontendBaseUrl(req: Request): string {
  return getPlatformFrontendUrl(isTradingRequest(req));
}

async function findUserForPlatformEmail(req: Request, email: string) {
  const tenantId = getTenantId(req);
  const normalizedEmail = email.toLowerCase();
  console.log(`🔍 [AUTH] findUserForPlatformEmail: Searching for ${normalizedEmail} in primary tenant ${tenantId}`);

  let user = await prisma.user.findFirst({
    where: { email: normalizedEmail, tenantId }
  });

  if (user) return user;

  console.log(`🔍 [AUTH] findUserForPlatformEmail: User not found in ${tenantId}. Checking core tenant check: isTradingRequest=${isTradingRequest(req)}, coreTenantId=${coreTenantId}`);
  const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';

  if (normalizedEmail === getCoreSuperadminEmail()) {
    user = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: coreTenantId }
    });
    if (user) return user;
  }

  if (normalizedEmail === getTradingSuperadminEmail()) {
    const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';
    user = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: tradingTenantId }
    });
    if (user) return user;
  }

  // Cross-tenant fallback for trading service: Look for investors/users in core tenant
  // if not found in the dedicated 'trade' tenant.
  if (isTradingRequest(req) && tenantId !== coreTenantId) {
    console.log(`🔍 [AUTH] findUserForPlatformEmail: Trading request fallback to core tenant ${coreTenantId}`);
    user = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: coreTenantId }
    });
    if (user) return user;
  }

  console.warn(`🔍 [AUTH] findUserForPlatformEmail: User ${normalizedEmail} NOT FOUND in any searched tenants.`);
  return null;
}

function getEmailDeliveryFailureMessage(): string {
  return 'Verification email could not be sent right now. Please try again shortly or contact support.';
}

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    if (isTradingService || isTradingRequest(req)) {
      return res.status(403).json({
        error: 'Trading accounts are provisioned separately for trade.cambobia.com. Contact the trading platform administrator.'
      });
    }

    const { email, password, role, firstName, lastName } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const tenantId = getTenantId(req); // Derive tenantId server-side

    // Validate required fields
    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, role, firstName, lastName'
      });
    }

    // SECURITY: Sanitize and validate email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // SECURITY: Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // SECURITY: Check for breached passwords
    if (await isBreachedPassword(password)) {
      return res.status(400).json({
        error: 'This password has been found in a data breach and is unsafe to use. Please choose a different password.'
      });
    }

    // Check for active conflict (exact email match in this tenant)
    const activeUser = await prisma.user.findFirst({
      where: {
        email: { equals: sanitizedEmail, mode: 'insensitive' },
        tenantId,
        status: { not: 'DELETED' }
      }
    });

    if (activeUser) {
      // SECURITY: Log attempt to register with existing email
      await logAuditEvent({
        userId: 'anonymous',
        action: 'REGISTER_ATTEMPT',
        resource: 'user',
        details: { email: sanitizedEmail, reason: 'email_exists' },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Email already registered'
      });
      return res.status(409).json({
        error: 'User already exists with this email'
      });
    }

    // Archive any existing soft-deleted or legacy record to avoid unique index collision.
    // NOTE: Do not hard-delete users here because relational records can block deletion.
    const usersToPurge = await prisma.user.findMany({
      where: {
        tenantId,
        email: { equals: sanitizedEmail, mode: 'insensitive' }
      }
    });

    for (const u of usersToPurge) {
      if (u.status === 'DELETED' || u.email.toLowerCase().includes('deleted_')) {

        try {
          const archivedEmail = `deleted_${Date.now()}_${u.id}_${u.email}`;
          await prisma.user.update({
            where: { id: u.id },
            data: {
              status: 'DELETED' as any,
              email: archivedEmail
            }
          });
        } catch (e) {
          console.error(`[AUTH] Error archiving ${u.id}:`, e);
        }
      }
    }

    // Hash password with strong hashing
    const hashedPassword = await bcrypt.hash(password, 12);

    // SECURITY: Restrict roles for public registration to prevent privilege escalation.
    // Administrative roles must still be manually assigned.
    const allowedPublicRoles = ['SME', 'INVESTOR', 'ADVISOR'];
    if (!allowedPublicRoles.includes(role)) {
      await logAuditEvent({
        userId: 'anonymous',
        action: 'REGISTER_BLOCKED',
        resource: 'user',
        details: { email: sanitizedEmail, attemptedRole: role },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Unauthorized role registration'
      });
      return res.status(403).json({
        error: 'Unauthorized role. Please contact support for administrative access.'
      });
    }

    // Create user with Verification Token
    const verificationToken = generateSecureToken(32);
    const hashedVerificationToken = hashToken(verificationToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        role: role as any,
        firstName,
        lastName,
        tenantId,
        status: 'PENDING', // Require email verification to become ACTIVE
        isEmailVerified: false,
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry: verificationExpires,
        language: 'EN'
      }
    });

    // Create role-specific profile
    if (role === 'SME') {
      await prisma.sME.create({
        data: {
          userId: user.id,
          tenantId,
          name: `${firstName} ${lastName}`,
          sector: req.body.sector || 'General',
          stage: 'SEED',
          fundingRequired: req.body.fundingRequired || 0,
          status: 'DRAFT'
        }
      });
    } else if (role === 'INVESTOR') {
      await prisma.investor.create({
        data: {
          userId: user.id,
          tenantId,
          name: `${firstName} ${lastName}`,
          type: req.body.investorType || 'ANGEL',
          kycStatus: 'PENDING'
        }
      });
    } else if (role === 'ADVISOR') {
      await prisma.advisor.create({
        data: {
          userId: user.id,
          tenantId,
          name: `${firstName} ${lastName}`,
          specialization: req.body.specialization || ['General'],
          certificationList: req.body.certifications || [],
          status: 'ACTIVE'
        }
      });
    }

    const verificationEmailResult = await sendVerificationEmail(
      user.email,
      verificationToken,
      getRequestFrontendBaseUrl(req)
    );
    if (!verificationEmailResult.success) {
      await logAuditEvent({
        userId: user.id,
        action: 'VERIFICATION_EMAIL_FAILED',
        resource: 'auth',
        details: {
          email: user.email,
          role: user.role
        },
        ipAddress: clientIp,
        success: false,
        errorMessage: verificationEmailResult.error instanceof Error
          ? verificationEmailResult.error.message
          : String(verificationEmailResult.error || 'Unknown email delivery failure')
      });

      clearAuthCookies(res, req);

      return res.status(503).json({
        error: getEmailDeliveryFailureMessage(),
        requiresEmailVerification: true,
        emailDeliveryFailed: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: false
        }
      });
    }

    // Do NOT create an authenticated session before email verification.
    // Also clear any stale cookies in case user had a previous session.
    clearAuthCookies(res, req);

    return res.status(201).json({
      message: 'User registered successfully. Please verify your email before logging in.',
      requiresEmailVerification: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: false
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'User already exists with this email address' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Email Endpoint
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const hashedToken = hashToken(token);

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: hashedToken,
        verificationTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        status: 'ACTIVE',
        verificationToken: null,
        verificationTokenExpiry: null
      }
    });

    return res.json({ message: 'Email verified successfully', success: true });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend Verification Email Endpoint
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Rate limiting
    if (await isLockedOut(`resend_${sanitizedEmail}`)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const tenantId = getTenantId(req);
    const user = await prisma.user.findFirst({
      where: { email: sanitizedEmail, tenantId }
    });

    if (!user || user.isEmailVerified) {
      // Return a generic success message to prevent account enumeration.
      return res.json({ message: 'If an account exists, a verification email has been sent.' });
    }

    // Generate new token
    const verificationToken = generateSecureToken(32);
    const hashedVerificationToken = hashToken(verificationToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry: verificationExpires
      }
    });

    const verificationEmailResult = await sendVerificationEmail(user.email, verificationToken);
    if (!verificationEmailResult.success) {
      await logAuditEvent({
        userId: user.id,
        action: 'VERIFICATION_EMAIL_FAILED',
        resource: 'auth',
        details: {
          email: user.email,
          type: 'resend'
        },
        ipAddress: clientIp,
        success: false,
        errorMessage: verificationEmailResult.error instanceof Error
          ? verificationEmailResult.error.message
          : String(verificationEmailResult.error || 'Unknown email delivery failure')
      });

      return res.status(503).json({
        error: getEmailDeliveryFailureMessage(),
        emailDeliveryFailed: true
      });
    }

    // Record attempt for rate limiting
    await recordFailedAttempt(`resend_${sanitizedEmail}`);

    return res.json({ message: 'Verification email sent successfully.' });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // SECURITY: Sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Find user early so SUPER_ADMIN lockout bypass can be evaluated safely.
    const user = await findUserForPlatformEmail(req, sanitizedEmail);

    // SECURITY: Check account-centric lockout (email only).
    // IP abuse protection is enforced by the auth rate limiter in index.ts.
    // SUPER_ADMIN is allowed to bypass account lockout to avoid operator lockout.
    const emailLocked = await isLockedOut(sanitizedEmail);
    if (emailLocked && user?.role !== 'SUPER_ADMIN') {
      await logAuditEvent({
        userId: 'unknown',
        action: 'LOGIN_BLOCKED',
        resource: 'auth',
        details: { email: sanitizedEmail, reason: 'account_locked' },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Account temporarily locked'
      });
      return res.status(429).json({
        error: 'Too many failed attempts. Please try again in 15 minutes.'
      });
    }

    if (!user) {
      // SECURITY: Record failed attempt but don't reveal if user exists
      await recordFailedAttempt(sanitizedEmail);
      await logAuditEvent({
        userId: 'unknown',
        action: 'LOGIN_FAILED',
        resource: 'auth',
        details: { email: sanitizedEmail },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Invalid credentials'
      });
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // SECURITY: Record failed attempt
      await recordFailedAttempt(sanitizedEmail);
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        details: { email: sanitizedEmail },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Invalid password'
      });
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const normalizedUserRole = normalizeRole(user.role);
    const coreSuperadminEmail = getCoreSuperadminEmail();
    const tradingSuperadminEmail = getTradingSuperadminEmail();

    // Keep operator identities platform-specific so core and trading do not share the
    // same superadmin/operator login namespace.
    const tradingRequest = isTradingRequest(req);

    if (isAdminLikeRole(normalizedUserRole) || tradingLocalAllowedRoles.has(normalizedUserRole)) {
      if (tradingRequest && sanitizedEmail === coreSuperadminEmail) {
        console.warn(`[AUTH] Login 403: Core superadmin ${sanitizedEmail} attempted login on trading platform`);
        return res.status(403).json({
          error: 'DIAGNOSTIC: This operator account belongs to cambobia.com. Please sign in on the main platform.'
        });
      }
    }

    // Trading runtime accepts only dedicated platform-operator roles via local login.
    // Investors access the trading exchange through core-platform SSO only.
    // Trading runtime accepts only dedicated platform-operator roles via local login.
    // Investors access the trading exchange through core-platform SSO or direct login if enabled.
    if (isTradingRequest(req)) {
      if (!tradingLocalAllowedRoles.has(normalizedUserRole)) {
        console.warn(`[AUTH] Login 403: Role ${normalizedUserRole} for ${sanitizedEmail} not allowed on trading platform`);
        await logAuditEvent({
          userId: user.id,
          action: 'LOGIN_BLOCKED',
          resource: 'auth',
          details: { email: sanitizedEmail, role: normalizedUserRole, reason: 'role_not_allowed_trading_runtime' },
          ipAddress: clientIp,
          success: false,
          errorMessage: 'Role not allowed in trading runtime'
        });
        return res.status(403).json({
          error: 'DIAGNOSTIC: Access denied. Your account role is not permitted to sign in on this platform.'
        });
      }
    }

    // SECURITY: Check if email is verified
    // Allow SUPER_ADMIN to bypass this check to prevent lockout during setup
    // Removed ADMIN from bypass to enforce verification
    if (!user.isEmailVerified && user.role !== 'SUPER_ADMIN') {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        resource: 'auth',
        details: { email: sanitizedEmail, reason: 'email_not_verified' },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Email not verified'
      });
      return res.status(403).json({
        error: 'DIAGNOSTIC: Please verify your email address before logging in. Check your inbox for the verification link.'
      });
    }

    // SECURITY: Check if account is active
    if (user.status !== 'ACTIVE') {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        resource: 'auth',
        details: { email: sanitizedEmail, status: user.status },
        ipAddress: clientIp,
        success: false,
        errorMessage: user.status === 'PENDING' ? 'Email not verified' : 'Account not active'
      });

      const message = user.status === 'PENDING'
        ? 'DIAGNOSTIC: Please verify your email address before logging in.'
        : 'DIAGNOSTIC: Account is not active. Please contact support. Status: ' + user.status;

      return res.status(403).json({ error: message });
    }

    // SECURITY: Clear failed attempts on successful login
    await clearFailedAttempts(sanitizedEmail);

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 2FA Check (optionally enforce for Admin roles)
    const isAdmin = isAdminLikeRole(user.role);
    const enforceAdmin2fa = process.env.ENFORCE_ADMIN_2FA === 'true';
    if (user.twoFactorEnabled || (isAdmin && enforceAdmin2fa)) {
      if (!user.twoFactorEnabled && isAdmin && enforceAdmin2fa) {
        console.warn(`[SECURITY] Admin ${user.email} login attempt without MFA enabled. MFA is ENFORCED for admins.`);
        return res.status(403).json({
          error: '2FA is required for admin accounts. Please enable 2FA in settings or contact support.'
        });
      }
      const tempToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          isPreAuth: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' } // Short expiration for 2FA entry
      );

      return res.status(200).json({
        message: '2FA verification required',
        require2fa: true,
        tempToken
      });
    }

    // Issue Access & Refresh tokens
    const tokens = await issueTokensAndSetCookies(res, user, req);

    // SECURITY: Login Anomaly Detection (New IP)
    const previousSuccessLogin = await prisma.activityLog.findFirst({
      where: {
        userId: user.id,
        action: 'LOGIN_SUCCESS'
      }
    });

    if (previousSuccessLogin) {
      // User has logged in before, check if this IP is in history
      const thisIpPreviouslyUsed = await prisma.activityLog.findFirst({
        where: {
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          metadata: {
            path: ['ip'],
            equals: clientIp
          }
        }
      });

      if (!thisIpPreviouslyUsed) {
        await logAuditEvent({
          userId: user.id,
          action: 'LOGIN_ANOMALY',
          resource: 'auth',
          details: { email: sanitizedEmail, reason: 'new_ip_detected', ip: clientIp },
          ipAddress: clientIp,
          success: true
        });
        console.warn(`[SECURITY] Login anomaly detected for ${user.email}: New IP ${clientIp}`);
      }
    }

    // SECURITY: Log successful login
    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      details: { email: sanitizedEmail },
      ipAddress: clientIp,
      success: true
    });

    return res.status(200).json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (error) {

    console.error('Login error:', error);
    await logAuditEvent({
      userId: 'unknown',
      action: 'LOGIN_ERROR',
      resource: 'auth',
      ipAddress: clientIp,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return next(error);
  }
});

router.get('/email-health', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const role = normalizeRole(req.user?.role);
  if (!isAdminLikeRole(role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || 'contact@cambobia.com';
  const frontendUrl = process.env.FRONTEND_URL || null;

  return res.json({
    success: true,
    service: 'resend',
    configured: hasResendApiKey,
    hasResendApiKey,
    emailFrom,
    frontendUrl,
    mode: serviceMode
  });
});

router.get('/sso/trading-link', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isTradingService) {
      return res.status(404).json({ error: 'Route not found in trading mode' });
    }
    if (redis.status !== 'ready') {
      return res.status(503).json({ error: 'SSO temporarily unavailable. Please try again shortly.' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.tenantId !== coreTenantId) {
      return res.status(403).json({ error: 'Trading SSO is only available for core-platform investor accounts' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    if (!user.isEmailVerified && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Email verification required for SSO' });
    }
    const normalizedUserRole = normalizeRole(user.role);
    if (!ssoAllowedRoles.has(normalizedUserRole)) {
      return res.status(403).json({ error: 'Your account role is not allowed for trading SSO' });
    }

    const ssoCode = generateSecureToken(24);
    const setResult = await redis.set(
      `sso:trading:code:${ssoCode}`,
      JSON.stringify({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: normalizedUserRole,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        sourceTenantId: user.tenantId
      }),
      'EX',
      ssoTokenTtlSeconds,
      'NX'
    );
    if (setResult !== 'OK') {
      return res.status(500).json({ error: 'Failed to create SSO session code' });
    }

    const redirectUrl = `${getTradingFrontendBaseUrl()}/auth/sso/callback?code=${encodeURIComponent(ssoCode)}`;
    return res.json({ redirectUrl, expiresIn: ssoTokenTtlSeconds });
  } catch (error) {
    console.error('SSO trading-link error:', error);
    return res.status(500).json({ error: 'Failed to initiate SSO' });
  }
});

router.post('/sso/trading/consume', async (req: Request, res: Response) => {
  try {
    if (isTradingService) {
      return res.status(404).json({ error: 'Route not found in trading mode' });
    }
    if (redis.status !== 'ready') {
      return res.status(503).json({ error: 'SSO temporarily unavailable. Please try again shortly.' });
    }

    const suppliedKey = String(req.headers['x-sso-internal-key'] || '');
    if (!suppliedKey || suppliedKey !== getSsoInternalApiKey()) {
      return res.status(401).json({ error: 'Unauthorized SSO consume request' });
    }

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code) {
      return res.status(400).json({ error: 'SSO code is required' });
    }

    const claims = await consumeSsoCodeOnce(code);
    if (!claims) {
      return res.status(401).json({ error: 'Invalid or already-used SSO code' });
    }

    return res.status(200).json({ claims });
  } catch (error) {
    console.error('SSO consume error:', error);
    return res.status(500).json({ error: 'Failed to consume SSO code' });
  }
});

router.post('/sso/trading/exchange', async (req: Request, res: Response) => {
  try {
    if (!isTradingService) {
      return res.status(404).json({ error: 'Route not found in core mode' });
    }
    if (redis.status !== 'ready') {
      return res.status(503).json({ error: 'SSO temporarily unavailable. Please try again shortly.' });
    }

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code) {
      return res.status(400).json({ error: 'SSO code is required' });
    }

    const consumeResponse = await fetch(getCoreSsoConsumeUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sso-internal-key': getSsoInternalApiKey()
      },
      body: JSON.stringify({ code })
    });
    const consumeData: any = await consumeResponse.json().catch(() => ({}));
    if (!consumeResponse.ok) {
      return res.status(consumeResponse.status).json({ error: consumeData?.error || 'Failed SSO code exchange' });
    }

    const claims = consumeData?.claims || {};
    const email = sanitizeEmail(claims?.email);
    const role = normalizeRole(typeof claims?.role === 'string' ? claims.role : '');
    const sourceTenantId = String(claims?.sourceTenantId || '');

    if (!email) {
      return res.status(400).json({ error: 'Invalid SSO claims payload' });
    }
    if (sourceTenantId !== coreTenantId) {
      return res.status(403).json({ error: 'DIAGNOSTIC: Trading SSO only accepts identities from core platform investors' });
    }
    if (claims?.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Source account is not active' });
    }
    if (!claims?.isEmailVerified && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Source account must be email-verified' });
    }
    if (!ssoAllowedRoles.has(role)) {
      return res.status(403).json({ error: 'Your account role is not allowed for trading SSO' });
    }

    const tenantId = getTenantId(req);
    let user = await prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
        status: { not: 'DELETED' }
      }
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(generateSecureToken(32), 12);
      user = await prisma.user.create({
        data: {
          email,
          password: randomPassword,
          firstName: claims?.firstName || 'User',
          lastName: claims?.lastName || 'SSO',
          role: role as any,
          tenantId,
          status: 'ACTIVE',
          isEmailVerified: true,
          language: 'EN'
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: role as any,
          firstName: claims?.firstName || user.firstName,
          lastName: claims?.lastName || user.lastName,
          isEmailVerified: true
        }
      });
    }

    if (role === 'INVESTOR') {
      const investorProfile = await prisma.investor.findUnique({ where: { userId: user.id } });
      if (!investorProfile) {
        await prisma.investor.create({
          data: {
            userId: user.id,
            tenantId,
            name: `${user.firstName} ${user.lastName}`.trim(),
            type: 'ANGEL',
            kycStatus: 'PENDING'
          }
        });
      }
    }

    await issueTokensAndSetCookies(res, user, req);

    return res.status(200).json({
      message: 'SSO login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (error: any) {
    console.error('SSO exchange error:', error);
    return res.status(401).json({ error: 'Invalid SSO code exchange' });
  }
});



// Refresh Token Endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const cookieNames = getAuthCookieNames(req);
    const refreshToken = req.cookies[cookieNames.refreshToken] || req.cookies['refreshToken'];
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const tokenHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true }
    });

    if (!storedToken) {
      // Token might have been rotated and deleted?
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (storedToken.revoked || (storedToken.replacedByToken)) {
      // Reuse detection: Potentially revoke all tokens for this user
      // For now, just deny.
      await logAuditEvent({
        userId: storedToken.userId,
        action: 'TOKEN_REUSE_ATTEMPT',
        resource: 'auth',
        ipAddress: req.ip || req.socket.remoteAddress,
        success: false
      });
      return res.status(401).json({ error: 'Invalid refresh token (reused)' });
    }

    if (new Date() > storedToken.expiresAt) {
      // Cleanup expired
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Valid token -> Rotate
    // Revoke old token (or delete) using db transaction if strict
    // We will just delete it to keep table small, or mark as replaced if keeping history
    // "Rotation" usually means new token replaces old.

    // Deleting old token prevents reuse (simple rotation)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Issue new tokens
    await issueTokensAndSetCookies(res, storedToken.user, req);

    return res.json({ message: 'Token refreshed' });

  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  const cookieNames = getAuthCookieNames(req);
  const refreshToken = req.cookies[cookieNames.refreshToken] || req.cookies['refreshToken'];
  if (refreshToken) {
    try {
      const tokenHash = hashToken(refreshToken);
      // Delete from DB to revoke
      await prisma.refreshToken.deleteMany({ // deleteMany ignores lookup error
        where: { token: tokenHash }
      });
    } catch (e) {
      console.error('Error revoking token on logout:', e);
    }
  }

  clearAuthCookies(res, req);

  res.status(200).json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled,
        language: user.language || 'EN',
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, language, preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate inputs
    if (firstName && firstName.length > 100) return res.status(400).json({ error: 'First name too long' });
    if (lastName && lastName.length > 100) return res.status(400).json({ error: 'Last name too long' });

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(language && { language: language.toUpperCase() as any }), // Convert to uppercase for Enum match
        ...(preferences && { preferences: preferences as any }),
      }
    });

    return res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      twoFactorEnabled: updatedUser.twoFactorEnabled,
      language: updatedUser.language,
      preferences: updatedUser.preferences
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // SECURITY: Sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // SECURITY: Rate limit password reset requests
    if (await isLockedOut(`reset_${sanitizedEmail}`)) {
      return res.status(429).json({
        error: 'Too many password reset requests. Please try again later.'
      });
    }

    const tenantId = getTenantId(req);
    const user = await findUserForPlatformEmail(req, sanitizedEmail);

    // SECURITY: Always return success message to prevent email enumeration
    // But only generate token if user exists
    if (user) {
      // Generate secure reset token
      const resetToken = generateSecureToken(32);
      const hashedResetToken = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      // Store hashed token in user record
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedResetToken,
          resetTokenExpiry: expiresAt
        }
      });

      await logAuditEvent({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'auth',
        details: {
          email: sanitizedEmail,
          tokenHash: hashedResetToken.substring(0, 10) + '...',
          expiresAt: expiresAt.toISOString()
        },
        ipAddress: clientIp,
        success: true
      });

      // Send password reset email and surface delivery issues so users are not
      // misled into thinking a reset mail was sent when the provider failed.
      const emailResult = await sendPasswordResetEmail(
        user.email,
        resetToken,
        getRequestFrontendBaseUrl(req)
      );
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        await logAuditEvent({
          userId: user.id,
          action: 'PASSWORD_RESET_EMAIL_FAILED',
          resource: 'auth',
          details: { email: sanitizedEmail },
          ipAddress: clientIp,
          success: false,
          errorMessage: emailResult.error instanceof Error
            ? emailResult.error.message
            : typeof emailResult.error === 'string'
              ? emailResult.error
              : 'Password reset email failed'
        });
        return res.status(503).json({
          error: 'Password reset email could not be sent right now. Please try again shortly.'
        });
      }
    } else {
      // Log attempt for non-existent user (for security monitoring)
      await logAuditEvent({
        userId: 'unknown',
        action: 'PASSWORD_RESET_UNKNOWN_EMAIL',
        resource: 'auth',
        details: { email: sanitizedEmail, tenantId },
        ipAddress: clientIp,
        success: false
      });
    }

    // Always return same response to prevent email enumeration
    return res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
      success: true
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    await logAuditEvent({
      userId: 'unknown',
      action: 'PASSWORD_RESET_ERROR',
      resource: 'auth',
      ipAddress: clientIp,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const { token, password } = req.body;
    const normalizedToken = typeof token === 'string' ? token.trim() : '';

    if (!normalizedToken || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // SECURITY: Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // SECURITY: Check for breached passwords
    if (await isBreachedPassword(password)) {
      return res.status(400).json({
        error: 'This password has been found in a data breach and is unsafe to use. Please choose a different password.'
      });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = hashToken(normalizedToken);

    // Verify token exists and is not expired
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      await logAuditEvent({
        userId: 'unknown',
        action: 'PASSWORD_RESET_INVALID_TOKEN',
        resource: 'auth',
        details: {
          tokenHash: hashedToken.substring(0, 10) + '...',
          tokenLength: normalizedToken.length
        },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Token not found or expired'
      });
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Has valid token, update password
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,       // Invalidate token
        resetTokenExpiry: null
      }
    });

    // SECURITY: Revoke all refresh tokens on password reset
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    await logAuditEvent({
      userId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
      resource: 'auth',
      details: { email: user.email },
      ipAddress: clientIp,
      success: true
    });

    // Best-effort cleanup only. A Redis outage must not turn a successful
    // password reset into an API failure after the password has already been changed.
    try {
      await clearFailedAttempts(user.email);
    } catch (clearError) {
      console.error('Failed to clear login attempts after password reset:', clearError);
      await logAuditEvent({
        userId: user.id,
        action: 'PASSWORD_RESET_CLEANUP_FAILED',
        resource: 'auth',
        details: { email: user.email },
        ipAddress: clientIp,
        success: false,
        errorMessage: clearError instanceof Error ? clearError.message : 'Failed to clear login attempts'
      });
    }

    return res.json({
      message: 'Password has been reset successfully.',
      success: true
    });
  } catch (error) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    console.error('Reset password error:', error);
    await logAuditEvent({
      userId: 'unknown',
      action: 'PASSWORD_RESET_ERROR',
      resource: 'auth',
      ipAddress: clientIp,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password endpoint (for authenticated users)
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      await logAuditEvent({
        userId: user.id,
        action: 'PASSWORD_CHANGE_FAILED',
        resource: 'auth',
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Invalid current password'
      });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // SECURITY: Validate new password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // SECURITY: Check for breached passwords
    if (await isBreachedPassword(newPassword)) {
      return res.status(400).json({
        error: 'This password has been found in a data breach and is unsafe to use. Please choose a different password.'
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // SECURITY: Revoke all refresh tokens on password change
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    await logAuditEvent({
      userId: user.id,
      action: 'PASSWORD_CHANGE_SUCCESS',
      resource: 'auth',
      ipAddress: clientIp,
      success: true
    });

    return res.json({
      message: 'Password changed successfully',
      success: true
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== 2FA ENDPOINTS ====================

// Verify 2FA during Login
router.post('/verify-2fa', async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Token and code are required' });
  }

  try {
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Config error' });

    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET) as any;

    // Ensure it is a pre-auth token
    if (!decoded.isPreAuth) {
      return res.status(400).json({ error: 'Invalid token usage' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA not enabled or configured' });
    }

    let secret = user.twoFactorSecret;
    if (user.twoFactorSecret.includes(':')) {
      try {
        secret = decryptData(user.twoFactorSecret);
      } catch (e) {
        console.error('[AUTH] 2FA secret decryption failed', {
          userId: user.id,
          error: e instanceof Error ? e.message : String(e)
        });

        await logAuditEvent({
          userId: user.id,
          action: 'LOGIN_MFA_FAIL',
          resource: 'user',
          details: { reason: 'invalid_2fa_secret' },
          ipAddress: clientIp,
          success: false,
          errorMessage: 'Stored 2FA secret could not be decrypted'
        });

        return res.status(500).json({ error: 'Two-factor authentication is temporarily unavailable. Please contact support.' });
      }
    }

    let verified = verifyMfaToken(secret, code);
    let usedBackupCode = false;

    if (!verified && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
      // Check backup codes
      for (const hashedCode of user.twoFactorBackupCodes) {
        const isMatch = await bcrypt.compare(code, hashedCode);
        if (isMatch) {
          verified = true;
          usedBackupCode = true;

          // Remove used backup code (SECURITY best practice)
          const updatedCodes = user.twoFactorBackupCodes.filter(c => c !== hashedCode);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: updatedCodes }
          });

          await logAuditEvent({
            userId: user.id,
            action: 'LOGIN_MFA_BACKUP',
            resource: 'user',
            details: { remaining: updatedCodes.length },
            ipAddress: clientIp,
            success: true
          });
          break;
        }
      }
    }

    if (!verified) {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_MFA_FAIL',
        resource: 'user',
        details: { reason: 'invalid_code' },
        ipAddress: clientIp,
        success: false
      });
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // SECURITY: Revoke all other refresh tokens for this user upon 2FA successful login
    // This ensures only the new session is active if that's the desired security posture,
    // or at least ensures that tokens issued during the pre-auth phase are gone.
    // Actually, issueTokensAndSetCookies already issues new ones.
    // Usually we want to revoke OLD tokens when a new 2FA login happens.
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        // We might want to keep the one we JUST issued, but issueTokensAndSetCookies
        // adds it to the DB. So we should probably do this BEFORE issueTokensAndSetCookies
        // or exclude the current one.
      }
    });

    // Issue Access & Refresh tokens
    await issueTokensAndSetCookies(res, user, req);

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      details: { method: '2FA' },
      ipAddress: clientIp,
      success: true
    });

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: true
      }
    });

  } catch (error) {
    console.error('2FA Verify Error:', error);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
});

// Setup 2FA (Generate Secret)
router.post('/2fa/setup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const secret = generateMfaSecret(user.email);
    if (!secret.otpauth_url) {
      return res.status(500).json({ error: 'Failed to generate 2FA secret URL' });
    }
    const qrCode = await generateQrCode(secret.otpauth_url);

    // Return secret to client (client must send it back to confirm)
    // We do NOT save it to DB yet to prevent lockout if they fail to scan
    return res.json({
      secret: secret.base32,
      qrCode
    });

  } catch (error) {
    console.error('2FA Setup Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate 2FA (Verify and Save)
router.post('/2fa/activate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { code, secret } = req.body;
  const user = req.user;

  if (!code || !secret) {
    return res.status(400).json({ error: 'Code and secret are required' });
  }

  try {
    const isValid = verifyMfaToken(secret, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(); // Assuming this function exists and generates an array of plaintext codes
    const hashedBackupCodes = await Promise.all(backupCodes.map(code => bcrypt.hash(code, 12)));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptData(secret),
        twoFactorBackupCodes: hashedBackupCodes
      }
    });

    // SECURITY: Revoke all existing sessions when 2FA is enabled
    // This forces all devices to re-login with the new 2FA requirement
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    await logAuditEvent({
      userId: user.id,
      action: '2FA_ENABLED',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      success: true
    });

    return res.json({
      message: 'Two-factor authentication enabled successfully',
      success: true,
      backupCodes
    });

  } catch (error) {
    console.error('2FA Activation Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { password } = req.body; // Require password to disable
  const user = req.user;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  try {
    // Verify user exists and check password
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, dbUser.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });

    // SECURITY: Revoke all refresh tokens when 2FA is disabled
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    await logAuditEvent({
      userId: user.id,
      action: '2FA_DISABLED',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      success: true
    });

    return res.json({ message: 'Two-factor authentication disabled' });

  } catch (error) {
    console.error('2FA Disable Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account (Soft Delete)
router.post('/delete-account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const user: any = req.user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // New unique email to free up the original email
    // Format: deleted_<timestamp>_<original_email>
    const timestamp = Date.now();
    const deletedEmail = `deleted_${timestamp}_${user.email}`;

    // Transaction to update user and related profiles
    await prisma.$transaction(async (tx) => {
      // 1. Update User Record
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED' as any, // Soft delete
          email: deletedEmail,
          firstName: 'Deleted',
          lastName: 'User',
          password: `deleted_${timestamp}`, // Scramble password
          twoFactorSecret: null,
          twoFactorEnabled: false,
          did: null, // Remove DID link
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      // 1.25 SECURITY: Revoke all refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: user.id }
      });

      // 1.5 Purge Push Subscriptions to prevent notification leakage
      await tx.pushSubscription.deleteMany({
        where: { userId: user.id }
      });

      // 2. Anonymize Linked Profiles based on Role

      // Anonymize SME Profile if exists
      if (user.role === 'SME') {
        const sme = await tx.sME.findFirst({ where: { userId: user.id, tenantId: user.tenantId } });
        if (sme) {
          await tx.sME.update({
            where: { id: sme.id },
            data: {
              name: `Deleted Company ${timestamp}`,
              description: 'This account has been deleted.',
              website: null,
              location: null,
              status: 'REJECTED'
            }
          });
        }
      }

      // Anonymize Investor Profile if exists
      if (user.role === 'INVESTOR') {
        const investor = await tx.investor.findFirst({ where: { userId: user.id, tenantId: user.tenantId } });
        if (investor) {
          await tx.investor.update({
            where: { id: investor.id },
            data: {
              name: `Deleted Investor ${timestamp}`,
              type: 'ANGEL',
              preferences: {},
              kycStatus: 'REJECTED'
            }
          });
        }
      }

      // Anonymize Advisor Profile if exists
      if (user.role === 'ADVISOR') {
        const advisor = await tx.advisor.findFirst({ where: { userId: user.id, tenantId: user.tenantId } });
        if (advisor) {
          await tx.advisor.update({
            where: { id: advisor.id },
            data: {
              name: `Deleted Advisor ${timestamp}`,
              status: 'SUSPENDED'
            }
          });
        }
      }
    });

    await logAuditEvent({
      userId: user.id,
      action: 'ACCOUNT_DELETED',
      resource: 'user',
      details: {
        originalEmail: user.email,
        newEmail: deletedEmail
      },
      ipAddress: clientIp,
      success: true
    });

    return res.json({
      message: 'Account deleted successfully. You have been logged out.',
      success: true
    });

  } catch (error: any) {
    console.error('Delete account error:', error);
    await logAuditEvent({
      userId: req.user?.id || 'unknown',
      action: 'ACCOUNT_DELETE_ERROR',
      resource: 'user',
      ipAddress: clientIp,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// Switch Role Endpoint
// Switch Role Endpoint
router.post('/switch-role', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isTradingService) {
      return res.status(403).json({ error: 'Role switching is not available in the trading platform.' });
    }

    const userId = req.user?.id;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { targetRole } = req.body;
    const normalizedTargetRole = normalizeRole(targetRole);
    const switchableRoles = new Set(['SME', 'INVESTOR']);

    if (!switchableRoles.has(normalizedTargetRole)) {
      await logAuditEvent({
        userId,
        action: 'ROLE_SWITCH_BLOCKED',
        resource: 'auth',
        details: { targetRole, reason: 'invalid_target_role' },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Invalid target role'
      });
      return res.status(400).json({ error: 'Invalid target role. Can only switch between SME and INVESTOR.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { sme: true, investor: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    const normalizedCurrentRole = normalizeRole(user.role);

    // Security hardening: only SME/INVESTOR personas can use role switching.
    if (!switchableRoles.has(normalizedCurrentRole)) {
      await logAuditEvent({
        userId: user.id,
        action: 'ROLE_SWITCH_BLOCKED',
        resource: 'auth',
        details: {
          currentRole: user.role,
          targetRole: normalizedTargetRole,
          reason: 'operator_role_forbidden'
        },
        ipAddress: clientIp,
        success: false,
        errorMessage: 'Operator roles cannot use role switching'
      });
      return res.status(403).json({ error: 'DIAGNOSTIC: Role switching is only available for SME and Investor accounts.' });
    }

    if (normalizedCurrentRole === normalizedTargetRole) {
      return res.json({
        message: `Already using ${normalizedCurrentRole} role`,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          twoFactorEnabled: user.twoFactorEnabled
        }
      });
    }

    // logic to ensure profile exists
    if (normalizedTargetRole === 'INVESTOR') {
      if (!user.investor) {
        // Create Investor Profile
        await prisma.investor.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            name: `${user.firstName} ${user.lastName}`,
            type: 'ANGEL', // Default
            kycStatus: 'PENDING'
          }
        });
      }
    } else if (normalizedTargetRole === 'SME') {
      if (!user.sme) {
        // Create SME Profile
        await prisma.sME.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            name: `${user.firstName} ${user.lastName}`,
            sector: 'General',
            stage: 'SEED',
            fundingRequired: 0,
            status: 'DRAFT'
          }
        });
      }
    }

    // Update User Role
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: normalizedTargetRole as any }
    });

    // Issue Access & Refresh tokens
    await issueTokensAndSetCookies(res, updatedUser, req);

    await logAuditEvent({
      userId: updatedUser.id,
      action: 'ROLE_SWITCH_SUCCESS',
      resource: 'auth',
      details: {
        fromRole: normalizedCurrentRole,
        toRole: normalizedTargetRole
      },
      ipAddress: clientIp,
      success: true
    });

    return res.json({
      message: `Successfully switched to ${normalizedTargetRole}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        twoFactorEnabled: updatedUser.twoFactorEnabled
      }
    });

  } catch (error) {
    console.error('Switch role error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List active sessions for the current user
 */
router.get('/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const cookieNames = getAuthCookieNames(req);
    const currentRefreshToken = req.cookies?.[cookieNames.refreshToken] || req.cookies?.['refreshToken'];
    let currentSessionId: string | null = null;
    if (currentRefreshToken) {
      const currentTokenHash = hashToken(currentRefreshToken);
      const currentSession = await prisma.refreshToken.findUnique({
        where: { token: currentTokenHash },
        select: { id: true, userId: true }
      });
      if (currentSession && currentSession.userId === user.id) {
        currentSessionId = currentSession.id;
      }
    }

    const sessions = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ sessions, currentSessionId });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Revoke a specific session
 */
router.delete('/sessions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const sessionId = req.params.id;

    // Ensure session belongs to user
    const session = await prisma.refreshToken.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true, token: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.refreshToken.delete({
      where: { id: sessionId }
    });

    const cookieNames = getAuthCookieNames(req);
    const currentRefreshToken = req.cookies?.[cookieNames.refreshToken] || req.cookies?.['refreshToken'];
    if (currentRefreshToken && session.token === hashToken(currentRefreshToken)) {
      // If user revoked the current device session, clear local auth cookies immediately.
      clearAuthCookies(res, req);
    }

    return res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
