import type { Metadata } from 'next';
import React from 'react';
import { FdolaStudioView } from '@/components/studio';

/** Title resolves through the tenant layout's `<Section> · <Workspace>` template (§3.3.4). */
export const metadata: Metadata = { title: 'Fdola Studio' };

interface TenantFdolaStudioPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantFdolaStudioPage({ params }: Readonly<TenantFdolaStudioPageProps>) {
  const { subdomain } = await params;

  return <FdolaStudioView subdomain={subdomain} />;
}
