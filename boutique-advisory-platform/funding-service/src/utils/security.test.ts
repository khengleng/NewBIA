import test from 'node:test';
import assert from 'node:assert';
import { validateSecurityConfiguration } from './securityValidator';

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
    const originals: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(env)) {
        originals[key] = process.env[key];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return fn();
    } finally {
        for (const [key, value] of Object.entries(originals)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

const BASE_ENV = {
    DATABASE_URL: 'postgresql://user:pass@db.railway.internal:5432/db',
    FRONTEND_URL: 'https://www.cambobia.com',
    SERVICE_MODE: 'core',
    SSO_INTERNAL_API_KEY: 'x'.repeat(32),
    ENCRYPTION_KEY: 'x'.repeat(32)
};

test('Security Validator - checks JWT_SECRET', () => {
    withEnv({ ...BASE_ENV, NODE_ENV: 'production' }, () => {
        const weakResult = withEnv({ JWT_SECRET: 'weak' }, () => validateSecurityConfiguration());

        const jwtCheck = weakResult.results.find(r => r.name === 'JWT_SECRET');
        assert.ok(jwtCheck, 'JWT_SECRET check should exist');
        assert.strictEqual(jwtCheck.passed, false, 'Weak secret in production should fail');
        assert.strictEqual(jwtCheck.severity, 'CRITICAL');

        const strongResult = withEnv(
            { JWT_SECRET: 'strong-key-without-protected-words-more-than-32-chars' },
            () => validateSecurityConfiguration()
        );
        const jwtCheck2 = strongResult.results.find(r => r.name === 'JWT_SECRET');
        assert.strictEqual(jwtCheck2!.passed, true, 'Strong secret in production should pass');
    });
});

test('Security Validator - checks NODE_ENV warnings', () => {
    withEnv({ ...BASE_ENV, NODE_ENV: 'development', RENDER: 'true' }, () => {
        const result = validateSecurityConfiguration();
        const envCheck = result.results.find(r => r.name === 'NODE_ENV');

        assert.strictEqual(envCheck!.passed, false, 'Non-production ENV on cloud platform should fail/warn');
        assert.strictEqual(envCheck!.severity, 'HIGH');
    });
});
