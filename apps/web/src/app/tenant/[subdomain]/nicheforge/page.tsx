import type { Metadata } from 'next';
import React from 'react';
import { NicheForgeView } from '@/components/nicheforge/nicheforge-view';

/** Title resolves through the tenant layout's `<Section> · <Workspace>` template (§3.3.4). */
export const metadata: Metadata = { title: 'NicheForge' };

interface TenantNicheForgePageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantNicheForgePage({ params }: Readonly<TenantNicheForgePageProps>) {
  const { subdomain } = await params;

  return <NicheForgeView subdomain={subdomain} />;
}
