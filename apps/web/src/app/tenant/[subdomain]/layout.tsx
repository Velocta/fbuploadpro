import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { WorkspaceBreadcrumb } from '@/components/workspace/workspace-breadcrumb';
import { WorkspaceLifecycleGuard } from '@/components/workspace/workspace-lifecycle-guard';
import { getServerSessionContext } from '@/lib/auth';
import { SPACING, THEME } from '@/lib/theme';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ params, children }: Readonly<TenantLayoutProps>) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();

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
    <SidebarProvider>
      <WorkspaceLifecycleGuard userId={session?.userId} userEmail={session?.email} />
      <WorkspaceSidebar subdomain={subdomain} user={user} />
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
          <div
            role="separator"
            aria-orientation="vertical"
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              margin: `0 ${SPACING.xs}`,
              flexShrink: 0,
            }}
          />
          <WorkspaceBreadcrumb subdomain={subdomain} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
