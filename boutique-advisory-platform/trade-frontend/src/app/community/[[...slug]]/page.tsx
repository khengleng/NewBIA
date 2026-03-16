import { redirect } from 'next/navigation'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default async function TradeCommunityRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? '/community/' + slug.join('/') : '/community'
  redirect(`${CORE_FRONTEND_URL}${suffix}`)
}
