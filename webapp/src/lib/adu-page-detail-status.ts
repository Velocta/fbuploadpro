export type AduStatusIconKind =
  | 'none'
  | 'alert-circle'
  | 'refresh'
  | 'clock'
  | 'check'
  | 'shield'
  | 'key'
  | 'user-x'
  | 'pulse'

export type AduPageStatusInput = {
  sync_status?: string | null | undefined
  status?: string | null | undefined
}

export type AduPageStatusBadge = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
  iconKind: AduStatusIconKind
  tone: 'default' | 'muted' | 'destructive'
}

export type AduPageStatusAlert = {
  title: string
  description: string
  variant: 'default' | 'destructive'
  iconKind: AduStatusIconKind
}

export function getAduPageStatusBadge(profile: AduPageStatusInput): AduPageStatusBadge {
  const { sync_status, status } = profile

  if (sync_status === 'error') {
    return {
      label: 'Source not found',
      variant: 'destructive',
      iconKind: 'alert-circle',
      tone: 'destructive',
    }
  }

  if (sync_status === 'processing') {
    return {
      label: 'Scraping reels',
      variant: 'secondary',
      className: 'bg-secondary text-secondary-foreground border-none',
      iconKind: 'refresh',
      tone: 'muted',
    }
  }

  if (sync_status === 'pending') {
    return {
      label: 'Scrape pending',
      variant: 'secondary',
      className: 'bg-secondary text-secondary-foreground border-none',
      iconKind: 'clock',
      tone: 'muted',
    }
  }

  if (sync_status === 'synced') {
    switch (status) {
      case 'active':
        return {
          label: 'Active posting',
          variant: 'default',
          className: 'bg-primary text-primary-foreground border-none',
          iconKind: 'pulse',
          tone: 'default',
        }
      case 'inactive':
        return { label: 'Posting inactive', variant: 'secondary', iconKind: 'none', tone: 'muted' }
      case 'fb_verification_required':
        return { label: 'Verification required', variant: 'destructive', iconKind: 'shield', tone: 'destructive' }
      case 'invalid_token':
        return { label: 'Invalid token', variant: 'destructive', iconKind: 'key', tone: 'destructive' }
      case '2fa_required_on_BM':
        return { label: 'BM 2FA required', variant: 'destructive', iconKind: 'shield', tone: 'destructive' }
      case 'check_developer_app':
        return { label: 'Check developer app', variant: 'destructive', iconKind: 'alert-circle', tone: 'destructive' }
      case 'account_suspended':
        return { label: 'Account suspended', variant: 'destructive', iconKind: 'user-x', tone: 'destructive' }
      case 'invalid_username':
        return { label: 'Source disabled', variant: 'destructive', iconKind: 'user-x', tone: 'destructive' }
      case 'completed':
        return { label: 'All reels posted', variant: 'outline', iconKind: 'check', tone: 'muted' }
      default:
        return {
          label: (status as string | null)?.replace(/_/g, ' ') || 'Unknown',
          variant: 'outline',
          iconKind: 'none',
          tone: 'muted',
        }
    }
  }

  return { label: 'Unknown', variant: 'outline', iconKind: 'none', tone: 'muted' }
}

export function getAduPageStatusAlert(profile: AduPageStatusInput): AduPageStatusAlert | null {
  const { sync_status, status } = profile

  if (sync_status === 'error') {
    return {
      title: 'Username Not Found',
      description: 'Unable to find the username. Please check if the username exists.',
      variant: 'destructive',
      iconKind: 'alert-circle',
    }
  }

  if (sync_status === 'processing') {
    return {
      title: 'Scraping in Progress',
      description: 'Your reels are being scraped.',
      variant: 'default',
      iconKind: 'refresh',
    }
  }

  if (sync_status === 'pending') {
    return {
      title: 'Scraping Pending',
      description: 'Your reels will be scraped soon. Please wait.',
      variant: 'default',
      iconKind: 'clock',
    }
  }

  if (sync_status === 'synced') {
    switch (status) {
      case 'active':
        return null
      case 'inactive':
        return {
          title: 'Posting Inactive',
          description: 'Posting is inactive. Activate automation using the toggle in the header.',
          variant: 'default',
          iconKind: 'none',
        }
      case 'fb_verification_required':
        return {
          title: 'Facebook Verification Required',
          description:
            'Please log in to your Facebook page using a mobile device to confirm verification, then activate automation.',
          variant: 'destructive',
          iconKind: 'shield',
        }
      case 'invalid_token':
        return {
          title: 'Access Token Expired',
          description:
            'Please go to the Facebook Accounts section and reconnect your account. Your access token has expired or been revoked.',
          variant: 'destructive',
          iconKind: 'key',
        }
      case '2fa_required_on_BM':
        return {
          title: 'Business 2FA Required',
          description:
            'The connected Facebook user must be an admin/editor/moderator on this page and complete required Business Manager two-factor authentication. Update role/2FA, then reconnect the account.',
          variant: 'destructive',
          iconKind: 'shield',
        }
      case 'check_developer_app':
        return {
          title: 'Developer App Access Blocked',
          description:
            'Facebook API access is blocked for this page/app combination. Review your Meta Developer app status, app mode, permissions, and policy compliance, then reconnect.',
          variant: 'destructive',
          iconKind: 'alert-circle',
        }
      case 'account_suspended':
        return {
          title: 'Facebook Account Suspended',
          description:
            'The connected Facebook user is not allowed to create valid sessions right now. Confirm the account is active/verified in Facebook and reconnect from the Facebook Accounts section.',
          variant: 'destructive',
          iconKind: 'user-x',
        }
      case 'invalid_username':
        return {
          title: 'Source Account Disabled',
          description:
            'Your selected source account may be disabled or inaccessible. Verify the source account is active, then update source details in Settings > Source if needed.',
          variant: 'destructive',
          iconKind: 'user-x',
        }
      case 'completed':
        return {
          title: 'All Reels Posted',
          description:
            'All reels posted. You can update Settings > Source to a different source account to continue posting.',
          variant: 'default',
          iconKind: 'check',
        }
      default:
        return null
    }
  }

  return null
}
