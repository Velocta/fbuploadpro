'use client';

import React from 'react';
import type { PublishLog } from '@fbuploadpro/contracts';

export interface PublishLogsTableProps {
  logs: PublishLog[];
  isLoading?: boolean;
}

export function PublishLogsTable({ logs, isLoading }: PublishLogsTableProps) {
  const getStatusBadge = (status: PublishLog['status']) => {
    switch (status) {
      case 'success':
        return { label: 'Success', bg: '#e6f4ea', text: '#137333' };
      case 'retry':
        return { label: 'Retry', bg: '#fef7e0', text: '#b06000' };
      case 'failure':
      default:
        return { label: 'Failure', bg: '#fce8e6', text: '#c5221f' };
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #dadce0',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#202124' }}>
            Publish Audit Logs
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#5f6368' }}>
            Execution ledger tracking Facebook Graph API responses and delivery outcomes
          </p>
        </div>
        <span
          style={{
            padding: '0.25rem 0.6rem',
            backgroundColor: '#f1f3f4',
            color: '#3c4043',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {logs.length} Entries
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#5f6368' }}>
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            border: '1px dashed #dadce0',
            borderRadius: '6px',
            color: '#5f6368',
            fontSize: '0.9rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>
            No publish execution logs recorded yet.
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#80868b' }}>
            Execution logs will populate as the edge worker processes scheduled queue items.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #dadce0',
                  color: '#5f6368',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Timestamp</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Attempt</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Response / Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const badge = getStatusBadge(log.status);

                return (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid #f1f3f4',
                      backgroundColor: log.status === 'failure' ? '#fffdfd' : 'transparent',
                    }}
                  >
                    {/* Status */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.text,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '0.75rem', color: '#5f6368', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.createdAt)}
                    </td>

                    {/* Attempt */}
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#3c4043' }}>
                      #{log.attemptNumber}
                    </td>

                    {/* Diagnostics */}
                    <td style={{ padding: '0.75rem', maxWidth: '350px' }}>
                      {log.fbResponseCode && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginRight: '0.5rem',
                            padding: '0.1rem 0.35rem',
                            backgroundColor: log.fbResponseCode === 200 ? '#e6f4ea' : '#fce8e6',
                            color: log.fbResponseCode === 200 ? '#137333' : '#c5221f',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {log.fbResponseCode}
                        </span>
                      )}

                      {log.status === 'success' ? (
                        <span style={{ color: '#137333', fontWeight: 500 }}>
                          Published to Facebook Page
                        </span>
                      ) : (
                        <span style={{ color: '#c5221f', wordBreak: 'break-word' }}>
                          {log.errorMessage || 'Execution encountered an unexpected error.'}
                        </span>
                      )}

                      {log.errorDetails && (
                        <div
                          style={{
                            marginTop: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#70757a',
                            fontFamily: 'monospace',
                            backgroundColor: '#f8f9fa',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {JSON.stringify(log.errorDetails)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
