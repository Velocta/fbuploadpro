import { redirect } from 'next/navigation'

export default async function LegacyPageDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/agency/facebook/auto-download-upload/${id}`)
}
