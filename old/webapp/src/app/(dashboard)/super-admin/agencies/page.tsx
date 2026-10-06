import { Suspense } from 'react'
import { SuperAdminAgenciesContent } from '../agencies-content'
import { SuperAdminOverviewSkeleton } from '@/components/dashboard/skeletons'

export default function SuperAdminAgenciesPage() {
  return (
    <Suspense fallback={<SuperAdminOverviewSkeleton />}>
      <SuperAdminAgenciesContent />
    </Suspense>
  )
}
