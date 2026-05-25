import { notFound, redirect } from 'next/navigation'
import { getRssAutoposterEnabled } from '@/server/auth/rss-autoposter-access'
import { getSessionUser } from '@/lib/supabase/server'

export default async function RssAutoposterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const enabled = await getRssAutoposterEnabled(user.id)
  if (!enabled) notFound()

  return children
}
