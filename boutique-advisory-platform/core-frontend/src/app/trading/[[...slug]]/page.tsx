import { redirect } from 'next/navigation'
import { TRADING_FRONTEND_URL } from '@/lib/platform'

export default async function CoreTradingRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? `/trading/${slug.join('/')}` : '/secondary-trading'
  redirect(`${TRADING_FRONTEND_URL}${suffix}`)
}
