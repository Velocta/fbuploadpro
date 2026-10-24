import type { Metadata } from 'next';
import React from 'react';
import { VideoSuiteView } from '@/components/video-suite/video-suite-view';

/** Title resolves through the tenant layout's `<Section> · <Workspace>` template. */
export const metadata: Metadata = { title: 'Video Suite' };

interface TenantVideoSuitePageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantVideoSuitePage({ params }: Readonly<TenantVideoSuitePageProps>) {
  const { subdomain } = await params;

  return <VideoSuiteView subdomain={subdomain} />;
}
