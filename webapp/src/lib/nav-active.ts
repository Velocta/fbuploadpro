const HUB_ROUTES = ['/agency', '/super-admin', '/admin'] as const

/**
 * Hub routes match exactly; feature routes match self or nested paths.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (HUB_ROUTES.includes(href as (typeof HUB_ROUTES)[number])) {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function findActiveGroupId(
  pathname: string,
  groups: { id: string; items: { href: string }[] }[]
): string | null {
  for (const group of groups) {
    if (group.items.some((item) => isNavActive(pathname, item.href))) {
      return group.id
    }
  }
  return null
}
