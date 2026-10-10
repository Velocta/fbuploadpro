import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { MobileNavTrigger } from '@/components/workspace/mobile-nav-trigger';
import { WorkspaceLifecycleGuard } from '@/components/workspace/workspace-lifecycle-guard';
import { getServerSessionContext } from '@/lib/auth';
import { SPACING } from '@/lib/theme';

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
      <WorkspaceLifecycleGuard />
      <WorkspaceSidebar subdomain={subdomain} user={user} />
      <MobileNavTrigger />
      <SidebarInset className="workspace-mobile-gutter">
        <header
          className="desktop-only"
          style={{
            display: 'flex',
            height: '48px',
            flexShrink: 0,
            alignItems: 'center',
            gap: SPACING.sm,
            padding: `0 ${SPACING.lg}`,
          }}
        >
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
