import type { NavGroupConfig } from '@/components/dashboard/nav-config'

export function filterAgencyNavGroups(
  groups: NavGroupConfig[],
  options: { rssAutoposterEnabled: boolean }
): NavGroupConfig[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.requiresRssAutoposter || options.rssAutoposterEnabled
    ),
  }))
}
