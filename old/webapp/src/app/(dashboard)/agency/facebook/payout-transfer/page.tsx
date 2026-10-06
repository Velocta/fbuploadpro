import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Wallet } from 'lucide-react'

export default function PayoutTransferFacebookShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Facebook', href: '/agency/facebook' },
        { label: 'Payout Transfer' },
      ]}
      icon={<Wallet className="h-7 w-7 text-primary" />}
      title="Payout Transfer"
      description="Manage payouts for Facebook"
      platformLabel="Payout Transfer"
      cardDescription="temporarily unavailable for general public for now"
    />
  )
}
