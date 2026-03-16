import { redirect } from 'next/navigation'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default async function TradeDocumentsRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const suffix = slug && slug.length > 0 ? '/documents/' + slug.join('/') : '/documents'
  redirect(`${CORE_FRONTEND_URL}${suffix}`)
}
