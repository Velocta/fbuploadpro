import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { MobileNavTrigger } from '@/components/workspace/mobile-nav-trigger';
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
      <WorkspaceSidebar subdomain={subdomain} user={user} />
      <MobileNavTrigger />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
