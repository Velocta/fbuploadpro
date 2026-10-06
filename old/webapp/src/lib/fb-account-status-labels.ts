export function fbAccountStatusLabel(status: string | null | undefined): {
  label: string
  tone: 'default' | 'muted' | 'destructive'
} {
  const normalized = status ?? 'invalid_token'
  if (normalized === 'active') return { label: 'Active', tone: 'default' }
  if (normalized === 'invalid_token') return { label: 'Invalid token', tone: 'destructive' }
  if (normalized === 'inactive') return { label: 'Inactive', tone: 'muted' }
  return { label: normalized.replace(/_/g, ' '), tone: 'muted' }
}
