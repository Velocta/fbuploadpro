/**
 * Query-key factory (spec 137 §3.2.3) — the ONLY source of React Query
 * cache keys in the app.
 *
 * Keys are hierarchical and tenant-scoped:
 * `['tenant', subdomain, 'pages', pageId, 'slots']`. Every consumer
 * (queries, mutations, invalidation, server prefetch + dehydration)
 * builds its keys here — never as string literals at call sites — so
 * every copy of the same data ages and invalidates together.
 */

export const queryKeys = {
  /** Root of the whole tenant cache. */
  all: ['tenant'] as const,

  tenant: (subdomain: string) => {
    const tenantRoot = ['tenant', subdomain] as const;
    return {
      all: tenantRoot,

      accounts: {
        all: [...tenantRoot, 'accounts'] as const,
        list: [...tenantRoot, 'accounts', 'list'] as const,
        socialList: [...tenantRoot, 'accounts', 'social'] as const,
        detail: (accountId: string) =>
          [...tenantRoot, 'accounts', accountId] as const,
      },

      pages: {
        all: [...tenantRoot, 'pages'] as const,
        list: [...tenantRoot, 'pages', 'list'] as const,
        detail: (pageId: string) =>
          [...tenantRoot, 'pages', pageId] as const,
        slots: (pageId: string) =>
          [...tenantRoot, 'pages', pageId, 'slots'] as const,
      },

      destinations: {
        all: [...tenantRoot, 'destinations'] as const,
        detail: (destinationId: string) =>
          [...tenantRoot, 'destinations', destinationId] as const,
      },

      queue: {
        all: [...tenantRoot, 'queue'] as const,
        items: (pageId: string) =>
          [...tenantRoot, 'queue', pageId, 'items'] as const,
        statusCounts: (pageId: string) =>
          [...tenantRoot, 'queue', pageId, 'status-counts'] as const,
      },

      media: {
        all: [...tenantRoot, 'media'] as const,
        list: [...tenantRoot, 'media', 'list'] as const,
        folders: [...tenantRoot, 'media', 'folders'] as const,
        detail: (mediaId: string) =>
          [...tenantRoot, 'media', mediaId] as const,
      },

      settings: {
        all: [...tenantRoot, 'settings'] as const,
        byoc: [...tenantRoot, 'settings', 'byoc'] as const,
        platformCredentials: (platform: string) =>
          [...tenantRoot, 'settings', 'platform-credentials', platform] as const,
      },

      insights: {
        all: [...tenantRoot, 'insights'] as const,
        page: (pageId: string, range: string) =>
          [...tenantRoot, 'insights', pageId, range] as const,
      },

      workspaces: {
        all: [...tenantRoot, 'workspaces'] as const,
        list: [...tenantRoot, 'workspaces', 'list'] as const,
      },
    };
  },
};

export type TenantQueryKeys = ReturnType<typeof queryKeys.tenant>;
