import test from 'node:test';
import assert from 'node:assert';
import { validateSecurityConfiguration } from './securityValidator';

test('Security Validator - checks JWT_SECRET', () => {
    // Save original env
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    try {
        // Test Production with weak secret
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'weak';

        const result = validateSecurityConfiguration();

        // Find JWT_SECRET check
        const jwtCheck = result.results.find(r => r.name === 'JWT_SECRET');
        assert.ok(jwtCheck, 'JWT_SECRET check should exist');
        assert.strictEqual(jwtCheck.passed, false, 'Weak secret in production should fail');
        assert.strictEqual(jwtCheck.severity, 'CRITICAL');

        // Test Production with strong secret
        process.env.JWT_SECRET = 'strong-key-without-protected-words-more-than-32-chars';
        const result2 = validateSecurityConfiguration();
        const jwtCheck2 = result2.results.find(r => r.name === 'JWT_SECRET');
        assert.strictEqual(jwtCheck2!.passed, true, 'Strong secret in production should pass');

    } finally {
        // Restore env
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = originalSecret;
    }
});

test('Security Validator - checks NODE_ENV warnings', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalRender = process.env.RENDER;

    try {
        process.env.NODE_ENV = 'development';
        process.env.RENDER = 'true'; // Simulate cloud platform

        const result = validateSecurityConfiguration();
        const envCheck = result.results.find(r => r.name === 'NODE_ENV');

        assert.strictEqual(envCheck!.passed, false, 'Non-production ENV on cloud platform should fail/warn');
        assert.strictEqual(envCheck!.severity, 'HIGH');

    } finally {
        process.env.NODE_ENV = originalEnv;
        delete process.env.RENDER;
    }
});
