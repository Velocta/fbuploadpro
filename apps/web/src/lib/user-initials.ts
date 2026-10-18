/**
 * Single source of truth for computing user/workspace display initials.
 *
 * Consolidates the previously duplicated helpers:
 * - workspace-studio-footer.tsx: getMonogram / getUserInitials
 * - accounts/account-card.tsx: getInitials (letter-computation portion)
 *
 * Rules (matches the footer pair's behavior):
 * - null / undefined / blank name -> '?'
 * - multi-word name -> first letters of the first two words, uppercased
 * - single word -> first two letters of the word, uppercased
 */
export function getUserInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
}
