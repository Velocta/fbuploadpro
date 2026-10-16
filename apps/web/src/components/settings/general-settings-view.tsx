'use client';

import React, { useState, useEffect } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui/button';

export interface GeneralSettingsViewProps {
  subdomain: string;
  workspaceName?: string | undefined;
  workspaceId?: string | undefined;
  ownerEmail?: string | undefined;
  createdAt?: string | undefined;
}

export function validateWorkspaceName(val: string): string | null {
  if (val.length < 3 || val.length > 40) {
    return 'Workspace name must be between 3 and 40 characters.';
  }
  if (val !== val.trim()) {
    return 'Workspace name must not contain leading or trailing spaces.';
  }
  return null;
}

export function GeneralSettingsView({
  subdomain,
  workspaceName,
}: Readonly<GeneralSettingsViewProps>) {
  const [currentName, setCurrentName] = useState<string>(workspaceName || subdomain);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(workspaceName || subdomain);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch workspace name on mount to ensure synchronization
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspace() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data?.workspaces)) {
            const match = data.workspaces.find(
              (w: { subdomain: string; name: string }) =>
                w.subdomain.toLowerCase() === subdomain.toLowerCase()
            );
            if (match?.name) {
              setCurrentName(match.name);
              setEditValue(match.name);
            }
          }
        }
      } catch {
        // Fallback to initial value
      }
    }
    void loadWorkspace();
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleStartEdit = () => {
    setEditValue(currentName);
    setValidationError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(currentName);
    setValidationError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const error = validateWorkspaceName(editValue);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, name: editValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        setValidationError(data?.error || 'Failed to update workspace name.');
        setIsSaving(false);
        return;
      }

      const updatedName = data.workspace?.name || editValue;
      setCurrentName(updatedName);
      setEditValue(updatedName);
      setIsEditing(false);
      setToastMessage('Workspace name updated.');

      // Notify other shell components (sidebar, switcher) in real-time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workspace-updated', {
            detail: { subdomain, name: updatedName },
          })
        );
      }
    } catch {
      setValidationError('Failed to update workspace name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.md,
        maxWidth: '680px',
        width: '100%',
      }}
    >
      <style>{`
        .workspace-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 14px;
          background-color: var(--bg-canvas, ${THEME.default.surfaces.canvas});
          border-radius: ${RADII.sm};
          border: 1px solid var(--border-subtle, ${THEME.default.borders.hairline});
        }
        .workspace-name-edit-container {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .workspace-name-edit-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        @media (max-width: 639px) {
          .workspace-name-row {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .workspace-name-edit-btn {
            width: 100% !important;
          }
          .workspace-name-edit-container {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .workspace-name-edit-actions {
            width: 100%;
          }
          .workspace-name-action-btn {
            flex: 1 1 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Success Toast */}
      {toastMessage && (
        <div
          role="status"
          data-testid="workspace-name-toast"
          style={{
            padding: `${SPACING.sm} ${SPACING.md}`,
            borderRadius: RADII.sm,
            backgroundColor: 'rgba(46, 189, 133, 0.12)',
            border: `1px solid ${PALETTE.accent4}`,
            color: PALETTE.accent4,
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            data-testid="workspace-toast-dismiss-btn"
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: SPACING.xs,
              fontSize: '0.8125rem',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Single Card: About this workspace */}
      <div
        data-testid="workspace-about-card"
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
            About this workspace
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Name your workspace.
          </p>
        </div>

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
            WORKSPACE NAME
          </span>

          {!isEditing ? (
            <div className="workspace-name-row">
              <div
                data-testid="workspace-name-display"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  wordBreak: 'break-word',
                }}
              >
                {currentName}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="workspace-name-edit-btn"
                className="workspace-name-edit-btn"
                onClick={handleStartEdit}
              >
                Edit
              </Button>
            </div>
          ) : (
            <div>
              <div className="workspace-name-edit-container">
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                  <input
                    type="text"
                    data-testid="workspace-name-input"
                    value={editValue}
                    onChange={(e) => {
                      setEditValue(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSave();
                      } else if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                    disabled={isSaving}
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '38px',
                      padding: `0 ${SPACING.md}`,
                      fontSize: '0.875rem',
                      borderRadius: RADII.sm,
                      border: `1px solid ${validationError ? PALETTE.accent3 : `var(--border-subtle, ${THEME.default.borders.hairline})`}`,
                      backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      outline: 'none',
                    }}
                  />
                </div>
                <div className="workspace-name-edit-actions">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    data-testid="workspace-name-save-btn"
                    className="workspace-name-action-btn"
                    onClick={() => void handleSave()}
                    isLoading={isSaving}
                    disabled={isSaving}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    data-testid="workspace-name-cancel-btn"
                    className="workspace-name-action-btn"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {validationError && (
                <div
                  role="alert"
                  data-testid="workspace-name-error"
                  style={{
                    fontSize: '0.75rem',
                    color: PALETTE.accent3,
                    marginTop: SPACING.xs,
                  }}
                >
                  {validationError}
                </div>
              )}
            </div>
          )}

          <p
            data-testid="workspace-name-helper"
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Rename it any time — the new name shows up everywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
