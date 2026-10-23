import type { Metadata } from 'next';
import React from 'react';
import { headers } from 'next/headers';
import { shouldUseCleanTenantPaths } from '@/lib/tenant-href';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { WorkspaceBreadcrumb } from '@/components/workspace/workspace-breadcrumb';
import { WorkspaceLifecycleGuard } from '@/components/workspace/workspace-lifecycle-guard';
import { getServerSessionContext } from '@/lib/auth';
import { DataProvider } from '@/lib/data/provider';
import { SPACING, THEME } from '@/lib/theme';
import { getWorkspaceDisplayName } from './workspace-display-name';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

/**
 * Metadata standard (spec 137 §3.3.4 / PR-A2): tenant route titles follow
 * `<Section> · <Workspace name>`; segments export a plain section title
 * and this template appends the workspace name, resolved from the same
 * server context the layout body uses. The default is the workspace name
 * itself for segments that export no title.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const workspaceName = (await getWorkspaceDisplayName(subdomain)) ?? subdomain;
  return {
    title: {
      template: `%s · ${workspaceName}`,
      default: workspaceName,
    },
  };
}

export default async function TenantLayout({ params, children }: Readonly<TenantLayoutProps>) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();
  let hostHeader: string | null = null;
  try {
    hostHeader = (await headers()).get('host');
  } catch {
    // Outside a request scope (tests, static generation): fall back to prefixed URLs.
    hostHeader = null;
  }
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'fbuploadpro.com';
  const useCleanPaths = shouldUseCleanTenantPaths(hostHeader, subdomain, rootDomain);

  // H5/M9: resolve the display name server-side so the sidebar and switcher
  // never flash (or stick on) the internal slug before the client fetch lands.
  const workspaceName = await getWorkspaceDisplayName(subdomain);

  const user = session
    ? {
        name: session.subdomain || session.email.split('@')[0],
        email: session.email,
      }
    : {
        name: subdomain,
        email: `${subdomain}@fbuploadpro.com`,
      };

  return (
    <DataProvider subdomain={subdomain}>
    <SidebarProvider>
      <WorkspaceLifecycleGuard userId={session?.userId} userEmail={session?.email} />
      <WorkspaceSidebar subdomain={subdomain} useCleanPaths={useCleanPaths} user={user} workspaceName={workspaceName ?? undefined} />
      <SidebarInset>
        <header
          data-slot="workspace-topbar"
          data-testid="workspace-topbar"
          style={{
            display: 'flex',
            height: '44px',
            flexShrink: 0,
            alignItems: 'center',
            gap: SPACING.sm,
            padding: `0 ${SPACING.md}`,
            borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          }}
        >
          <SidebarTrigger />
          <hr
            aria-orientation="vertical"
            style={{
              width: '1px',
              height: '16px',
              border: 'none',
              backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              margin: `0 ${SPACING.xs}`,
              flexShrink: 0,
            }}
          />
          <WorkspaceBreadcrumb subdomain={subdomain} useCleanPaths={useCleanPaths} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
    </DataProvider>
  );
}
