# Public Readiness Security Report (2026-03-01)

## Executive Summary
High-risk auth and verification issues were fixed, production secrets were rotated, and dependency vulnerabilities were reduced. The platform is close to public-ready, with a small set of medium/low dependency findings remaining in backend transitive packages.

## Critical/High Findings (Resolved)

1. Resolved: CSRF instability and intermittent token failures in production auth flows.
2. Resolved: Account-role registration policy mismatch (`ADVISOR`) causing broken onboarding.
3. Resolved: Email verification privacy leak (`email` in URL query).
4. Resolved: Verification resend account enumeration behavior.
5. Resolved: Multiple high/critical npm advisories (notably axios, temporal/webpack path, fast-xml-parser chain).

## Remaining Findings

1. Severity: Moderate
Rule: Dependency hygiene
Location: backend transitive dependency `bn.js`
Status: Open (transitive)
Recommendation: update/override the parent dependency chain to a version that pulls `bn.js >= 4.12.3`.

2. Severity: Low
Rule: Dependency hygiene
Location: backend transitive dependency `qs`
Status: Open (transitive)
Recommendation: upgrade transitive dependency chain to consume fixed `qs` when available in parent packages.

## Security Controls Verified

1. CSRF double-submit cookie protection active.
2. Secure cookie flags active in production.
3. CORS restricted to configured production origins.
4. Rate limiting enabled for API and stricter limits for auth endpoints.
5. Health monitoring workflow added for production checks.

## Actions Executed in This Pass

1. Full focused security review on auth/security paths.
2. Production app-secret rotation (`JWT_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY`).
3. App-edge hardening via tighter production rate limits.
4. Dependency hardening and vulnerability reduction.
5. Scheduled production health monitor workflow.
6. End-to-end production smoke verification after deploy.

