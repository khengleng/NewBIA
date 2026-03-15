# Microservices Phase 1 (Execution Baseline)

This repository currently runs as a multi-app monorepo with:
- `backend` API service
- `core-frontend` web portal (`cambobia.com`)
- `trade-frontend` web portal (`trade.cambobia.com`)
- mobile apps (`mobile_app`, `twallet-app`)
- `mobile-bot-service`

## Goal
Create an incremental path to microservices and canary deployment without destabilizing production auth/tenant flows.

## Phase 1 delivered in-repo
1. **Railway upload hardening**
   - Added repo `.railwayignore` plus `backend/.railwayignore` to reduce payload size and avoid Cloudflare 413 on `railway up`.
2. **Canary-ready deployment script**
   - Added `scripts/deploy-backend-canary.sh`.
   - Script now auto-detects repo layout, supports dry-run, and defaults to safe behavior:
     - sync `work`
     - deploy backend
     - optional main promotion via `AUTO_PROMOTE_MAIN=true`.
3. **NPM script shortcuts**
   - `npm run deploy:backend:canary`
   - `npm run deploy:backend:canary:local`

## Next phases (recommended)
### Phase 2: Service boundary extraction
- Extract domain APIs out of `backend` into separately deployable services (start with least-coupled modules).
- Keep current frontends calling API-proxy during transition.

### Phase 3: Contract and observability hardening
- Add shared request/response contracts and service auth claims.
- Add distributed tracing across gateway + services.

### Phase 4: True canary rollout
- Introduce weighted traffic split and per-service progressive rollout policy.
- Add automatic rollback triggers on health/error SLO breaches.
