# RBAC Matrices

## SaaS operator roles

These roles are for running the platform business itself.

| Role | cambobia.com | trade.cambobia.com |
| --- | --- | --- |
| `SUPER_ADMIN` | Full platform control, tenancy, system security, admin governance | Full exchange operator control, operator governance, surveillance, finance controls |
| `ADMIN` | User/admin operations inside the core SaaS platform | User/admin operations inside the trading exchange |
| `FINOPS` | Billing, reconciliation, subscription finance, financial reports | Trade fee reconciliation, settlement oversight, payout/billing controls |
| `CX` | Support, onboarding, service operations, customer escalations | Trader onboarding, support cases, participant operations |
| `COMPLIANCE` | Investor eKYC review, legal hold, retention policy, role oversight | Listing compliance, market restrictions, eKYC/KYB review, surveillance support |
| `AUDITOR` | Audit visibility, reconciliation visibility, governance audit | Exchange audit visibility, security audit trail, fee/reconciliation audit |
| `SUPPORT` | Support tickets and operational case handling | Participant support, listing issue triage, low-risk operator tasks |

## Tenant-owner / participant roles on cambobia.com

| Role | Primary purpose | Allowed scope |
| --- | --- | --- |
| `SME` | Issuer / company owner | Company profile, data room, fundraising workflows, advisory engagement, own records |
| `INVESTOR` | Investment participant | Portfolio, investments, syndicates, marketplace discovery, investor-side records |
| `ADVISOR` | Advisory service provider | Advisory services, due diligence, pipeline assistance, managed client workflows |

## Trading participant roles on trade.cambobia.com

| Role | Primary purpose | Allowed scope |
| --- | --- | --- |
| `INVESTOR` | Trader / secondary market participant | Market discovery, watchlist, portfolio, buy flow, trader profile, trader security |

Notes:

- `SME` and `ADVISOR` are not trading participants in the separated model.
- They may influence listing eligibility through cambobia.com business workflows, but they do not operate as exchange traders on `trade.cambobia.com`.

## High-level permission model

### Core platform

- Platform operators manage the SaaS itself.
- Tenant roles manage only their own business records and workflows.
- Role switching is allowed only for `SME` and `INVESTOR` on the core platform.

### Trading platform

- Operators manage the exchange.
- Investors trade.
- Investors enter via core-platform SSO.
- Operator accounts are local to the trading tenant/runtime.
- Role switching is disabled.

## CSV exports

Detailed role/permission exports already exist in:

- `/Users/mlh/BIA/boutique-advisory-platform/RBAC_PLATFORM_OPERATOR_MATRIX.csv`
- `/Users/mlh/BIA/boutique-advisory-platform/RBAC_TENANT_OWNER_MATRIX.csv`
