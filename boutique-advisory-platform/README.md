# Boutique Advisory Platform

A comprehensive multi-tenant platform that connects SMEs with investors through boutique advisory services.

## 🚀 Quick Start (Local Docker)

```bash
# Start core services locally (Postgres + Core Backend + Core Frontend)
docker-compose up --build

# Access the platform
# Core Frontend: http://localhost:3002
# Core Backend:  http://localhost:3003
```

## 🛠️ Local Development & GCP Readiness

This platform is configured to run in Docker containers, making it easy to deploy to any cloud provider like **Google Cloud Platform (GCP)**, AWS, or Azure.

### Local Setup
1. Ensure Docker Desktop is installed and running.
2. Clone the repository and run `docker-compose up --build`.

### GCP Porting Plan (Coming Soon)
1. Build frontend and backend Docker images.
2. Push images to **Google Artifact Registry**.
3. Deploy to **Cloud Run** or **Google Kubernetes Engine (GKE)**.
4. Use **Cloud SQL** (PostgreSQL) for the database.

---

## 👤 Demo Accounts

After deployment, the database is automatically seeded. All initial accounts use the `INITIAL_ADMIN_PASSWORD` set in `docker-compose.yml`.

**Default Password:** `BIA_Local_Admin_123!`

| Role | Email |
|------|-------|
| Admin | admin@boutique-advisory.com |
| Advisor | advisor@boutique-advisory.com |
| Investor | investor@boutique-advisory.com |
| SME | sme@boutique-advisory.com |


## 📊 Features

### Core Modules
- **SME Management** - Registration, certification, scoring
- **Investor Portal** - KYC, portfolio management
- **Advisory Dashboard** - Pipeline management, workflows
- **Deal Room** - Matchmaking, deal structuring

### Advanced Features
- **Syndicates** - Group investing (AngelList-style)
- **Due Diligence** - Scoring and risk assessment
- **Community** - Posts, comments, engagement
- **Secondary Trading** - Share marketplace

### Platform Features
- Multi-tenant architecture
- Role-based access control (6 roles)
- Multi-language support (EN, KM, ZH)
- PWA support (Service Workers & Offline access)
- **Cloud File Storage** - S3/R2 integration for documents
- **Secure Downloads** - Presigned URLs with access control
- **Email Notifications** - Automated emails via Resend (welcome, password reset, notifications)

## 📁 Project Structure

```
boutique-advisory-platform/
├── core-backend/         # Core Node.js + Express API
├── core-frontend/        # Core Next.js web app (cambobia.com)
├── trade-api/            # Trading API (orderbook & market)
├── identity-service/     # Auth & identity
├── wallet-service/       # Wallet & balances
├── funding-service/      # Funding & payments
├── market-service/       # Market & secondary trading
├── advisory-service/     # Advisory workflows
├── document-service/     # Document management
├── twallet-bff-service/  # Mobile BFF for TWallet
├── mobile-bot-service/   # Telegram/mobile bot service
├── bia-frontend/         # Legacy/admin frontend (if used)
├── trading-frontend/     # Trading UI (trade.cambobia.com)
└── docker-compose.yml    # Local multi-container setup
```

## 🔧 Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 3001) |
| `NODE_ENV` | Yes | `production` for cloud, `development` for local |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token key |
| `FRONTEND_URL` | Yes | Frontend URL for CORS |
| `INITIAL_ADMIN_PASSWORD` | Yes | Password for local admin creation |
| `S3_ENDPOINT` | Optional | S3/R2 endpoint URL for file storage |
| `S3_REGION` | Optional | S3 region (use 'auto' for Cloudflare R2) |
| `S3_ACCESS_KEY_ID` | Optional | S3/R2 access key |
| `S3_SECRET_ACCESS_KEY` | Optional | S3/R2 secret key |
| `S3_BUCKET_NAME` | Optional | S3/R2 bucket name |
| `RESEND_API_KEY` | Optional | Resend API key for email notifications |
| `EMAIL_FROM` | Optional | Sender email address (default: contact@cambobia.com) |
| `ENCRYPTION_KEY` | **Required** (Prod) | 32-byte hex string for AES-256-GCM encryption |
| `ANTHROPIC_API_KEY` | Optional | Anthropic Claude API Key for AI features (v3.0+) |
| `SUMSUB_APP_TOKEN` | Optional | Sumsub App Token for KYC |
| `SUMSUB_SECRET_KEY` | Optional | Sumsub Secret Key for KYC |
| `GEMINI_API_KEY` | Deprecated | Replaced by Anthropic |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (passed as build arg) |

### Service Note

Most services include their own `DATABASE_URL` and Prisma client. In the current setup, many services share the same schema, so keep migrations and database access coordinated.

## 🔐 Security Notes

- Change demo account passwords after first setup.
- Use strong, unique JWT secrets in production.
- Review CORS settings in `docker-compose.yml` or cloud config.
- Databases should always use SSL in production (`sslmode=require`).

### Encryption & Data Protection

The platform implements **AES-256-GCM** encryption for sensitive Personally Identifiable Information (PII) at rest.

- **Algorithm**: AES-256-GCM (Galois/Counter Mode) gives both confidentiality and integrity.
- **Key Management**: Uses `ENCRYPTION_KEY` environment variable (32-byte hex string).
- **Implementation**:
    - Random 12-byte IV (Initialization Vector) generated for every encryption.
    - Authentication Tag stored with cipher text to prevent tampering.
- **Scope**:
    - **Investor KYC Data**: Identity Numbers (National ID/Passport) are encrypted before storage.
    - **API Responses**: Sensitive PII is automatically decrypted for authorized owners/admins but masked or omitted for others.

### Data Masking

- **List Views**: Sensitive fields (like ID numbers, phone numbers) are stripped from all list API responses.
- **Role-Based Access**:
    - **Investors**: Can only view/decrypt their own data.
    - **Admins**: Can view/decrypt all user data for compliance.
    - **Public/Other Users**: Receive sanitized objects with sensitive fields removed.

### PCI DSS Compliance

The platform is designed to align with **PCI DSS** standards for handling sensitive data:

1.  **Cardholder Data (CHD)**:
    - We **NEVER** store Primary Account Numbers (PAN) or sensitive authentication data (CAV2/CVC2).
    - All payments are processed via **Stripe**, which uses tokenization to keep CHD off our servers entirely (SAQ A compliance).

2.  **Key Management (Requirement 3)**:
    - In production, `ENCRYPTION_KEY` **MUST** be injected via a secure Key Management Service (KMS) or Secrets Manager (e.g., AWS Secrets Manager, HashiCorp Vault).
    - The code explicitly fails to start in `production` mode if a secure key is not provided (preventing use of fallback keys).
    - Keys should be rotated annually.

3.  **Data Minimization (Requirement 3.4)**:
    - Only essential PII (e.g., National IDs for KYC) is stored, and it is strictly encrypted using AES-256-GCM.
    - Rendered PII is masked (e.g., `********`) wherever possible in the UI.

### 🛡️ Enterprise-Grade Hardening (Audit Fixes)

The platform has been hardened against modern attack vectors following a manual security audit:

1.  **Strict Content Security Policy (CSP)**:
    - Removed `unsafe-eval` and `unsafe-inline` for scripts in production.
    - Explicitly defined safe sources (self, Stripe, Sumsub).
2.  **HSTS & SSL Protection**:
    - Enforced `Strict-Transport-Security` (2-year max-age, includeSubDomains, preload).
    - Prevents protocol downgrade (SSL Stripping) attacks.
3.  **API URL Masking (Internal Proxy)**:
    - Implemented `/api-proxy` on the frontend.
    - The direct Railway backend URL is **never** exposed to the client browser or CSP headers.
4.  **Framework Obscurity**:
    - `X-Powered-By` header disabled in both Next.js and Express to prevent framework fingerprinting.
5.  **Hardened Headers**:
    - Added `Permissions-Policy` (camera=(), microphone=(), etc.).
    - Implemented `COOP` (Cross-Origin-Opener-Policy), `CORP` (Cross-Origin-Resource-Policy), and `COEP` (Cross-Origin-Embedder-Policy).
6.  **Authenticated Cache Control**:
    - Sensitive routes (`/dashboard`, `/admin`, `/profile`) use `Cache-Control: no-store` to prevent data leakage via CDNs or shared devices.
7.  **WebSocket Security**:
    - Socket.io origins are strictly validated against production domains.
8.  **Crawler & SEO Control**:
    - Added comprehensive `robots.txt` to block indexing of `/admin`, `/api`, and private user routes.
    - Added `sitemap.xml` for optimized search engine discovery of public pages.
9.  **Breached Password Enforcement**:
    - Real-time checks for breached passwords during registration, reset, and change using `isBreachedPassword` utility.
10. **Session Revocation (Security Events)**:
    - Automatic revocation of all refresh tokens upon 2FA activation/deactivation, password reset, and password change.
    - Prevents session hijacking after credential updates.
11. **Strict CORS Lockdown**:
    - Production CORS strictly enforces `FRONTEND_URL` and rejects requests with no `Origin` header (e.g., unauthorized `curl` requests).
12. **Automated Security CI**:
    - GitHub Actions automated workflow for verifying security headers and encryption key enforcement on every push.
13. **Encryption Key Enforcement**:
    - Critical startup check ensures `ENCRYPTION_KEY` is present and meets strength requirements (min 32 chars) in production.
    - Server fails to start if insecure defaults are detected in production.

---

**Boutique Advisory Platform** → Connecting SMEs and Investors
