'use client';

import * as React from 'react';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';

export interface QueueFailedBannerProps {
  count: number;
  onReview: () => void;
}

/**
 * Failed-posts banner (spec 105 §10 / spec 134 §3.5): persistent state at
 * the queue's scope on the shared Banner — "{n} posts failed to publish."
 * + Review (filters to Failed); clears at zero. Counts come from the one
 * query-cache source in the panel, so banner/chip/header always agree.
 */
export function QueueFailedBanner({ count, onReview }: Readonly<QueueFailedBannerProps>) {
  if (count <= 0) return null;
  return (
    <Banner
      variant="critical"
      data-testid="queue-failed-banner"
      title={`${count} ${count === 1 ? 'post' : 'posts'} failed to publish.`}
      action={
        <Button variant="secondary" onClick={onReview}>
          Review
        </Button>
      }
    />
  );
}
