# RBAC Structure Matrix

Legend:
- `D` = direct permission
- `I` = inherited permission via role hierarchy
- `O` = owner-only permission
- `OI` = owner-only permission inherited via hierarchy

## SaaS Operator Roles

| Role | Total | Direct | Inherited | Owner-only |
|---|---:|---:|---:|---:|
| SUPER_ADMIN | 184 | 184 | 0 | 0 |
| ADMIN | 172 | 171 | 1 | 0 |
| FINOPS | 18 | 18 | 0 | 0 |
| CX | 28 | 28 | 0 | 0 |
| AUDITOR | 13 | 13 | 0 | 0 |
| COMPLIANCE | 18 | 18 | 0 | 0 |
| SUPPORT | 49 | 49 | 0 | 0 |

## Tenant Owner Roles

| Role | Total | Direct | Inherited | Owner-only |
|---|---:|---:|---:|---:|
| ADVISOR | 86 | 72 | 0 | 14 |
| INVESTOR | 61 | 45 | 0 | 16 |
| SME | 60 | 35 | 0 | 25 |

## Domain Coverage (permission count by domain prefix)

### SaaS Operator Roles

| Domain | SUPER_ADMIN | ADMIN | FINOPS | CX | AUDITOR | COMPLIANCE | SUPPORT |
|---|---:|---:|---:|---:|---:|---:|---:|
| admin | 5 | 3 | 0 | 0 | 0 | 0 | 0 |
| advisor | 5 | 5 | 0 | 0 | 0 | 0 | 2 |
| advisor_assignment | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| advisor_capacity | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| advisor_conflict | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| advisor_ops | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| advisory_service | 6 | 6 | 0 | 0 | 0 | 0 | 2 |
| ai | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| analytics | 3 | 2 | 2 | 1 | 2 | 0 | 0 |
| audit_log | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| billing | 2 | 2 | 2 | 0 | 1 | 0 | 0 |
| calendar | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| case | 6 | 6 | 0 | 6 | 0 | 4 | 6 |
| certification | 5 | 5 | 0 | 0 | 0 | 0 | 2 |
| community | 9 | 9 | 0 | 0 | 0 | 0 | 2 |
| dashboard | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| data_governance | 1 | 1 | 0 | 0 | 1 | 1 | 0 |
| dataroom | 5 | 5 | 0 | 0 | 0 | 0 | 2 |
| deal | 6 | 6 | 0 | 0 | 0 | 0 | 2 |
| dispute | 4 | 3 | 0 | 0 | 0 | 0 | 0 |
| document | 6 | 6 | 0 | 0 | 0 | 0 | 2 |
| due_diligence | 5 | 5 | 0 | 0 | 0 | 0 | 2 |
| escalation | 1 | 1 | 0 | 1 | 0 | 0 | 1 |
| investor | 7 | 7 | 0 | 0 | 0 | 0 | 2 |
| investor_ops | 4 | 4 | 0 | 2 | 0 | 4 | 0 |
| invoice | 2 | 2 | 2 | 0 | 1 | 0 | 0 |
| legal_hold | 3 | 3 | 0 | 0 | 1 | 3 | 0 |
| matchmaking | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| notification | 5 | 5 | 0 | 0 | 0 | 0 | 2 |
| onboarding_task | 5 | 5 | 0 | 5 | 0 | 0 | 5 |
| onboarding_template | 5 | 5 | 0 | 2 | 0 | 0 | 2 |
| payment | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| reconciliation | 4 | 4 | 4 | 0 | 2 | 0 | 0 |
| report | 6 | 6 | 4 | 3 | 0 | 0 | 0 |
| retention_rule | 2 | 2 | 0 | 0 | 1 | 2 | 0 |
| role_grant | 3 | 3 | 0 | 0 | 1 | 1 | 0 |
| role_request | 3 | 3 | 0 | 0 | 0 | 0 | 1 |
| secondary_trading | 4 | 3 | 3 | 3 | 3 | 3 | 3 |
| settings | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| sme | 7 | 7 | 0 | 0 | 0 | 0 | 2 |
| subscription | 2 | 2 | 1 | 1 | 0 | 0 | 1 |
| support_ticket | 4 | 4 | 0 | 3 | 0 | 0 | 4 |
| syndicate | 6 | 6 | 0 | 0 | 0 | 0 | 2 |
| tenant | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| user | 6 | 5 | 0 | 0 | 0 | 0 | 0 |
| workflow | 5 | 5 | 0 | 0 | 0 | 0 | 2 |

### Tenant Owner Roles

| Domain | ADVISOR | INVESTOR | SME |
|---|---:|---:|---:|
| admin | 0 | 0 | 0 |
| advisor | 3 | 0 | 0 |
| advisor_assignment | 0 | 0 | 0 |
| advisor_capacity | 0 | 0 | 0 |
| advisor_conflict | 0 | 0 | 0 |
| advisor_ops | 0 | 0 | 0 |
| advisory_service | 6 | 2 | 2 |
| ai | 1 | 1 | 1 |
| analytics | 1 | 0 | 0 |
| audit_log | 0 | 0 | 0 |
| billing | 0 | 0 | 0 |
| calendar | 3 | 3 | 3 |
| case | 0 | 0 | 0 |
| certification | 5 | 0 | 1 |
| community | 8 | 8 | 8 |
| dashboard | 1 | 1 | 1 |
| data_governance | 0 | 0 | 0 |
| dataroom | 3 | 2 | 5 |
| deal | 6 | 4 | 3 |
| dispute | 0 | 2 | 2 |
| document | 6 | 3 | 6 |
| due_diligence | 5 | 2 | 2 |
| escalation | 0 | 0 | 0 |
| investor | 5 | 3 | 2 |
| investor_ops | 0 | 0 | 0 |
| invoice | 0 | 0 | 0 |
| legal_hold | 0 | 0 | 0 |
| matchmaking | 4 | 3 | 3 |
| notification | 4 | 4 | 4 |
| onboarding_task | 0 | 0 | 0 |
| onboarding_template | 0 | 0 | 0 |
| payment | 3 | 3 | 3 |
| reconciliation | 0 | 0 | 0 |
| report | 5 | 3 | 3 |
| retention_rule | 0 | 0 | 0 |
| role_grant | 0 | 0 | 0 |
| role_request | 1 | 1 | 1 |
| secondary_trading | 0 | 5 | 2 |
| settings | 0 | 0 | 0 |
| sme | 7 | 2 | 3 |
| subscription | 0 | 0 | 0 |
| support_ticket | 1 | 1 | 1 |
| syndicate | 2 | 6 | 2 |
| tenant | 0 | 0 | 0 |
| user | 1 | 1 | 1 |
| workflow | 5 | 1 | 1 |

Generated from: `backend/src/lib/permissions.ts`
