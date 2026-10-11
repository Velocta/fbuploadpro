'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { MediaDownloader } from '@/components/media/media-downloader';

export default function TenantMediaDownloaderPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return <MediaDownloader subdomain={subdomain} />;
}
