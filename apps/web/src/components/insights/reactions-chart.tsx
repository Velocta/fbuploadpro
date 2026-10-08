'use client';

import React from 'react';
import type { PageInsightsReactions } from '@fbuploadpro/contracts';

export interface ReactionsDistributionCardProps {
  reactions: PageInsightsReactions;
}

interface ReactionItem {
  key: keyof Omit<PageInsightsReactions, 'total'>;
  label: string;
  emoji: string;
  count: number;
  color: string;
}

export function ReactionsDistributionCard({ reactions }: ReactionsDistributionCardProps) {
  const total = reactions.total || 0;

  const reactionItems: ReactionItem[] = [
    { key: 'like', label: 'Like', emoji: '👍', count: reactions.like, color: '#1877f2' },
    { key: 'love', label: 'Love', emoji: '❤️', count: reactions.love, color: '#e11d48' },
    { key: 'wow', label: 'Wow', emoji: '😲', count: reactions.wow, color: '#f59e0b' },
    { key: 'haha', label: 'Haha', emoji: '😄', count: reactions.haha, color: '#eab308' },
    { key: 'sorry', label: 'Sorry', emoji: '😢', count: reactions.sorry, color: '#6366f1' },
    { key: 'anger', label: 'Anger', emoji: '😡', count: reactions.anger, color: '#ef4444' },
  ];

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#0f172a',
              margin: 0,
            }}
          >
            Audience Reactions
          </h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#64748b',
              margin: '0.25rem 0 0',
            }}
          >
            Sentiment distribution across published posts
          </p>
        </div>
        <div
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {total.toLocaleString()} total
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div
        style={{
          display: 'flex',
          height: '12px',
          borderRadius: '9999px',
          overflow: 'hidden',
          backgroundColor: '#f1f5f9',
          marginBottom: '1.5rem',
        }}
      >
        {total === 0 ? (
          <div style={{ width: '100%', backgroundColor: '#e2e8f0' }} />
        ) : (
          reactionItems.map((item) => {
            const pct = (item.count / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={item.key}
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color,
                  transition: 'width 0.3s ease',
                }}
                title={`${item.label}: ${item.count} (${pct.toFixed(1)}%)`}
              />
            );
          })
        )}
      </div>

      {/* Grid of Reactions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}
      >
        {reactionItems.map((item) => {
          const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
          return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.85rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{item.emoji}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                  {item.label}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  {item.count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
