import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { PageToolsClient } from './page-tools-client'
import { Trash2 } from 'lucide-react'

export default async function AgencyPageToolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Bulk Delete Posts' },
        ]}
        icon={<Trash2 className="h-7 w-7 text-primary" />}
        title="Bulk Delete Posts"
        description="View live Facebook page content and bulk delete selected items."
        tutorialHref="https://youtube.com/watch?v=placeholder"
      />
      <PageToolsClient />
    </div>
  )
}

