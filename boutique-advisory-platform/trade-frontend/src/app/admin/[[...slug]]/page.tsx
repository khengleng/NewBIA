import { redirect } from 'next/navigation'
import { mapAdminPathToTradingOperator } from '@/lib/tradingOperatorRoutes'

export default async function TradeAdminLegacyRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const pathname = slug && slug.length > 0 ? `/admin/${slug.join('/')}` : '/admin'
  const target = mapAdminPathToTradingOperator(pathname) || '/trading/operator/dashboard'
  redirect(target)
}
