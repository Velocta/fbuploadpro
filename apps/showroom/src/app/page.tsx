'use client';

import React, { useState } from 'react';
import { StorageMeter } from '@web/components/media/storage-meter';
import { mockStorageQuota } from '../fixtures/media';

export default function ShowroomHome() {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  const warningQuota = {
    ...mockStorageQuota,
    used_bytes: 4_950_000_000,
    used_percentage: 92,
  };

  const emptyQuota = {
    used_bytes: 0,
    quota_bytes: 5_368_709_120,
    used_percentage: 0,
    asset_count: 0,
    max_asset_count: 50,
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              FBUploadPro UI Showroom
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.95rem' }}>
              Pre-Merge Component Sandbox & Stress-Testing Harness (Isolated from Production)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#e2e8f0', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button
              onClick={() => setViewport('desktop')}
              style={{
                padding: '0.4rem 0.8rem',
                border: 'none',
                borderRadius: '0.35rem',
                backgroundColor: viewport === 'desktop' ? '#ffffff' : 'transparent',
                fontWeight: viewport === 'desktop' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              Desktop (100%)
            </button>
            <button
              onClick={() => setViewport('mobile')}
              style={{
                padding: '0.4rem 0.8rem',
                border: 'none',
                borderRadius: '0.35rem',
                backgroundColor: viewport === 'mobile' ? '#ffffff' : 'transparent',
                fontWeight: viewport === 'mobile' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              Mobile View (375px)
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: viewport === 'mobile' ? '375px' : '100%', margin: '0 auto', transition: 'all 0.2s ease' }}>
        {/* Component Showcase 1: StorageMeter */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>&lt;StorageMeter /&gt;</h2>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>components/media/storage-meter.tsx</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: viewport === 'mobile' ? '1fr' : 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                1. Normal Populated (24% Used)
              </div>
              <StorageMeter quota={mockStorageQuota} />
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                2. Warning State (92% Used)
              </div>
              <StorageMeter quota={warningQuota} />
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                3. Empty / Initial State (0% Used)
              </div>
              <StorageMeter quota={emptyQuota} />
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                4. Loading / Skeleton State
              </div>
              <StorageMeter quota={null} isLoading={true} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
