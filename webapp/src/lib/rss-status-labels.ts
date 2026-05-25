export function rssPageStatusLabel(status: string): { label: string; tone: 'default' | 'muted' | 'destructive' } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'default' }
    case 'paused':
      return { label: 'Paused', tone: 'muted' }
    case 'invalid_token':
      return { label: 'Invalid token', tone: 'destructive' }
    default:
      return { label: status.replace(/_/g, ' '), tone: 'muted' }
  }
}

export function rssItemStatusLabel(status: string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  switch (status) {
    case 'published':
      return { label: 'Published', variant: 'default' }
    case 'failed':
      return { label: 'Failed', variant: 'destructive' }
    case 'skipped':
      return { label: 'Skipped', variant: 'secondary' }
    case 'rendering':
      return { label: 'Rendering', variant: 'outline' }
    case 'pending_publish':
      return { label: 'Pending', variant: 'outline' }
    default:
      return { label: status.replace(/_/g, ' '), variant: 'secondary' }
  }
}
