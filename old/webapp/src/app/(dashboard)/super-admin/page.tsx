import { Suspense } from 'react'
import { SuperAdminOverviewContent } from './overview-content'
import { SuperAdminOverviewSkeleton } from '@/components/dashboard/skeletons'

export default function SuperAdminOverview() {
  return (
    <Suspense fallback={<SuperAdminOverviewSkeleton />}>
      <SuperAdminOverviewContent />
    </Suspense>
  )
}
