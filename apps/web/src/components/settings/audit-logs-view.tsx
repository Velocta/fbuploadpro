'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface AuditLogEntry {
  id: string;
  action: string;
  category: string;
  timestamp: string;
  actor: string;
  details?: string | undefined;
}

export interface AuditLogsViewProps {
  logs?: AuditLogEntry[] | undefined;
}

const DEFAULT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    action: 'Workspace Created',
    category: 'lifecycle',
    timestamp: '2026-10-13T09:00:00Z',
    actor: 'Owner',
    details: 'Initial workspace provisioning completed.',
  },
  {
    id: 'log-2',
    action: 'BYOC Environment Configured',
    category: 'security',
    timestamp: '2026-10-13T09:15:00Z',
    actor: 'Owner',
    details: 'Workspace-scoped Facebook App credentials registered.',
  },
];

export function AuditLogsView({ logs = DEFAULT_LOGS }: Readonly<AuditLogsViewProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl, maxWidth: '780px' }}>
      <div
        style={{
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Audit Trail
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Immutable chronological record of administrative actions, credential updates, and workspace events.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`, borderRadius: RADII.sm, overflow: 'hidden' }}>
          {logs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={log.id}
                style={{
                  padding: `${SPACING.md} ${SPACING.lg}`,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: SPACING.md,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: TYPOGRAPHY.weights.medium,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                      }}
                    >
                      {log.action}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: `2px ${SPACING.xs}`,
                        borderRadius: RADII.xs,
                        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                        color: PALETTE.primary,
                        textTransform: 'uppercase',
                        letterSpacing: TYPOGRAPHY.tracking.caption,
                      }}
                    >
                      {log.category}
                    </span>
                  </div>
                  {log.details && (
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      }}
                    >
                      {log.details}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: `var(--text-dim, ${THEME.default.text.muted})`,
                      marginTop: '2px',
                    }}
                  >
                    By {log.actor}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {dateStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
