import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { MobileNavTrigger } from '@/components/workspace/mobile-nav-trigger';
import { WorkspaceLifecycleGuard } from '@/components/workspace/workspace-lifecycle-guard';
import { getServerSessionContext } from '@/lib/auth';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ params, children }: TenantLayoutProps) {
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
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
