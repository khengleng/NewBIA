import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import type { TWalletBffConfig } from './config'

type JsonRecord = Record<string, unknown>
type AsyncHandler = (req: Request, res: Response) => Promise<void>

interface UpstreamResult {
  status: number
  data: unknown
  headers: Headers
}

interface MobileAccess {
  roles: string[]
  permissions: string[]
  platforms: {
    core: boolean
    trading: boolean
  }
  primaryRole?: string
}

function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  }
}

function sanitizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, '')
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.slice('Bearer '.length).trim() || null
}

function getForwardHeaders(req: Request, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': req.protocol,
    'x-trading-host': req.hostname,
    ...extra,
  }

  const token = getBearerToken(req)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function forwardJson(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<UpstreamResult> {
  const response = await fetch(`${sanitizeBaseUrl(baseUrl)}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')

  return {
    status: response.status,
    data,
    headers: response.headers,
  }
}

function extractCookieValue(setCookieHeaders: string[], cookieName: string): string | null {
  for (const cookie of setCookieHeaders) {
    if (cookie.startsWith(`${cookieName}=`)) {
      return cookie.slice(cookieName.length + 1).split(';', 1)[0] || null
    }
  }

  return null
}

function getSetCookieHeaders(headers: Headers): string[] {
  const typedHeaders = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof typedHeaders.getSetCookie === 'function') {
    return typedHeaders.getSetCookie()
  }

  const combined = headers.get('set-cookie')
  return combined ? [combined] : []
}

function relayJson(res: Response, upstream: UpstreamResult): void {
  res.status(upstream.status).json(upstream.data)
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function mapRoleToMobileRole(role: string): string | null {
  const normalized = normalizeRole(role)
  if (normalized === 'SME_OWNER') return 'SME_OWNER'
  if (normalized === 'SME') return 'SME_OWNER'
  if (normalized === 'INVESTOR' || normalized === 'TRADER') return 'INVESTOR'
  if (normalized === 'ADVISOR') return 'ADVISOR'
  if (normalized === 'PLATFORM_OPERATOR') return 'PLATFORM_OPERATOR'
  if (normalized === 'ADMIN') return 'ADMIN'
  if (normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN'
  return null
}

function extractRoleStrings(user?: JsonRecord | null): string[] {
  if (!user) return []
  const rawRoles = user.roles
  if (Array.isArray(rawRoles)) {
    return rawRoles.map((role) => String(role))
  }
  if (typeof rawRoles === 'string') {
    return rawRoles.split(/[,;|]/).map((role) => role.trim()).filter(Boolean)
  }

  const roleValue = user.role
  if (typeof roleValue === 'string' && roleValue.trim()) {
    return roleValue.split(/[,;|]/).map((role) => role.trim()).filter(Boolean)
  }

  const primaryRole = user.primaryRole
  if (typeof primaryRole === 'string' && primaryRole.trim()) {
    return [primaryRole.trim()]
  }

  return []
}

function buildMobileAccess(roleInputs: string[], primaryRole?: string): MobileAccess {
  const mappedRoles = roleInputs
    .map((role) => mapRoleToMobileRole(role))
    .filter((role): role is string => Boolean(role))

  const roles = Array.from(new Set(mappedRoles))

  const permissionsByRole: Record<string, string[]> = {
    SME_OWNER: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'messages.read',
      'messages.write',
    ],
    INVESTOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    ADVISOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'messages.read',
      'messages.write',
    ],
    PLATFORM_OPERATOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    ADMIN: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    SUPER_ADMIN: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
  }

  const permissions = Array.from(
    new Set(
      roles.flatMap((role) => permissionsByRole[role] || [])
    )
  )

  const platforms = {
    core: roles.some((role) => ['SME_OWNER', 'ADVISOR', 'PLATFORM_OPERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)),
    trading: roles.some((role) => ['INVESTOR', 'PLATFORM_OPERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)),
  }

  return {
    roles,
    permissions,
    platforms,
    primaryRole: primaryRole || roles[0],
  }
}

function resolvePrimaryRole(coreUser?: JsonRecord | null, tradeUser?: JsonRecord | null): string | undefined {
  const candidate =
    coreUser?.primaryRole ||
    coreUser?.role ||
    tradeUser?.primaryRole ||
    tradeUser?.role

  return candidate ? mapRoleToMobileRole(String(candidate)) || undefined : undefined
}

function mergeMobileAccess(coreUser?: JsonRecord | null, tradeUser?: JsonRecord | null): MobileAccess {
  const roleInputs = [
    ...extractRoleStrings(coreUser),
    ...extractRoleStrings(tradeUser),
  ]

  const primaryRole = resolvePrimaryRole(coreUser, tradeUser)
  return buildMobileAccess(roleInputs, primaryRole)
}

async function fetchIdentityProfile(
  identityServiceUrl: string,
  req: Request
): Promise<UpstreamResult> {
  return forwardJson(identityServiceUrl, '/api/auth/me', {
    method: 'GET',
    headers: jsonHeaders(getForwardHeaders(req)),
  })
}

async function resolveMobileContext(
  config: TWalletBffConfig,
  req: Request,
  res?: Response
): Promise<{ user?: JsonRecord; tradeUser?: JsonRecord; access?: MobileAccess; failed?: boolean }> {
  const identity = await fetchIdentityProfile(config.identityServiceUrl, req)
  if (identity.status >= 400) {
    if (res) relayJson(res, identity)
    return { failed: true }
  }

  const user = (identity.data as JsonRecord)?.user as JsonRecord | undefined

  let tradeUser: JsonRecord | undefined
  if (config.tradeIdentityServiceUrl) {
    const tradeIdentity = await fetchIdentityProfile(config.tradeIdentityServiceUrl, req)
    if (tradeIdentity.status < 400) {
      tradeUser = (tradeIdentity.data as JsonRecord)?.user as JsonRecord | undefined
    }
  }

  const access = mergeMobileAccess(user, tradeUser)
  return { user, tradeUser, access }
}

async function requireMobilePermission(
  config: TWalletBffConfig,
  req: Request,
  res: Response,
  permission: string
): Promise<MobileAccess | null> {
  const context = await resolveMobileContext(config, req, res)
  if (context.failed || !context.access) return null

  const access = context.access
  if (!access.permissions.includes(permission)) {
    res.status(403).json({
      error: 'Insufficient permissions',
      required: permission,
      service: config.serviceName,
    })
    return null
  }

  return access
}

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error) => {
      console.error('twallet-bff route error:', error)
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Upstream service unavailable',
          service: 'twallet-bff-service',
        })
      }
    })
  }
}

export function createApp(config: TWalletBffConfig) {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }))
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true
  }))
  app.use(cookieParser())
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan('combined'))

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.serviceName,
      mode: 'trading-mobile',
    })
  })

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      service: config.serviceName,
    })
  })

  app.get('/live', (_req, res) => {
    res.json({
      status: 'alive',
      service: config.serviceName,
    })
  })

  app.post('/api/mobile/auth/login', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.identityServiceUrl, '/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    if (upstream.status >= 400) {
      relayJson(res, upstream)
      return
    }

    const setCookies = getSetCookieHeaders(upstream.headers)
    const accessToken = extractCookieValue(setCookies, 'tr_accessToken') || extractCookieValue(setCookies, 'accessToken')
    const refreshToken = extractCookieValue(setCookies, 'tr_refreshToken') || extractCookieValue(setCookies, 'refreshToken')
    const token = extractCookieValue(setCookies, 'tr_token') || extractCookieValue(setCookies, 'token')
    const upstreamData = (upstream.data || {}) as JsonRecord

    res.status(upstream.status).json({
      ...(upstreamData as JsonRecord),
      platform: 'twallet',
      accessToken: upstreamData.accessToken || accessToken,
      refreshToken: upstreamData.refreshToken || refreshToken,
      token: upstreamData.token || token || accessToken,
    })
  }))

  app.post('/api/mobile/auth/refresh', asyncRoute(async (req, res) => {
    const refreshToken = String(req.body?.refreshToken || '').trim()
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' })
      return
    }

    const upstream = await forwardJson(config.identityServiceUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: jsonHeaders({
        ...getForwardHeaders(req),
        Cookie: `tr_refreshToken=${refreshToken}; refreshToken=${refreshToken}`,
      }),
    })

    if (upstream.status >= 400) {
      relayJson(res, upstream)
      return
    }

    const setCookies = getSetCookieHeaders(upstream.headers)
    const nextAccessToken = extractCookieValue(setCookies, 'tr_accessToken') || extractCookieValue(setCookies, 'accessToken')
    const nextRefreshToken = extractCookieValue(setCookies, 'tr_refreshToken') || extractCookieValue(setCookies, 'refreshToken')
    const nextToken = extractCookieValue(setCookies, 'tr_token') || extractCookieValue(setCookies, 'token')

    res.status(upstream.status).json({
      ...(upstream.data as JsonRecord),
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      token: nextToken || nextAccessToken,
    })
  }))

  app.post('/api/mobile/auth/logout', asyncRoute(async (req, res) => {
    const refreshToken = String(req.body?.refreshToken || '').trim()
    const upstream = await forwardJson(config.identityServiceUrl, '/api/auth/logout', {
      method: 'POST',
      headers: jsonHeaders({
        ...getForwardHeaders(req),
        ...(refreshToken
          ? { Cookie: `tr_refreshToken=${refreshToken}; refreshToken=${refreshToken}` }
          : {}),
      }),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/me', asyncRoute(async (req, res) => {
    const context = await resolveMobileContext(config, req, res)
    if (context.failed || !context.access) return

    const user = context.user
    const access = context.access

    res.json({
      user,
      roles: access.roles,
      permissions: access.permissions,
      platforms: access.platforms,
      primaryRole: access.primaryRole,
      paymentMode: 'P2P_C2B_C2C',
    })
  }))

  app.get('/api/mobile/bootstrap', asyncRoute(async (req, res) => {
    const headers = jsonHeaders(getForwardHeaders(req))
    const [identityContext, wallet] = await Promise.all([
      resolveMobileContext(config, req),
      forwardJson(config.walletServiceUrl, '/api/wallet', {
        method: 'GET',
        headers,
      }),
    ])

    if (identityContext.failed || !identityContext.access) {
      res.status(502).json({
        error: 'Identity unavailable',
        service: config.serviceName,
      })
      return
    }

    if (wallet.status >= 400) {
      relayJson(res, wallet)
      return
    }

    const user = identityContext.user as JsonRecord

    res.json({
      platform: 'twallet',
      user,
      wallet: (wallet.data as JsonRecord).wallet,
      transactions: (wallet.data as JsonRecord).transactions || [],
      roles: identityContext.access.roles,
      permissions: identityContext.access.permissions,
      platforms: identityContext.access.platforms,
      primaryRole: identityContext.access.primaryRole,
      paymentMode: 'P2P_C2B_C2C',
    })
  }))

  app.get('/api/mobile/wallet', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'wallet.read')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/wallet/history', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'wallet.read')
    if (!access) return
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)))
      } else if (value !== undefined) {
        query.set(key, String(value))
      }
    }

    const suffix = query.toString() ? `?${query.toString()}` : ''
    const upstream = await forwardJson(config.walletServiceUrl, `/api/wallet/history${suffix}`, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/wallet/address', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'wallet.read')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/address', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/wallet/address', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'wallet.update')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/address', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/wallet/deposit', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'payment.create')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/deposit', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/portfolio', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'deal.list')
    if (!access) return

    const portfolio = await forwardJson(config.tradeApiUrl, '/api/investor/portfolio/stats', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    if (portfolio.status >= 400) {
      relayJson(res, portfolio)
      return
    }

    const walletAddressResult = await forwardJson(config.walletServiceUrl, '/api/wallet/address', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    const walletAddress = (walletAddressResult.data as JsonRecord | undefined)?.walletAddress as string | null | undefined
    const items = ((portfolio.data as JsonRecord | undefined)?.items as JsonRecord[] | undefined) || []

    if (!walletAddress || !config.blockchainGatewayUrl) {
      const portfolioPayload = (portfolio.data && typeof portfolio.data === 'object')
        ? (portfolio.data as JsonRecord)
        : {}

      res.json({
        ...portfolioPayload,
        walletAddress: walletAddress || null,
        items,
      })
      return
    }

    const enriched = await Promise.all(items.map(async (item) => {
      const tokenContractAddress = item.tokenContractAddress as string | undefined
      const onchainStatus = item.onchainStatus as string | undefined
      if (!tokenContractAddress || onchainStatus !== 'MINTED') {
        return item
      }

      const balance = await forwardJson(config.blockchainGatewayUrl, '/api/blockchain/token/balance', {
        method: 'POST',
        headers: jsonHeaders(getForwardHeaders(req)),
        body: JSON.stringify({
          tokenAddress: tokenContractAddress,
          walletAddress,
        }),
      })

      return {
        ...item,
        onchainBalance: (balance.data as JsonRecord | undefined)?.balance ?? null,
        onchainDecimals: (balance.data as JsonRecord | undefined)?.decimals ?? null,
        onchainStatus: (balance.data as JsonRecord | undefined)?.status ?? onchainStatus,
      }
    }))

    res.json({
      ...(portfolio.data as JsonRecord),
      walletAddress,
      items: enriched,
    })
  }))

  app.post('/api/mobile/wallet/withdraw', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'payment.create')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/withdraw', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/wallet/transfer', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'payment.create')
    if (!access) return
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/transfer', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/funding/aba/status/:transactionId', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'payment.create')
    if (!access) return
    const upstream = await forwardJson(
      config.fundingServiceUrl,
      `/api/payments/aba/status/${encodeURIComponent(req.params.transactionId)}`,
      {
        method: 'GET',
        headers: jsonHeaders(getForwardHeaders(req)),
      }
    )

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/deals', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'deal.list')
    if (!access) return

    const platformParam = String(req.query?.platform || '').trim().toLowerCase()
    const primaryRole = access.primaryRole || ''

    const useTrading = platformParam === 'trading'
      || (!platformParam && access.platforms.trading && primaryRole === 'INVESTOR')
      || (!platformParam && access.platforms.trading && !access.platforms.core)

    const useCore = platformParam === 'core'
      || (!platformParam && access.platforms.core && primaryRole !== 'INVESTOR')
      || (!platformParam && access.platforms.core && !access.platforms.trading)

    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'platform') continue
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)))
      } else if (value !== undefined) {
        query.append(key, String(value))
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''

    const upstreamBase = useCore && config.coreBackendUrl
      ? config.coreBackendUrl
      : config.tradeApiUrl

    const upstreamPath = useCore && config.coreBackendUrl
      ? `/api/pipeline/deals${suffix}`
      : `/api/deals${suffix}`

    const upstream = await forwardJson(upstreamBase, upstreamPath, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/secondary-trading/listings', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'secondary_trading.list')
    if (!access) return
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, String(entry)))
      } else if (value !== undefined) {
        params.append(key, String(value))
      }
    }
    const query = params.toString()
    const path = query ? `/api/secondary-trading/listings?${query}` : '/api/secondary-trading/listings'
    const upstream = await forwardJson(config.marketServiceUrl, path, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/messages/conversations', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'messages.read')
    if (!access) return
    const upstream = await forwardJson(config.tradeApiUrl, '/api/messages/conversations', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/messages/conversations/:conversationId', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'messages.read')
    if (!access) return
    const upstream = await forwardJson(
      config.tradeApiUrl,
      `/api/messages/conversations/${encodeURIComponent(req.params.conversationId)}`,
      {
        method: 'GET',
        headers: jsonHeaders(getForwardHeaders(req)),
      }
    )

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/messages', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'messages.write')
    if (!access) return
    const upstream = await forwardJson(config.tradeApiUrl, '/api/messages', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/messages/start', asyncRoute(async (req, res) => {
    const access = await requireMobilePermission(config, req, res, 'messages.write')
    if (!access) return
    const upstream = await forwardJson(config.tradeApiUrl, '/api/messages/start', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  // ==========================================
  // LEGACY COMPATIBILITY (Flutter App v1/v2)
  // ==========================================
  
  // V1 Token & Balance
  app.get('/v1/token/:address', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, `/api/wallet/balance/${req.params.address}`, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })
    relayJson(res, upstream)
  }))

  app.post('/v1/token/transfer', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/transfer', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })
    relayJson(res, upstream)
  }))

  // V1 Transactions
  app.get('/v1/transactions', asyncRoute(async (req, res) => {
    const address = req.query.from_addr
    const upstream = await forwardJson(config.walletServiceUrl, `/api/wallet/history?address=${address}`, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })
    relayJson(res, upstream)
  }))

  app.get('/v1/transactions/:hash', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, `/api/wallet/transaction/${req.params.hash}`, {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })
    relayJson(res, upstream)
  }))

  // V1 Health Certifications (Mapping to BIA Identity/Advisory if needed, or keeping plumbing for now)
  app.post('/v1/health-certifications', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.identityServiceUrl, '/api/kyc/submit', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })
    relayJson(res, upstream)
  }))

  // V2 Market Compatibility
  app.get('/v2/vc-market/issuers', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.identityServiceUrl, '/api/issuers', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })
    relayJson(res, upstream)
  }))

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      service: config.serviceName,
      path: req.path,
    })
  })

  return app
}
