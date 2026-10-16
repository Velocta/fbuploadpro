'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FdolaStudioView } from '@/components/studio';

export default function TenantFdolaStudioPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return <FdolaStudioView subdomain={subdomain} />;
}
