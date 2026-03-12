# Railway.com Deployment Guide

## 🧩 Platform Architecture

The system is now separated into independent codebases for better scalability and CI/CD control.

| Platform | Repository | Domain | Role |
| :--- | :--- | :--- | :--- |
| **Core Platform** | `boutique-advisory-frontend` | `www.cambobia.com` | SME Advisory & Investments |
| **Trading Platform** | `boutique-advisory-platform/trade-frontend` | `trade.cambobia.com` | Secondary Market Trading |
| **API Backend** | `boutique-advisory-platform/backend` | `api.cambobia.com` | Shared Business Logic |
| **T-Wallet** | `twallet-app` | `wallet.cambobia.com` | Digital Asset Management |

---

## 🚀 Deployment Steps

### 1. Core Platform (`www.cambobia.com`)
This is now a standalone repository.
1. Link your Railway service to the `boutique-advisory-frontend` repo.
2. Set `NEXT_PUBLIC_PLATFORM_MODE=core` in the environment variables.
3. Ensure `NEXT_PUBLIC_API_URL` points to your backend.

### 2. Trading Platform (`trade.cambobia.com`)
This remains in the monorepo but has its own root directory.
1. Link your Railway service to the `boutique-advisory-platform` repo.
2. Set **Root Directory** to `/trade-frontend`.
3. Set `NEXT_PUBLIC_PLATFORM_MODE=trading`.

### 3. API Backend
1. Link to `boutique-advisory-platform` repo.
2. Set **Root Directory** to `/backend`.
3. Ensure `DATABASE_URL` and `REDIS_URL` are connected.

### 4. T-Wallet App
1. Link to `twallet-app` repo.
2. Railway will detect the `Dockerfile` and build the Flutter Web version.

---

## 🔐 Required Environment Variables

### Backend Service
```
DATABASE_URL=<Railway PostgreSQL URL>
REDIS_URL=<Railway Redis URL>
JWT_SECRET=<your-jwt-secret>
PORT=8080
FRONTEND_URL=https://www.cambobia.com
TRADING_FRONTEND_URL=https://trade.cambobia.com
```

### Frontend Services (Core & Trade)
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_PLATFORM_MODE=core (or trading)
```

---

## 🧪 Post-Deployment Checklist

- [ ] **Core Platform**: SME dashboard loads at `/dashboard`.
- [ ] **Trading Platform**: Trading interface loads at `/secondary-trading`.
- [ ] **SSO**: Log in to Core and click "Trade" to verify seamless handover.
- [ ] **Wallet**: QR scanner and transaction history working.

---

## 📞 Support
- Railway Docs: https://docs.railway.app
- Check deployment logs for specific errors.or both services
