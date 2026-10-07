'use client';

import React from 'react';
import type { StorageQuotaResponse } from '@fbuploadpro/contracts';

export interface StorageMeterProps {
  quota: StorageQuotaResponse | null;
  isLoading?: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(2)} ${units[i]}`;
}

export function StorageMeter({ quota, isLoading = false }: StorageMeterProps) {
  if (isLoading || !quota) {
    return (
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
          <div
            style={{
              width: '1rem',
              height: '1rem',
              borderRadius: '50%',
              border: '2px solid #cbd5e1',
              borderTopColor: '#3b82f6',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.875rem' }}>Loading storage quota...</span>
        </div>
      </div>
    );
  }

  const {
    totalBytes,
    usedBytes,
    remainingBytes,
    utilizationPercentage,
    totalItems,
    videoItems,
    imageItems,
  } = quota;

  const formattedUsed = formatBytes(usedBytes);
  const formattedTotal = formatBytes(totalBytes);
  const formattedRemaining = formatBytes(remainingBytes);
  const percentDisplay = `${utilizationPercentage.toFixed(
    utilizationPercentage % 1 === 0 ? 0 : 1
  )}%`;

  const isCritical = utilizationPercentage >= 95;
  const isWarning = utilizationPercentage >= 80 && !isCritical;

  const barColor = isCritical
    ? 'rgb(220, 38, 38)' // red
    : isWarning
    ? 'rgb(217, 119, 6)' // amber
    : 'rgb(37, 99, 235)'; // blue

  return (
    <div
      style={{
        padding: '1.25rem',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
            Storage Utilization
          </span>
          {isCritical && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#fee2e2',
                color: 'rgb(220, 38, 38)',
                fontWeight: 600,
              }}
            >
              Almost full
            </span>
          )}
          {isWarning && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#fef3c7',
                color: 'rgb(217, 119, 6)',
                fontWeight: 600,
              }}
            >
              Quota warning
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.875rem', color: '#475569' }}>
          <strong style={{ color: '#0f172a' }}>{formattedUsed}</strong> / {formattedTotal} (
          {percentDisplay})
        </div>
      </div>

      {/* Progress Bar Track */}
      <div
        role="progressbar"
        aria-valuenow={Math.min(100, Math.round(utilizationPercentage))}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '100%',
          height: '0.625rem',
          backgroundColor: '#f1f5f9',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, utilizationPercentage))}%`,
            backgroundColor: barColor,
            borderRadius: '9999px',
            transition: 'width 0.3s ease-in-out',
          }}
        />
      </div>

      {/* Summary Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8125rem',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span>{`${totalItems} items`}</span>
          <span>•</span>
          <span>{`${videoItems} videos`}</span>
          <span>•</span>
          <span>{`${imageItems} images`}</span>
        </div>

        <div>
          <span>{`${formattedRemaining} available`}</span>
        </div>
      </div>
    </div>
  );
}
