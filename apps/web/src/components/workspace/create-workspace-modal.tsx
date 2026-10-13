'use client';

import React, { useState, useEffect } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: ((workspace: { id: string; name: string; subdomain: string }) => void) | undefined;
}

function sanitizeSubdomainSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: Readonly<CreateWorkspaceModalProps>) {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setSubdomain('');
      setIsManualSlug(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isManualSlug) {
      setSubdomain(sanitizeSubdomainSlug(val));
    }
  };

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualSlug(true);
    setSubdomain(sanitizeSubdomainSlug(e.target.value));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a workspace name.');
      return;
    }
    if (!subdomain.trim() || subdomain.length < 2) {
      setError('Subdomain must be at least 2 characters long.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subdomain: subdomain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create workspace.');
        setIsSubmitting(false);
        return;
      }

      onSuccess?.(data.workspace);
      onClose();
      // Navigate to the newly created workspace
      window.location.href = `/tenant/${data.workspace.subdomain}`;
    } catch {
      setError('Network communication failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={MODAL_BACKDROP_STYLE}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
    >
      <div style={{ ...MODAL_CONTAINER_STYLE, maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            id="create-workspace-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Create Workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              padding: SPACING.xs,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.4,
          }}
        >
          Workspaces isolate your publishing queues, connected Facebook accounts, and media assets.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: `${SPACING.sm} ${SPACING.md}`,
              backgroundColor: 'rgba(246, 70, 93, 0.1)',
              border: `1px solid ${PALETTE.accent3}`,
              borderRadius: RADII.sm,
              color: PALETTE.accent3,
              fontSize: '0.8125rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="ws-name-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Workspace Name
            </label>
            <input
              id="ws-name-input"
              type="text"
              placeholder="e.g. Acme Media"
              value={name}
              onChange={handleNameChange}
              disabled={isSubmitting}
              required
              style={{
                width: '100%',
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="ws-subdomain-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Workspace Subdomain
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                overflow: 'hidden',
              }}
            >
              <input
                id="ws-subdomain-input"
                type="text"
                placeholder="acme-media"
                value={subdomain}
                onChange={handleSubdomainChange}
                disabled={isSubmitting}
                required
                style={{
                  flex: 1,
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span
                style={{
                  padding: `0 ${SPACING.md}`,
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontSize: '0.8125rem',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                .fbuploadpro.com
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: SPACING.sm,
              marginTop: SPACING.xs,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="create-workspace-submit"
              style={{
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: PALETTE.primary,
                border: 'none',
                borderRadius: RADII.sm,
                color: PALETTE.background,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.xs,
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
