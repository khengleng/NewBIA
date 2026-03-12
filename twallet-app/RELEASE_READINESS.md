# Cambobia Mobile Release Readiness

## Purpose

`twallet-app` is the native mobile companion for Cambobia users:

- Investors who need portfolio/trading access
- SME owners who need issuer-side mobile capabilities on the core platform

It is not a deployment target for Railway. Railway should host the APIs the mobile app consumes.

## Required environment values

Provide these with `--dart-define` during CI or store builds:

- `CAMBOBIA_API_BASE_URL`
- `CAMBOBIA_WEB3_RPC_URL`
- `CAMBOBIA_DID_PREFIX`
- `CAMBOBIA_TOKEN_NAME`
- `CAMBOBIA_TOKEN_SYMBOL`
- `CAMBOBIA_CHAIN_ID`
- `CAMBOBIA_TOKEN_PRECISION`
- `CAMBOBIA_TOKEN_HUMAN_PRECISION`
- `CAMBOBIA_API_TIMEOUT_MS`
- `CAMBOBIA_CENTRAL_BANK_PUBLIC_KEY`
- `PINCODE_JWT_SECRET`
- `SENTRY_DSN` (optional)

## Security hardening already applied

- Default API/RPC branding now points to Cambobia-oriented values instead of Thoughtworks endpoints.
- Sentry is disabled unless `SENTRY_DSN` is explicitly supplied.
- `PINCODE_JWT_SECRET` is now mandatory for release builds.

## Remaining release blockers

- Rotate and re-issue mobile identity assets and runtime credentials for Cambobia-owned apps:
  - `android/app/google-services.json`
  - `ios/Runner/GoogleService-Info.plist`
  - `CAMBOBIA_WEB3AUTH_CLIENT_ID`
  - `CAMBOBIA_WEB3AUTH_REDIRECT_URI`
- Replace legacy Thoughtworks URLs, images, and app copy throughout the app.
- Validate all mobile endpoints against Cambobia production or staging APIs.
- Decide whether SME owner and investor flows live in one app or in role-gated modules inside the same app.

## App Store / Play Store checklist

### Identity and branding

- Verify bundle/application IDs are locked to Cambobia-owned identifiers:
  - `com.cambobia.mobile`
- Update icons, splash assets, legal text, and support URLs.

### Authentication

- Confirm investor login flow against cambobia.com auth/SSO.
- Confirm SME mobile flow against core-platform APIs only.
- Confirm trading access is investor-only where required by product policy.

### Secrets

- Move signing keys and Firebase credentials into CI secret storage.
- Do not commit production mobile secrets.

### CI/CD

- Android:
  - `flutter analyze`
  - `flutter test`
  - `flutter build apk --release`
  - `flutter build appbundle --release`
- iOS:
  - `flutter build ipa --release`
  - Fastlane signing/upload on macOS

### Product validation

- Investor:
  - portfolio
  - watchlist
  - market discovery
  - trading status
  - notifications
- SME owner:
  - issuer profile
  - fundraising/deal visibility
  - document flow
  - platform messages/alerts

## Recommended next implementation steps

1. Replace remaining legacy URLs/assets across the codebase.
2. Add environment-specific build flavors (`dev`, `staging`, `prod`).
3. Wire the mobile app to the separated Cambobia and Trade APIs.
4. Provision Cambobia-owned Firebase and Web3Auth credentials for release.
