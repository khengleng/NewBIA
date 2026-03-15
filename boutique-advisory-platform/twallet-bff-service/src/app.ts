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
    const upstream = await forwardJson(config.identityServiceUrl, '/api/auth/me', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/bootstrap', asyncRoute(async (req, res) => {
    const headers = jsonHeaders(getForwardHeaders(req))
    const [identity, wallet] = await Promise.all([
      forwardJson(config.identityServiceUrl, '/api/auth/me', {
        method: 'GET',
        headers,
      }),
      forwardJson(config.walletServiceUrl, '/api/wallet', {
        method: 'GET',
        headers,
      }),
    ])

    if (identity.status >= 400) {
      relayJson(res, identity)
      return
    }

    if (wallet.status >= 400) {
      relayJson(res, wallet)
      return
    }

    res.json({
      platform: 'twallet',
      user: (identity.data as JsonRecord).user,
      wallet: (wallet.data as JsonRecord).wallet,
      transactions: (wallet.data as JsonRecord).transactions || [],
    })
  }))

  app.get('/api/mobile/wallet', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/wallet/history', asyncRoute(async (req, res) => {
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

  app.post('/api/mobile/wallet/deposit', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/deposit', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/wallet/withdraw', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.walletServiceUrl, '/api/wallet/withdraw', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/funding/aba/status/:transactionId', asyncRoute(async (req, res) => {
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
    const upstream = await forwardJson(config.tradeApiUrl, '/api/deals', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/secondary-trading/listings', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.marketServiceUrl, '/api/secondary-trading/listings', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/messages/conversations', asyncRoute(async (req, res) => {
    const upstream = await forwardJson(config.tradeApiUrl, '/api/messages/conversations', {
      method: 'GET',
      headers: jsonHeaders(getForwardHeaders(req)),
    })

    relayJson(res, upstream)
  }))

  app.get('/api/mobile/messages/conversations/:conversationId', asyncRoute(async (req, res) => {
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
    const upstream = await forwardJson(config.tradeApiUrl, '/api/messages', {
      method: 'POST',
      headers: jsonHeaders(getForwardHeaders(req)),
      body: JSON.stringify(req.body || {}),
    })

    relayJson(res, upstream)
  }))

  app.post('/api/mobile/messages/start', asyncRoute(async (req, res) => {
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
