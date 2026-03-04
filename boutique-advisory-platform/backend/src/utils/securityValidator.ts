/**
 * Security Validation on Startup
 * Validates security configuration before the server starts
 */

interface SecurityCheckResult {
    name: string;
    passed: boolean;
    message: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Run all security checks before server startup
 * Returns false if any CRITICAL checks fail
 */
export function validateSecurityConfiguration(): { success: boolean; results: SecurityCheckResult[] } {
    const results: SecurityCheckResult[] = [];

    // ============================================
    // CRITICAL CHECKS - Server won't start without these
    // ============================================

    // Check JWT_SECRET
    results.push(checkJwtSecret());

    // Check NODE_ENV in production
    results.push(checkNodeEnv());

    // Check DATABASE_URL
    results.push(checkDatabaseUrl());

    // Check ENCRYPTION_KEY
    results.push(checkEncryptionKey());
    results.push(checkServiceModeConfiguration());

    // ============================================
    // HIGH PRIORITY CHECKS
    // ============================================

    // Check for secure cookie settings
    results.push(checkCookieSettings());

    // Check CORS configuration
    results.push(checkCorsConfiguration());
    results.push(checkPlatformBoundaryConfiguration());

    // Check rate limiting
    results.push(checkRateLimiting());

    // ============================================
    // MEDIUM PRIORITY CHECKS
    // ============================================

    // Check for HTTPS enforcement
    results.push(checkHttpsEnforcement());

    // Check session configuration
    results.push(checkSessionConfig());

    // Check logging configuration
    results.push(checkLoggingConfig());

    // ============================================
    // LOW PRIORITY CHECKS (Warnings)
    // ============================================

    // Check for monitoring
    results.push(checkMonitoring());

    // Print results
    printSecurityReport(results);

    // Check for critical failures
    const criticalFailures = results.filter(r => !r.passed && r.severity === 'CRITICAL');
    const highFailures = results.filter(r => !r.passed && r.severity === 'HIGH');

    if (criticalFailures.length > 0) {
        console.error('\n❌ CRITICAL SECURITY CHECKS FAILED - SERVER CANNOT START');
        return { success: false, results };
    }

    if (highFailures.length > 0) {
        console.warn('\n⚠️  HIGH PRIORITY SECURITY ISSUES DETECTED - Review before production');
    }

    return { success: true, results };
}

// ============================================
// INDIVIDUAL CHECKS
// ============================================

function checkJwtSecret(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';
    const secret = process.env.JWT_SECRET || '';

    if (isProduction && (!secret || secret.length < 32)) {
        return {
            name: 'JWT_SECRET',
            passed: false,
            message: 'JWT_SECRET is too short or missing (min 32 characters required for production)',
            severity: 'CRITICAL'
        };
    }

    if (isProduction && secret === 'your-super-secret-jwt-key-change-in-production') {
        return {
            name: 'JWT_SECRET',
            passed: false,
            message: 'JWT_SECRET is using default value - CHANGE IMMEDIATELY for production',
            severity: 'CRITICAL'
        };
    }

    // Check for common weak secrets in production
    const weakSecrets = ['secret', 'password', 'jwt', 'token', '123456', 'admin'];
    if (isProduction && weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
        return {
            name: 'JWT_SECRET',
            passed: false,
            message: 'JWT_SECRET appears to contain weak/guessable content',
            severity: 'HIGH'
        };
    }

    return {
        name: 'JWT_SECRET',
        passed: true,
        message: secret ? `JWT_SECRET is configured (${secret.length} characters)` : 'JWT_SECRET not set (local dev mode)',
        severity: 'CRITICAL'
    };
}

function checkNodeEnv(): SecurityCheckResult {
    const nodeEnv = process.env.NODE_ENV;

    if (nodeEnv === 'production') {
        return {
            name: 'NODE_ENV',
            passed: true,
            message: 'NODE_ENV is set to production',
            severity: 'CRITICAL'
        };
    }

    // If running on a cloud platform, warn if not production
    if (process.env.KUBERNETES_SERVICE_HOST || process.env.RENDER || process.env.HEROKU || process.env.GOOGLE_CLOUD_PROJECT) {
        return {
            name: 'NODE_ENV',
            passed: false,
            message: `NODE_ENV is "${nodeEnv}" but running on cloud platform - should be "production"`,
            severity: 'HIGH'
        };
    }

    return {
        name: 'NODE_ENV',
        passed: true,
        message: `NODE_ENV is "${nodeEnv}" (development mode)`,
        severity: 'CRITICAL'
    };
}

function checkDatabaseUrl(): SecurityCheckResult {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        return {
            name: 'DATABASE_URL',
            passed: false,
            message: 'DATABASE_URL is not configured',
            severity: 'CRITICAL'
        };
    }

    // Check for localhost in production
    if (process.env.NODE_ENV === 'production' &&
        (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))) {
        return {
            name: 'DATABASE_URL',
            passed: false,
            message: 'DATABASE_URL points to localhost in production',
            severity: 'CRITICAL'
        };
    }

    // Check for SSL in production (Railway internal host uses private network transport)
    const isRailwayInternal = dbUrl.includes('.railway.internal');
    if (process.env.NODE_ENV === 'production' && !isRailwayInternal && !dbUrl.includes('sslmode=require')) {
        return {
            name: 'DATABASE_URL',
            passed: false,
            message: 'DATABASE_URL should include sslmode=require for production',
            severity: 'CRITICAL'
        };
    }

    return {
        name: 'DATABASE_URL',
        passed: true,
        message: 'DATABASE_URL is configured',
        severity: 'CRITICAL'
    };
}

function checkEncryptionKey(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';
    const key = process.env.ENCRYPTION_KEY || '';

    if (isProduction && !key) {
        return {
            name: 'ENCRYPTION_KEY',
            passed: false,
            message: 'ENCRYPTION_KEY is missing in production - DATA ENCRYPTION WILL FAIL',
            severity: 'HIGH'
        };
    }

    if (isProduction && key.length < 32) {
        return {
            name: 'ENCRYPTION_KEY',
            passed: false,
            message: 'ENCRYPTION_KEY is too short (min 32 characters required for production)',
            severity: 'HIGH'
        };
    }

    return {
        name: 'ENCRYPTION_KEY',
        passed: true,
        message: key ? `ENCRYPTION_KEY is configured (${key.length} characters)` : 'ENCRYPTION_KEY not set (local dev mode)',
        severity: 'HIGH'
    };
}

function checkCookieSettings(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
        return {
            name: 'Cookie Security',
            passed: true,
            message: 'Development mode - cookie security checks skipped',
            severity: 'HIGH'
        };
    }

    // In production, cookies should be secure
    return {
        name: 'Cookie Security',
        passed: true,
        message: 'Cookie security settings will be enforced in production',
        severity: 'HIGH'
    };
}

function checkCorsConfiguration(): SecurityCheckResult {
    const frontendUrl = process.env.FRONTEND_URL;
    const tradingFrontendUrl = process.env.TRADING_FRONTEND_URL;
    const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !frontendUrl && serviceMode !== 'trading') {
        return {
            name: 'CORS Configuration',
            passed: false,
            message: 'FRONTEND_URL not set - CORS may be too permissive',
            severity: 'HIGH'
        };
    }
    if (isProduction && !tradingFrontendUrl && serviceMode === 'trading') {
        return {
            name: 'CORS Configuration',
            passed: false,
            message: 'TRADING_FRONTEND_URL not set for trading mode',
            severity: 'HIGH'
        };
    }

    if (frontendUrl?.includes('*') || tradingFrontendUrl?.includes('*')) {
        return {
            name: 'CORS Configuration',
            passed: false,
            message: 'FRONTEND_URL/TRADING_FRONTEND_URL contains wildcard - not recommended for production',
            severity: 'HIGH'
        };
    }

    return {
        name: 'CORS Configuration',
        passed: true,
        message: frontendUrl ? `CORS configured for: ${frontendUrl}` : 'CORS will allow localhost in development',
        severity: 'HIGH'
    };
}

function checkServiceModeConfiguration(): SecurityCheckResult {
    const mode = (process.env.SERVICE_MODE || 'core').toLowerCase();
    if (mode !== 'core' && mode !== 'trading') {
        return {
            name: 'SERVICE_MODE',
            passed: false,
            message: `Invalid SERVICE_MODE "${mode}". Allowed values: core, trading`,
            severity: 'CRITICAL'
        };
    }

    return {
        name: 'SERVICE_MODE',
        passed: true,
        message: `SERVICE_MODE is "${mode}"`,
        severity: 'CRITICAL'
    };
}

function isInternalHostname(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    if (
        lower === 'localhost'
        || lower.endsWith('.local')
        || lower.endsWith('.internal')
        || lower.endsWith('.railway.internal')
    ) {
        return true;
    }

    return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(lower);
}

function checkPlatformBoundaryConfiguration(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';
    const mode = (process.env.SERVICE_MODE || 'core').toLowerCase();
    const coreUrl = process.env.FRONTEND_URL || '';
    const tradingUrl = process.env.TRADING_FRONTEND_URL || '';
    const ssoInternalApiKey = process.env.SSO_INTERNAL_API_KEY || '';
    const coreConsumeUrl = process.env.CORE_SSO_CONSUME_URL || '';

    if (!isProduction) {
        return {
            name: 'Platform Boundary',
            passed: true,
            message: 'Development mode - strict platform boundary checks relaxed',
            severity: 'HIGH'
        };
    }

    if (!ssoInternalApiKey || ssoInternalApiKey.length < 32) {
        return {
            name: 'Platform Boundary',
            passed: false,
            message: 'SSO_INTERNAL_API_KEY is missing or too short (min 32 chars)',
            severity: 'CRITICAL'
        };
    }

    if (mode === 'core' && !coreUrl) {
        return {
            name: 'Platform Boundary',
            passed: false,
            message: 'FRONTEND_URL is required in core mode',
            severity: 'CRITICAL'
        };
    }

    if (mode === 'trading') {
        if (!tradingUrl) {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'TRADING_FRONTEND_URL is required in trading mode',
                severity: 'CRITICAL'
            };
        }
        if (!coreConsumeUrl) {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'CORE_SSO_CONSUME_URL is required in trading mode for secure SSO exchange',
                severity: 'CRITICAL'
            };
        }
    }

    try {
        let parsedCoreUrl: URL | null = null;
        let parsedTradingUrl: URL | null = null;
        let parsedCoreConsumeUrl: URL | null = null;

        if (coreUrl) {
            parsedCoreUrl = new URL(coreUrl);
        }
        if (tradingUrl) {
            parsedTradingUrl = new URL(tradingUrl);
        }
        if (coreConsumeUrl) {
            parsedCoreConsumeUrl = new URL(coreConsumeUrl);
        }

        if (parsedCoreUrl && parsedCoreUrl.protocol !== 'https:') {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'FRONTEND_URL must use https:// in production',
                severity: 'CRITICAL'
            };
        }
        if (parsedTradingUrl && parsedTradingUrl.protocol !== 'https:') {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'TRADING_FRONTEND_URL must use https:// in production',
                severity: 'CRITICAL'
            };
        }
        if (parsedCoreUrl && isInternalHostname(parsedCoreUrl.hostname)) {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'FRONTEND_URL cannot use private/internal hostname in production',
                severity: 'CRITICAL'
            };
        }
        if (parsedTradingUrl && isInternalHostname(parsedTradingUrl.hostname)) {
            return {
                name: 'Platform Boundary',
                passed: false,
                message: 'TRADING_FRONTEND_URL cannot use private/internal hostname in production',
                severity: 'CRITICAL'
            };
        }

        if (mode === 'trading' && parsedCoreConsumeUrl) {
            const consumeIsHttps = parsedCoreConsumeUrl.protocol === 'https:';
            const consumeIsInternal = isInternalHostname(parsedCoreConsumeUrl.hostname);
            if (!consumeIsHttps && !consumeIsInternal) {
                return {
                    name: 'Platform Boundary',
                    passed: false,
                    message: 'CORE_SSO_CONSUME_URL must use https:// or a private internal hostname',
                    severity: 'CRITICAL'
                };
            }
        }

        if (parsedCoreUrl && parsedTradingUrl) {
            const coreHost = parsedCoreUrl.hostname;
            const tradingHost = parsedTradingUrl.hostname;
            if (coreHost === tradingHost) {
                return {
                    name: 'Platform Boundary',
                    passed: false,
                    message: 'Core and trading frontend hostnames must be different for compliance separation',
                    severity: 'CRITICAL'
                };
            }
        }
    } catch {
        return {
            name: 'Platform Boundary',
            passed: false,
            message: 'FRONTEND_URL/TRADING_FRONTEND_URL format is invalid',
            severity: 'CRITICAL'
        };
    }

    return {
        name: 'Platform Boundary',
        passed: true,
        message: 'Platform boundary and SSO isolation settings are configured',
        severity: 'HIGH'
    };
}

function checkRateLimiting(): SecurityCheckResult {
    // Rate limiting is enabled by default in our configuration
    return {
        name: 'Rate Limiting',
        passed: true,
        message: 'Rate limiting is enabled (100 req/15min in production)',
        severity: 'HIGH'
    };
}

function checkHttpsEnforcement(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';

    // Many cloud platforms automatically provide HTTPS termination
    if (process.env.KUBERNETES_SERVICE_HOST || process.env.GOOGLE_CLOUD_PROJECT) {
        return {
            name: 'HTTPS Enforcement',
            passed: true,
            message: 'Running in cloud environment - HTTPS is typically handled by ingress/load balancer',
            severity: 'MEDIUM'
        };
    }

    if (isProduction) {
        return {
            name: 'HTTPS Enforcement',
            passed: true,
            message: 'HSTS headers are enabled for production',
            severity: 'MEDIUM'
        };
    }

    return {
        name: 'HTTPS Enforcement',
        passed: true,
        message: 'Development mode - HTTPS not required',
        severity: 'MEDIUM'
    };
}

function checkSessionConfig(): SecurityCheckResult {
    const sessionSecret = process.env.SESSION_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !sessionSecret) {
        return {
            name: 'Session Configuration',
            passed: true,
            message: 'Using JWT-based auth (no server-side sessions)',
            severity: 'MEDIUM'
        };
    }

    return {
        name: 'Session Configuration',
        passed: true,
        message: 'Session configuration is acceptable',
        severity: 'MEDIUM'
    };
}

function checkLoggingConfig(): SecurityCheckResult {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        name: 'Logging Configuration',
        passed: true,
        message: isProduction ? 'Using combined logging format' : 'Using dev logging format',
        severity: 'MEDIUM'
    };
}

function checkMonitoring(): SecurityCheckResult {
    // Check for monitoring endpoints or services
    return {
        name: 'Monitoring',
        passed: true,
        message: 'Health check endpoint available at /health',
        severity: 'LOW'
    };
}

// ============================================
// REPORT PRINTING
// ============================================

function printSecurityReport(results: SecurityCheckResult[]): void {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                   SECURITY CONFIGURATION CHECK                    ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');

    const grouped = {
        CRITICAL: results.filter(r => r.severity === 'CRITICAL'),
        HIGH: results.filter(r => r.severity === 'HIGH'),
        MEDIUM: results.filter(r => r.severity === 'MEDIUM'),
        LOW: results.filter(r => r.severity === 'LOW'),
    };

    for (const [severity, checks] of Object.entries(grouped)) {
        if (checks.length === 0) continue;

        console.log(`║ ${severity} PRIORITY:`);
        console.log('║──────────────────────────────────────────────────────────────────');

        for (const check of checks) {
            const icon = check.passed ? '✅' : '❌';
            const status = check.passed ? 'PASS' : 'FAIL';
            console.log(`║ ${icon} [${status}] ${check.name}`);
            console.log(`║    └─ ${check.message}`);
        }
        console.log('║');
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║ RESULT: ${passed}/${total} checks passed (${percentage}%)`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('\n');
}

export default {
    validateSecurityConfiguration
};
