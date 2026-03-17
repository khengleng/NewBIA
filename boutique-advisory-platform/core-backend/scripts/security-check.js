const axios = require('axios');

async function checkSecurityHeaders(url) {
    console.log(`Checking security headers for: ${url}`);
    try {
        const response = await axios.get(url, { validateStatus: false });
        const headers = response.headers;

        const checks = [
            { name: 'Strict-Transport-Security', expected: true },
            { name: 'Content-Security-Policy', expected: true },
            { name: 'X-Content-Type-Options', expected: 'nosniff' },
            { name: 'X-Frame-Options', expected: 'DENY' },
            { name: 'X-XSS-Protection', expected: '0' },
            { name: 'Referrer-Policy', expected: true }
        ];

        let allPassed = true;
        checks.forEach(check => {
            const value = headers[check.name.toLowerCase()];
            if (!value) {
                console.error(`❌ MISSING: ${check.name}`);
                allPassed = false;
            } else if (check.expected !== true && value !== check.expected) {
                console.warn(`⚠️  MISMATCH: ${check.name}. Expected ${check.expected}, got ${value}`);
            } else {
                console.log(`✅ PASSED: ${check.name}`);
            }
        });

        // Specific CSP checks
        const csp = headers['content-security-policy'];
        if (csp) {
            if (csp.includes("'unsafe-inline'") && !csp.includes("style-src")) {
                console.warn("⚠️  CSP WARNING: 'unsafe-inline' found but not restricted to style-src.");
            }
            if (csp.includes("'unsafe-eval'")) {
                console.error("❌ CSP ERROR: 'unsafe-eval' is allowed!");
                allPassed = false;
            }
        }

        if (!allPassed) {
            process.exit(1);
        }
        console.log('\n✨ Security header check completed successfully!');
    } catch (error) {
        console.error(`Failed to check headers: ${error.message}`);
        process.exit(1);
    }
}

const target = process.argv[2] || 'http://localhost:3003';
checkSecurityHeaders(target);
