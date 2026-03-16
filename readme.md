# Boutique Advisory Platform – README.md

This document provides a complete technical and functional instruction set for building the **Boutique Advisory Platform**, a multi-tenant, workflow-automated, and multilingual (Khmer, English, Chinese) system that connects SMEs with investors, supported by boutique advisory services. It is structured so **Cursor AI** can execute the development directly.

---

## 📌 Project Overview
**Boutique Advisory** combines:
- **Advisory services** (investment readiness, governance, compliance support).
- **Digital platform** (deal room, investor dashboard, matchmaking engine).
- **Ongoing post-funding support** (reporting, governance, risk management).

The platform must support:
- **Multi-tenancy**: separate organizations with isolated data, branding, and user management.
- **Workflow automation**: automated SME certification, investor onboarding, deal workflows.
- **Multi-language support**: Khmer, English, and Chinese across all interfaces.

---

## 🚀 Core Features

### 1. SME Module
- Registration & onboarding forms.
- Upload pitch decks, financials, supporting docs.
- Scoring model (governance, financial health, readiness).
- Certification workflow: advisors validate and certify SMEs.

### 2. Advisory Module
- Advisor dashboard: SME pipeline, certification tasks.
- Workflow checklists, gap analysis, automated reminders.
- Approvals with maker-checker logic.

### 3. Investor Module
- Registration with **KYC/AML**.
- Preferences (sector, geography, ticket size).
- Dashboard with certified SMEs.
- Q&A and secure messaging with SMEs.

### 4. Deal Room / Matchmaking
- Certified SMEs displayed in a central deal room.
- Matchmaking engine: match SME attributes to investor preferences.
- Advisory-led deal structuring (term sheets, valuation tools).

### 5. Funding & Transactions
- Optional escrow integration.
- Success fee tracking (Boutique Advisory revenue).
- Transaction records (blockchain-ready for audit).

### 6. Post-Funding Support
- Advisory subscription packages for SMEs.
- Quarterly investor dashboards (KPIs, ROI).
- Governance and compliance monitoring tools.

### 7. Admin & Compliance
- Multi-tenant management (per-organization isolation).
- User roles: SME, Investor, Advisor, Admin.
- KYC/AML compliance workflows.
- Full audit logs.

### 8. Internationalization (i18n)
- Khmer, English, Chinese.
- Dynamic language switching.
- Localized UI, notifications, reports.

---

## 🏗️ System Architecture

### Suggested Stack
- **Frontend:** Next.js (React), React Native (mobile). Use `react-i18next` for i18n.
- **Backend:** Node.js + Express (REST API).
- **Database:** PostgreSQL (multi-tenant schema design with tenant_id).
- **ORM:** Prisma or Sequelize.
- **File Storage:** AWS S3 for SME docs.
- **Authentication:** JWT/OAuth2. Future: DID integration (VaultID).
- **Workflow Automation:** Temporal.io or Camunda.
- **KYC/AML:** Third-party API integration (e.g., Onfido, Sumsub).
- **Blockchain:** Optional (Ethereum/Polygon/Hyperledger) for immutable records.

### High-Level Modules
- `auth-service`: user login, roles, tenant context.
- `tenant-service`: multi-tenant management.
- `sme-service`: SME onboarding, scoring, certification.
- `advisory-service`: workflows, checklists, approvals.
- `investor-service`: preferences, dashboards.
- `dealroom-service`: matchmaking, deal structuring.
- `funding-service`: transactions, escrow, fees.
- `reporting-service`: dashboards, KPIs.
- `i18n-service`: translations for Khmer, English, Chinese.
- `admin-service`: compliance, audit logs.

---

## 🔐 Roles & Permissions
- **SME:** onboard, upload docs, request certification.
- **Advisor:** certify SMEs, manage deals, advisory tools.
- **Investor:** access certified SMEs, invest, monitor portfolio.
- **Admin:** manage tenants, users, workflows, compliance.

---

## 📊 Data Models

### Tenant
```json
{
  "id": "uuid",
  "name": "string",
  "settings": {
    "language": "en|km|zh",
    "branding": { "logo": "url", "theme": "string" }
  }
}
```

### SME
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "string",
  "sector": "string",
  "stage": "seed|growth|expansion",
  "funding_required": "number",
  "documents": ["urls"],
  "score": "number",
  "certified": "boolean"
}
```

### Investor
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "string",
  "kyc_status": "pending|verified",
  "preferences": { "sector": "string", "ticket_size": "number" },
  "portfolio": ["deal_ids"]
}
```

### Deal
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "sme_id": "uuid",
  "investor_ids": ["uuid"],
  "status": "negotiation|funded|closed",
  "amount": "number",
  "success_fee": "number"
}
```

---

## 🛠️ Development Instructions (Cursor AI)

### 1. Initialize Project
```bash
npx create-next-app boutique-advisory-frontend
mkdir boutique-advisory-backend && cd boutique-advisory-backend && npm init -y
```

### 2. Backend Setup
- Use Express with modular routes: `/auth`, `/sme`, `/investors`, `/deals`, `/funding`, `/tenant`, `/workflow`, `/admin`.
- Add tenant-aware middleware: extract `tenant_id` from JWT or request header.
- Connect PostgreSQL with Prisma ORM.
- Implement KYC mock service first, then plug into Onfido API.

### 3. Frontend Setup
- Use Next.js + TailwindCSS.
- Add `react-i18next` for multi-language support.
- Pages: `/login`, `/register`, `/dashboard`, `/smes`, `/investors`, `/dealroom`.
- Components: SMECard, InvestorCard, DealRoomList, AdvisorDashboard.

### 4. Workflow Automation
- Integrate Temporal.io.
- Define workflows: SME certification, investor onboarding, deal approval.
- Automate reminders and status updates.

### 5. File Uploads
- Integrate AWS S3 SDK.
- SMEs upload pitch decks, financials.
- Store S3 URLs in PostgreSQL.

### 6. Matchmaking Engine
- Rule-based filter: match SME sector/stage to investor preferences.
- Later add ML model for scoring.

### 7. Post-Funding Reporting
- Create reporting microservice.
- Investor dashboard with SME KPIs (quarterly).

### 8. Internationalization
- Create `/locales/en.json`, `/locales/km.json`, `/locales/zh.json`.
- Implement language switcher on frontend.
- Translate all UI strings, notifications, and reports.

### 9. Multi-Tenancy
- Ensure all tables include `tenant_id`.
- Tenant isolation in queries.
- Admin UI for tenant onboarding, branding, and language default.

### 10. Blockchain Integration (Optional Future)
- Smart contract to log deals (deal_id, amount, parties).
- Explorer view for transparency.

---

## 📱 TWallet mobile companion
- The Flutter mobile app lives inside `twallet-app` and runs independently from the cambobia.com + trade.cambobia.com web apps.
- Its CI job (`.github/workflows/twallet-flutter.yml`) fires only when `twallet-app/**` changes, so the existing web deployments remain unaffected.
- Release artifacts are produced in GitHub Actions (`flutter build appbundle --release` and `flutter build apk --release`) and stored as workflow artifacts. Use Fastlane or your chosen tool to sign and upload those binaries to the Google Play Store and Apple App Store. iOS builds require macOS runners (not covered by this workflow) so perform them manually or via a separate macOS job.
- The mobile app consumes the same Railway-hosted APIs that service cambobia.com and trade.cambobia.com (authentication, listings, portfolios, notifications) so investor/SME data stays consistent between web and mobile.
- A quick browser preview is available by running `flutter build web --release` in CI and publishing the generated `twallet-app/build/web` output via the GitHub Pages deploy action; the workflow handles the upload/deploy so no manual Pages setup is needed once Actions completes.
- CI badge: ![TWallet Flutter](https://github.com/khengleng/BIA/actions/workflows/twallet-flutter.yml/badge.svg)\n


## 📎 Notes for Developers
- Enforce **multi-tenant isolation** in all database queries.
- Design workflows as reusable components.
- Build i18n into the system from day one.
- Use modular microservices so additional features (VaultID, blockchain) can be integrated later.

---
Platform description:
**Boutique Advisory** → Bridging SMEs and Investors with trust, governance, and smart technology.




