# Platform Separation

## Target operating model

- `cambobia.com` is the core advisory/investment SaaS platform.
- `trade.cambobia.com` is the secondary market trading platform.
- The only intentional business interlink is shared business data required for investor SSO into trading and for listing eligible tokenized units from the core platform into the trading exchange.

## Implemented separation controls

### Identity and session boundaries

- Core and trading now issue different cookie names:
  - Core: `accessToken`, `refreshToken`, `token`
  - Trading: `tr_accessToken`, `tr_refreshToken`, `tr_token`
- Cookies are now host-only by default unless `COOKIE_DOMAIN` is explicitly set.
- JWT middleware now validates only the current platform cookie set.
- Cross-tenant JWT/session bypasses were removed from request authentication.

### Bootstrap administration

- Core and trading no longer auto-sync the same bootstrap superadmin account into both tenants.
- Core bootstrap uses:
  - `DEFAULT_SUPERADMIN_EMAIL`
  - `INITIAL_ADMIN_PASSWORD`
- Trading bootstrap uses:
  - `DEFAULT_TRADING_SUPERADMIN_EMAIL`
  - `INITIAL_TRADING_ADMIN_PASSWORD`

### Authentication entry points

- Public registration is blocked on the trading runtime.
- Trading local login is now reserved for platform operators only.
- Investor access to `trade.cambobia.com` is intended to come from cambobia.com SSO only.
- Role switching is disabled on the trading runtime.

### Frontend runtime separation

- Trading middleware only treats `tr_*` cookies as valid trading sessions.
- Trading admin path rewrites only happen on the trading runtime.
- Trading participant UX is now investor-only.
- Trading no longer presents SME/advisor trading personas in the main operator/participant shell.

## Remaining follow-up work

- Remove stale `localStorage` role assumptions from all core pages, not just the central layout and permissions hook.
- Create explicit backend policies for which core-platform investment units are eligible for secondary listing.
- Add a dedicated trading operator provisioning workflow instead of relying on bootstrap-only operator creation.
- Complete route-by-route authorization hardening for every trading operator module.
