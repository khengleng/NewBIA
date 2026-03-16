import { redirect } from 'next/navigation'

export default async function TradeSettingsRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  if (slug && slug[0] === 'sessions') {
    redirect('/trading/sessions')
  }
  redirect('/trading/security')
}
