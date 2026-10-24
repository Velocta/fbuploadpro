import type { Metadata } from 'next';
import React from 'react';
import { ClipperView } from '@/components/clipper';

/** Title resolves through the tenant layout's `<Section> · <Workspace>` template (§3.3.4). */
export const metadata: Metadata = { title: 'Clipper' };

interface TenantClipperPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantClipperPage({ params }: Readonly<TenantClipperPageProps>) {
  const { subdomain } = await params;

  return <ClipperView subdomain={subdomain} />;
}
