import React from 'react';

export default function InsightsLoadingSkeleton() {
  const skeletonCard = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  const shimmer = {
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ ...shimmer, width: '180px', height: '18px', marginBottom: '1rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ ...shimmer, width: '52px', height: '52px', borderRadius: '50%' }} />
            <div>
              <div style={{ ...shimmer, width: '240px', height: '28px', marginBottom: '0.4rem' }} />
              <div style={{ ...shimmer, width: '160px', height: '16px' }} />
            </div>
          </div>
          <div style={{ ...shimmer, width: '220px', height: '36px' }} />
        </div>
      </div>

      {/* KPI Cards Skeleton (5 cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={skeletonCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ ...shimmer, width: '80px', height: '14px' }} />
              <div style={{ ...shimmer, width: '20px', height: '20px', borderRadius: '50%' }} />
            </div>
            <div style={{ ...shimmer, width: '110px', height: '32px', marginBottom: '0.5rem' }} />
            <div style={{ ...shimmer, width: '130px', height: '14px' }} />
          </div>
        ))}
      </div>

      {/* Chart Skeletons (2 large charts) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ ...skeletonCard, height: '360px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ ...shimmer, width: '220px', height: '20px' }} />
            <div style={{ ...shimmer, width: '160px', height: '20px' }} />
          </div>
          <div style={{ ...shimmer, flex: 1, width: '100%' }} />
        </div>

        <div style={{ ...skeletonCard, height: '360px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ ...shimmer, width: '240px', height: '20px' }} />
            <div style={{ ...shimmer, width: '200px', height: '20px' }} />
          </div>
          <div style={{ ...shimmer, flex: 1, width: '100%' }} />
        </div>
      </div>

      {/* Bottom Row Skeletons (Reactions & Demographics) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div style={{ ...skeletonCard, height: '320px' }}>
          <div style={{ ...shimmer, width: '180px', height: '20px', marginBottom: '1rem' }} />
          <div style={{ ...shimmer, width: '100%', height: '12px', marginBottom: '1.5rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} style={{ ...shimmer, height: '48px' }} />
            ))}
          </div>
        </div>

        <div style={{ ...skeletonCard, height: '320px' }}>
          <div style={{ ...shimmer, width: '200px', height: '20px', marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[1, 2, 3, 4].map((k) => (
              <div key={k} style={{ ...shimmer, height: '32px' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
