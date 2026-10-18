/**
 * Backward-compatibility re-export.
 * Primary Downloader API route moved to `/api/tenant/[subdomain]/downloader` (Spec 068).
 * @deprecated Use `/api/tenant/[subdomain]/downloader` instead.
 */
export * from '../../downloader/route';
