export const mockMediaItems = [
  {
    id: 'm-1',
    user_id: 'user-1',
    title: 'Top 10 AI Tools 2026 Reel',
    media_type: 'video' as const,
    file_size_bytes: 45_200_100,
    r2_key: 'users/user-1/videos/top10.mp4',
    r2_public_url: 'https://media.fbuploadpro.com/users/user-1/videos/top10.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    duration_seconds: 58,
    width: 1080,
    height: 1920,
    tags: ['ai', 'reels', 'tech'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'm-2',
    user_id: 'user-1',
    title: 'Product Launch Infographic',
    media_type: 'image' as const,
    file_size_bytes: 3_400_000,
    r2_key: 'users/user-1/images/launch.png',
    r2_public_url: 'https://media.fbuploadpro.com/users/user-1/images/launch.png',
    thumbnail_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
    duration_seconds: null,
    width: 1200,
    height: 630,
    tags: ['launch', 'marketing'],
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

import type { StorageQuotaResponse } from '@fbuploadpro/contracts';

export const mockStorageQuota: StorageQuotaResponse = {
  userId: '00000000-0000-0000-0000-000000000001',
  totalBytes: 5_368_709_120, // 5 GB
  usedBytes: 1_288_490_188,  // ~1.2 GB
  remainingBytes: 4_080_218_932,
  utilizationPercentage: 24,
  totalItems: 14,
  videoItems: 10,
  imageItems: 4,
};
