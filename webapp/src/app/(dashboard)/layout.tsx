import { DashboardShell } from '@/components/dashboard/shell'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()

  // Fetch role, name and tokens
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, tokens_balance')
    .eq('id', user.id)
    .single()

  return (
    <DashboardShell
      user={{
        name: profile?.name || 'User',
        role: profile?.role || 'agency',
        tokens_balance: profile?.tokens_balance || 0
      }}
    >
      {children}
    </DashboardShell>
  )
}