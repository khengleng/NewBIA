# ===========================================
# PLATFORM 1: BOUTIQUE ADVISORY (BIA)
# ===========================================

# 1. CORE SERVICE (Boutique Advisory Workflow API)
# Path: ./boutique-advisory-platform/core-backend
BIA_CORE_PORT=3001
BIA_CORE_DATABASE_URL=postgresql://user:password@host:5432/bia_core?sslmode=require
BIA_CORE_JWT_SECRET=super-secret-bia-core-key
BIA_CORE_FRONTEND_URL=http://localhost:3000

# 2. IDENTITY SERVICE (BIA Identity & Auth)
# Path: ./boutique-advisory-platform/identity-service
BIA_IDENTITY_PORT=3002
BIA_IDENTITY_DATABASE_URL=postgresql://user:password@host:5432/bia_identity?sslmode=require
BIA_IDENTITY_JWT_SECRET=super-secret-bia-identity-key

# 3. ADVISORY SERVICE (Specialized Advisory Logic)
# Path: ./boutique-advisory-platform/advisory-service
BIA_ADVISORY_PORT=3007
BIA_ADVISORY_DATABASE_URL=postgresql://user:password@host:5432/bia_advisory?sslmode=require

# 4. FRONTEND (BIA Web Dashboard)
# Path: ./boutique-advisory-platform/bia-frontend
NEXT_PUBLIC_BIA_API_URL=http://localhost:3001


# ===========================================
# PLATFORM 2: TRADING & TWALLET
# ===========================================

# 1. TRADE API (Orderbook & Market Logic)
# Path: ./boutique-advisory-platform/trade-api
TRADE_API_PORT=3003
TRADE_API_DATABASE_URL=postgresql://user:password@host:5432/trade_platform?sslmode=require
TRADE_API_JWT_SECRET=super-secret-trade-key

# 2. WALLET SERVICE (Asset & Balance Management)
# Path: ./boutique-advisory-platform/wallet-service
WALLET_SERVICE_PORT=3004
WALLET_SERVICE_DATABASE_URL=postgresql://user:password@host:5432/wallet_service?sslmode=require

# 3. TWALLET BFF (Mobile Backend for TWallet App)
# Path: ./boutique-advisory-platform/twallet-bff-service
TWALLET_BFF_PORT=3010
TW_IDENTITY_SERVICE_URL=http://localhost:3002
TW_WALLET_SERVICE_URL=http://localhost:3004
TW_TRADE_API_URL=http://localhost:3003

# 4. TRADING FRONTEND (Professional Trading Web UI)
# Path: ./boutique-advisory-platform/trading-frontend
NEXT_PUBLIC_TRADING_API_URL=http://localhost:3003

# 5. TWALLET MOBILE APP (Flutter)
# Path: ./twallet-app
# Configure in: twallet-app/lib/models/env.dart
# Set apiGatewayBaseUrl to point to your TWALLET_BFF URL
