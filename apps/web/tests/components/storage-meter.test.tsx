import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StorageMeter } from '../../src/components/media/storage-meter';
import type { StorageQuotaResponse } from '@fbuploadpro/contracts';

describe('StorageMeter Component (T104)', () => {
  const dummyQuota: StorageQuotaResponse = {
    userId: '11111111-1111-4111-a111-111111111111',
    totalBytes: 5368709120, // 5 GB
    usedBytes: 1073741824, // 1 GB (20%)
    remainingBytes: 4294967296, // 4 GB
    utilizationPercentage: 20,
    totalItems: 12,
    videoItems: 4,
    imageItems: 8,
  };

  it('renders loading state when quota is null or loading is true', () => {
    const html = renderToString(<StorageMeter quota={null} isLoading={true} />);
    expect(html).toContain('Loading storage quota');
  });

  it('renders storage quota metrics and item breakdown accurately', () => {
    const html = renderToString(<StorageMeter quota={dummyQuota} />);
    expect(html).toContain('1.00 GB');
    expect(html).toContain('5.00 GB');
    expect(html).toContain('20%');
    expect(html).toContain('4.00 GB available');
    expect(html).toContain('12 items');
    expect(html).toContain('4 videos');
    expect(html).toContain('8 images');
  });

  it('renders amber warning style when utilization is over 80%', () => {
    const nearLimitQuota: StorageQuotaResponse = {
      ...dummyQuota,
      usedBytes: 4402341478,
      remainingBytes: 966367642,
      utilizationPercentage: 82,
    };
    const html = renderToString(<StorageMeter quota={nearLimitQuota} />);
    expect(html).toContain('82%');
    // Warning indicator present
    expect(html).toContain('rgb(217, 119, 6)'); // #d97706 or style indicator
  });

  it('renders critical red alert style when utilization is 95% or higher', () => {
    const fullQuota: StorageQuotaResponse = {
      ...dummyQuota,
      usedBytes: 5200000000,
      remainingBytes: 168709120,
      utilizationPercentage: 96.86,
    };
    const html = renderToString(<StorageMeter quota={fullQuota} />);
    expect(html).toContain('96.9%');
    expect(html).toContain('rgb(220, 38, 38)'); // #dc2626
    expect(html).toContain('Almost full');
  });
});
