'use client';

import React, { useState } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, STATUS_SIGNALS } from '@/lib/theme';

export interface GeneralSettingsViewProps {
  subdomain: string;
  workspaceName?: string | undefined;
  workspaceId?: string | undefined;
  ownerEmail?: string | undefined;
  createdAt?: string | undefined;
}

export function GeneralSettingsView({
  subdomain,
  workspaceName = 'Default Workspace',
  workspaceId,
  ownerEmail,
  createdAt,
}: Readonly<GeneralSettingsViewProps>) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const fullDomain = `${subdomain}.fbuploadpro.com`;

  const copyToClipboard = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl, maxWidth: '680px' }}>
      {/* Workspace Identity Card */}
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
            Workspace Overview
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Basic identifiers and environment settings for this workspace.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Workspace Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                textTransform: 'uppercase',
                letterSpacing: TYPOGRAPHY.tracking.caption,
              }}
            >
              Workspace Name
            </span>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                borderRadius: RADII.sm,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              {workspaceName}
            </div>
          </div>

          {/* Subdomain Slug */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                textTransform: 'uppercase',
                letterSpacing: TYPOGRAPHY.tracking.caption,
              }}
            >
              Dedicated Subdomain
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                borderRadius: RADII.sm,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  color: PALETTE.primary,
                }}
              >
                {fullDomain}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard('subdomain', fullDomain)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.xs,
                }}
              >
                {copiedField === 'subdomain' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Workspace ID if present */}
          {workspaceId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  textTransform: 'uppercase',
                  letterSpacing: TYPOGRAPHY.tracking.caption,
                }}
              >
                Workspace ID
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  borderRadius: RADII.sm,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  {workspaceId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('id', workspaceId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {copiedField === 'id' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Metadata Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: SPACING.md,
              marginTop: SPACING.xs,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Status
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  marginTop: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: STATUS_SIGNALS.operational.color,
                    boxShadow: STATUS_SIGNALS.operational.halo,
                  }}
                />
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  Active
                </span>
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Created
              </span>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginTop: '4px',
                }}
              >
                {formattedDate}
              </div>
            </div>

            {ownerEmail && (
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  Owner
                </span>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    marginTop: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ownerEmail}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
