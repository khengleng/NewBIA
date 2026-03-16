import { redirect } from 'next/navigation'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default async function TradeKycRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? '/kyc/' + slug.join('/') : '/kyc'
  redirect(`${CORE_FRONTEND_URL}${suffix}`)
}
