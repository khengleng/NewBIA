# NOTE: Each service has its own environment. Do not combine these into one .env file.
# Use the block that matches the service you are configuring.
#
# ===========================================
# PLATFORM 1: BOUTIQUE ADVISORY (BIA)
# ===========================================

# 1. CORE BACKEND (Boutique Advisory Workflow API)
# Path: ./boutique-advisory-platform/core-backend
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/bia_core?sslmode=require
JWT_SECRET=super-secret-bia-core-key
JWT_REFRESH_SECRET=super-secret-bia-core-refresh-key
FRONTEND_URL=http://localhost:3002
CORS_ORIGIN=http://localhost:3002
INITIAL_ADMIN_PASSWORD=SecurePassword123!
ENCRYPTION_KEY=32_byte_hex_key_here

# 2. IDENTITY SERVICE (BIA Identity & Auth)
# Path: ./boutique-advisory-platform/identity-service
PORT=3007
DATABASE_URL=postgresql://user:password@host:5432/bia_identity?sslmode=require
JWT_SECRET=super-secret-bia-identity-key
REDIS_URL=redis://user:password@host:6379
CORS_ORIGIN=http://localhost:3002
TRADING_FRONTEND_URL=http://localhost:3002

# 3. ADVISORY SERVICE (Specialized Advisory Logic)
# Path: ./boutique-advisory-platform/advisory-service
PORT=3005
DATABASE_URL=postgresql://user:password@host:5432/bia_advisory?sslmode=require
JWT_SECRET=super-secret-bia-advisory-key

# 4. DOCUMENT SERVICE
# Path: ./boutique-advisory-platform/document-service
PORT=3004
DATABASE_URL=postgresql://user:password@host:5432/bia_documents?sslmode=require
JWT_SECRET=super-secret-bia-document-key

# 5. CORE FRONTEND (cambobia.com)
# Path: ./boutique-advisory-platform/core-frontend
NEXT_PUBLIC_API_URL=http://localhost:3003
NEXT_PUBLIC_PLATFORM_MODE=core

# 6. BIA FRONTEND (legacy/admin if used)
# Path: ./boutique-advisory-platform/bia-frontend
NEXT_PUBLIC_API_URL=http://localhost:3003


# ===========================================
# PLATFORM 2: TRADING & TWALLET
# ===========================================

# 1. TRADE API (Orderbook & Market Logic)
# Path: ./boutique-advisory-platform/trade-api
PORT=3006
DATABASE_URL=postgresql://user:password@host:5432/trade_platform?sslmode=require
JWT_SECRET=super-secret-trade-key
CORS_ORIGIN=http://localhost:3002

# 2. WALLET SERVICE (Asset & Balance Management)
# Path: ./boutique-advisory-platform/wallet-service
PORT=3008
DATABASE_URL=postgresql://user:password@host:5432/wallet_service?sslmode=require
JWT_SECRET=super-secret-wallet-key
REDIS_URL=redis://user:password@host:6379
CORS_ORIGIN=http://localhost:3002
TRADING_FRONTEND_URL=http://localhost:3002

# 3. FUNDING SERVICE (Payments & Escrow)
# Path: ./boutique-advisory-platform/funding-service
PORT=3009
DATABASE_URL=postgresql://user:password@host:5432/funding_service?sslmode=require
JWT_SECRET=super-secret-funding-key
REDIS_URL=redis://user:password@host:6379
CORS_ORIGIN=http://localhost:3002
TRADING_FRONTEND_URL=http://localhost:3002

# 4. MARKET SERVICE (Secondary Market)
# Path: ./boutique-advisory-platform/market-service
PORT=3006
DATABASE_URL=postgresql://user:password@host:5432/market_service?sslmode=require
JWT_SECRET=super-secret-market-key
CORS_ORIGIN=http://localhost:3002
TRADING_FRONTEND_URL=http://localhost:3002

# 5. TWALLET BFF (Mobile Backend for TWallet App)
# Path: ./boutique-advisory-platform/twallet-bff-service
PORT=3010
IDENTITY_SERVICE_URL=http://localhost:3007
WALLET_SERVICE_URL=http://localhost:3008
FUNDING_SERVICE_URL=http://localhost:3009
MARKET_SERVICE_URL=http://localhost:3006
TRADE_API_URL=http://localhost:3006
MOBILE_APP_URL=https://mobile-app-production-bf9a.up.railway.app
TRADING_FRONTEND_HOST=trade.cambobia.com
CORS_ORIGIN=https://trade.cambobia.com,https://mobile-app-production-bf9a.up.railway.app

# 6. TRADING FRONTEND (Professional Trading Web UI)
# Path: ./boutique-advisory-platform/trading-frontend
NEXT_PUBLIC_API_URL=http://localhost:3006
NEXT_PUBLIC_PLATFORM_MODE=trading

# 7. MOBILE BOT SERVICE (Telegram / Mobile Bot)
# Path: ./boutique-advisory-platform/mobile-bot-service
PORT=3005
DATABASE_URL=postgresql://user:password@host:5432/bia_core?sslmode=require
JWT_SECRET=super-secret-bot-key
INTERNAL_API_KEY=dev-internal-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
