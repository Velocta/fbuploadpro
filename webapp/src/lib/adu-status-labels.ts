export function syncStatusLabel(status: string | null | undefined): {
  label: string
  tooltip?: string
  variant: 'default' | 'destructive' | 'outline'
} {
  if (status === 'error') {
    return {
      label: 'Source not found',
      tooltip: 'Unable to find the username. Please check if the username exists.',
      variant: 'destructive',
    }
  }
  if (status === 'processing') return { label: 'Scraping', variant: 'outline' }
  if (status === 'pending') return { label: 'Pending scrape', variant: 'outline' }
  if (status === 'synced') return { label: 'Synced', variant: 'default' }
  return { label: status || 'Unknown', variant: 'outline' }
}

export function pageStatusLabel(status: string | null | undefined): {
  label: string
  tone: 'default' | 'muted' | 'destructive'
} {
  const normalized = status ?? 'inactive'
  if (normalized === 'active') return { label: 'Active', tone: 'default' }
  if (normalized === 'fb_verification_required') return { label: 'Verification required', tone: 'destructive' }
  if (normalized === 'invalid_token') return { label: 'Invalid token', tone: 'destructive' }
  if (normalized === 'invalid_username') return { label: 'Invalid username', tone: 'destructive' }
  if (normalized === 'completed') return { label: 'Completed', tone: 'muted' }
  return { label: normalized.replace(/_/g, ' '), tone: 'muted' }
}
