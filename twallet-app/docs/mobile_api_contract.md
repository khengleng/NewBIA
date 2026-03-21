# Mobile API Contract (Unified BIA + Trading)

This document defines the mobile contract for a single app that serves:
- SME Owners (core BIA: cambobia.com)
- Investors/Traders (trading: trade.cambobia.com)
- Advisors (core advisory services)

The mobile app **must call only the mobile gateway** (BFF) endpoints. The BFF is responsible for
routing to core or trading services based on role/permission. The app should not call
service-specific APIs directly.

## Base URL

All mobile traffic:

`/api/mobile/*`

## Authentication

### POST `/api/mobile/auth/login`
Request:
```
{ "email": "...", "password": "..." }
```

Response:
```
{
  "platform": "twallet",
  "accessToken": "...",
  "refreshToken": "...",
  "token": "..."
}
```

### POST `/api/mobile/auth/refresh`
Request:
```
{ "refreshToken": "..." }
```

Response:
```
{
  "accessToken": "...",
  "refreshToken": "...",
  "token": "..."
}
```

### POST `/api/mobile/auth/logout`
Request:
```
{ "refreshToken": "..." }
```

Response: `200` with `{ "message": "Logged out" }` (or upstream equivalent).

## Identity & Role Guardrails

### GET `/api/mobile/me`
Response contract (source of truth for guardrails):
```
{
  "user": {
    "id": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "..."
  },
  "roles": ["SME_OWNER", "INVESTOR", "ADVISOR"],
  "permissions": [
    "wallet.read",
    "wallet.write",
    "deal.list",
    "secondary_trading.list"
  ],
  "platforms": {
    "core": true,
    "trading": true
  },
  "primaryRole": "SME_OWNER",
  "paymentMode": "P2P_C2B_C2C"
}
```

Notes:
- `roles` can be multiple; `primaryRole` is optional but helps default the UI.
- The app must **gate navigation and actions** using `permissions`.

### GET `/api/mobile/bootstrap`
Purpose: single round-trip to populate the home screen(s).

Response example:
```
{
  "platform": "twallet",
  "user": { ... },
  "wallet": { ... },
  "transactions": [ ... ],
  "roles": [ ... ],
  "permissions": [ ... ],
  "paymentMode": "P2P_C2B_C2C"
}
```

## Mobile Feature Surface (BFF)

### Wallet
- GET `/api/mobile/wallet`
- GET `/api/mobile/wallet/history`
- POST `/api/mobile/wallet/deposit`
- POST `/api/mobile/wallet/withdraw`
- POST `/api/mobile/wallet/transfer`

### Trading / Listings
- GET `/api/mobile/deals`
- GET `/api/mobile/secondary-trading/listings`

### Messaging
- GET `/api/mobile/messages/conversations`
- GET `/api/mobile/messages/conversations/:conversationId`
- POST `/api/mobile/messages`
- POST `/api/mobile/messages/start`

### Funding
- GET `/api/mobile/funding/aba/status/:transactionId`

## Role-to-Feature Guardrails (Baseline)

SME_OWNER:
- Core BIA features (SME profile, deal status, docs)
- Can view deals
- Wallet + payment access for peer-to-peer and C2B/C2C flows

INVESTOR / TRADER:
- Wallet + transactions
- Secondary trading listings
- Deal browsing
- Wallet + payment access for peer-to-peer and C2B/C2C flows

ADVISOR:
- Advisory cases and messaging
- Read-only access to SME profiles/deals when assigned
- Wallet + payment access for peer-to-peer and C2B/C2C flows

The server must enforce permissions. The app should only show what is allowed.
