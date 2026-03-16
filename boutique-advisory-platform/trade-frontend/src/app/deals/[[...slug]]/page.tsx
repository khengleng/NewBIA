import { redirect } from 'next/navigation'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default async function TradeDealsRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? '/deals/' + slug.join('/') : '/deals'
  redirect(`${CORE_FRONTEND_URL}${suffix}`)
}
