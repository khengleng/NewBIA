import { redirect } from 'next/navigation'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default async function TradeCalendarRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? '/calendar/' + slug.join('/') : '/calendar'
  redirect(`${CORE_FRONTEND_URL}${suffix}`)
}
