import { redirect } from 'next/navigation'

export default async function LegacyFacebookCallbackRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/agency/facebook/accounts/callback${suffix}`)
}
