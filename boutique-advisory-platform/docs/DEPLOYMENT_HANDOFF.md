# Deployment Handoff

## Current branch

- Branch: `codex/twallet-integration`
- Commit: `ca10a916`

## Railway project

- Project: `CamboBia`
- Project ID: `ab57e56e-0928-4c69-9559-fdf1128839f1`
- Environment: `production`

## Deployment result from this pass

### Successful

- `Trading`
  - Deployment: `450bebaf-4901-44da-9d50-07e9466ab344`
  - Status: `SUCCESS`
- `Trading-Frontend`
  - Deployment: `5fa332f4-6418-480b-ac95-c40ef0234d20`
  - Status: `SUCCESS`

### Blocked by Railway service configuration

- `Backend`
  - Deployment: `e372c6d4-e94c-45ba-a104-6396d6914271`
  - Status: `FAILED`
  - Railway error:
    - `Could not find root directory: /boutique-advisory-platform/backend`
- `Frontend`
  - Deployment: `f116cff1-d2c8-4222-a07d-2292f1bcbc69`
  - Status: `FAILED`
  - Railway error:
    - `Could not find root directory: /boutique-advisory-platform/frontend`

## Why the remaining two failed

The core services are not failing because of the current code changes.
They are failing because the Railway service settings still point to root directories that do not resolve in the currently connected repository layout.

This is consistent with the earlier production failures the user reported.

## Required Railway fix

In Railway dashboard for project `CamboBia`:

1. Open service `Backend`
2. Set Root Directory to:
   - `boutique-advisory-platform/backend`
3. Open service `Frontend`
4. Set Root Directory to:
   - `boutique-advisory-platform/frontend`

If Railway is already connected to this repository root, those are the correct relative paths.

If Railway is instead connected to a different repo/subtree, adjust the service root directories to match that actual checkout.

## Service mapping

- Core frontend service: `Frontend`
- Core backend service: `Backend`
- Trading frontend service: `Trading-Frontend`
- Trading backend service: `Trading`

## Safe redeploy commands

After fixing the two Railway service root directories:

```bash
cd /Users/mlh/BIA/boutique-advisory-platform/frontend
railway up -d -p ab57e56e-0928-4c69-9559-fdf1128839f1 -e production -s Frontend -m "codex: core/trade separation"

cd /Users/mlh/BIA/boutique-advisory-platform/backend
railway up -d -p ab57e56e-0928-4c69-9559-fdf1128839f1 -e production -s Backend -m "codex: core/trade separation"
```

## Verification commands

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
railway link -p CamboBia -e production -s Frontend
railway service status -a
```

## Expected post-fix state

- `Frontend`: `SUCCESS`
- `Backend`: `SUCCESS`
- `Trading-Frontend`: `SUCCESS`
- `Trading`: `SUCCESS`
