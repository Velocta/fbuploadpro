'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { MediaLibraryExplorer } from '@/components/media/media-library-explorer';

export default function TenantMediaLibraryPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return <MediaLibraryExplorer subdomain={subdomain} />;
}
