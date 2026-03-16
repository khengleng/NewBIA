# Cambobia Mobile Credential Cutover

## Purpose

The mobile app code is now rebranded to Cambobia:

- Android application ID: `com.cambobia.mobile`
- iOS bundle ID: `com.cambobia.mobile`
- Redirect URI default: `com.cambobia.mobile://auth`

Before store release or production mobile testing, the runtime credentials and mobile service identities must be rotated to match these new values.

## Required credential updates

### Firebase

Replace these files with Cambobia-owned production or staging app configs:

- `android/app/google-services.json`
- `ios/Runner/GoogleService-Info.plist`

The current files still reference legacy Thoughtworks app identities.

### Web3Auth

Provision and register Cambobia-owned values for:

- `CAMBOBIA_WEB3AUTH_CLIENT_ID`
- `CAMBOBIA_WEB3AUTH_REDIRECT_URI`

Recommended redirect URI:

- `com.cambobia.mobile://auth`

## Required Dart defines

Provide these in CI and local release builds:

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
- `CAMBOBIA_WEB3AUTH_CLIENT_ID`
- `CAMBOBIA_WEB3AUTH_REDIRECT_URI`
- `SENTRY_DSN` (optional)

## Android checklist

1. Create a Cambobia Android app in Firebase with package:
   - `com.cambobia.mobile`
2. Download new `google-services.json`
3. Replace the existing file in:
   - `android/app/google-services.json`
4. Verify Play signing configuration
5. Build:

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --release --dart-define-from-file=.env.production.json
flutter build appbundle --release --dart-define-from-file=.env.production.json
```

## iOS checklist

1. Create a Cambobia iOS app in Firebase with bundle ID:
   - `com.cambobia.mobile`
2. Download new `GoogleService-Info.plist`
3. Replace the existing file in:
   - `ios/Runner/GoogleService-Info.plist`
4. Register the redirect URI with Web3Auth
5. Build on macOS:

```bash
flutter pub get
flutter analyze
flutter test
flutter build ipa --release --dart-define-from-file=.env.production.json
```

## Smoke test after cutover

Verify:

1. Investor login from Cambobia identity path
2. SME owner login against core-platform APIs only
3. Portfolio and holdings data load correctly
4. Trading-linked wallet actions resolve against the correct API base URL
5. No legacy Thoughtworks Firebase or auth identities appear in runtime logs
