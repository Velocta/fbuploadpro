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

  if (sync_status === 'pending' || sync_status === 'browser_pending') {
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
      case 'fb_rate_limited':
        return { label: 'Rate limited', variant: 'destructive', iconKind: 'clock', tone: 'destructive' }
      case 'page_not_accessible':
        return { label: 'Page not accessible', variant: 'destructive', iconKind: 'alert-circle', tone: 'destructive' }
      case '2fa_required_on_BM':
        return { label: 'BM 2FA required', variant: 'destructive', iconKind: 'shield', tone: 'destructive' }
      case 'check_developer_app':
        return { label: 'Check developer app', variant: 'destructive', iconKind: 'alert-circle', tone: 'destructive' }
      case 'account_suspended':
        return { label: 'Account suspended', variant: 'destructive', iconKind: 'user-x', tone: 'destructive' }
      case 'creator_suspended':
        return { label: 'Creator suspended', variant: 'destructive', iconKind: 'user-x', tone: 'destructive' }
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

  if (sync_status === 'pending' || sync_status === 'browser_pending') {
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
            'Complete identity or phone verification in the Meta app on your mobile device. This is not a token error — do not reconnect. After verification, turn automation on using the toggle.',
          variant: 'destructive',
          iconKind: 'shield',
        }
      case 'fb_rate_limited':
        return {
          title: 'Facebook Rate Limited',
          description:
            'Meta is limiting how often this page can post. Automation pauses for about 3 days and will resume automatically when the cooldown ends.',
          variant: 'destructive',
          iconKind: 'clock',
        }
      case 'page_not_accessible':
        return {
          title: 'Facebook Page Not Accessible',
          description:
            'This page may have been removed or your account may no longer have admin access. Confirm the page exists and you have admin rights, then reconnect your Facebook account and enable automation.',
          variant: 'destructive',
          iconKind: 'alert-circle',
        }
      case 'invalid_token':
        return {
          title: 'Access Token Expired',
          description:
            'Reconnect your Facebook account in Facebook Accounts. Your page access token has expired or been revoked.',
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
      case 'creator_suspended':
        return {
          title: 'Source Creator Unavailable',
          description:
            'Too many reels failed to download from this source in the last 24 hours. The source creator may be suspended or unavailable. Update Settings > Source to a different account, then reactivate posting.',
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
