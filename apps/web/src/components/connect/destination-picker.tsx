'use client';

/**
 * Destination picker (Spec 123, Part C).
 *
 * Reuses the spec 109 Pages-discovery behaviour from add-page-modal:
 * destinations that share a name are never merged — each row is
 * distinguished by its handle, avatar, and an ID suffix.
 *
 * Modes:
 *  - 'picker': multi-select checkboxes, confirm adds the picked rows.
 *  - 'single-confirm': the one destination is shown as a read-back with a
 *    single confirm button (platforms whose flow yields exactly one).
 */
import React, { useMemo, useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { formatPageIdSuffix } from '@/components/pages/page-card';
import type { DiscoveredDestination } from '@/lib/connect/registry';
import { PLATFORM_LABELS, type Platform } from '@/lib/connect/registry';

export interface DestinationPickerProps {
  platform: Platform;
  subdomain: string;
  destinations: DiscoveredDestination[];
  mode: 'picker' | 'single-confirm';
}

/** Names that appear more than once — those rows get an ID suffix line. */
export function findDuplicateDestinationNames(
  destinations: DiscoveredDestination[]
): Set<string> {
  const counts = new Map<string, number>();
  for (const destination of destinations) {
    const key = destination.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
}

function DestinationAvatar({
  name,
  avatarUrl,
}: Readonly<{ name: string; avatarUrl?: string | null }>) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={36}
        height={36}
        style={{ borderRadius: RADII.full, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: '36px',
        height: '36px',
        borderRadius: RADII.full,
        backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.875rem',
        fontWeight: TYPOGRAPHY.weights.semibold,
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export function destinationSubtitle(
  destination: DiscoveredDestination,
  isDuplicateName: boolean
): string {
  const parts: string[] = [];
  if (destination.handle) {
    parts.push(
      destination.handle.startsWith('@')
        ? destination.handle
        : `@${destination.handle}`
    );
  }
  if (isDuplicateName) {
    const suffix = formatPageIdSuffix(destination.externalDestinationId);
    if (suffix) parts.push(`ID ${suffix}`);
  }
  return parts.join(' · ');
}

export function DestinationPicker({
  platform,
  subdomain,
  destinations,
  mode,
}: Readonly<DestinationPickerProps>) {
  const platformName = PLATFORM_LABELS[platform];
  const isSingleConfirm = mode === 'single-confirm';
  const confirmTarget = isSingleConfirm ? destinations.slice(0, 1) : destinations;

  const [selectedIds, setSelectedIds] = useState<string[]>(
    isSingleConfirm
      ? confirmTarget.map((d) => d.externalDestinationId)
      : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const duplicateNames = useMemo(
    () => findDuplicateDestinationNames(destinations),
    [destinations]
  );

  const handleToggle = (externalDestinationId: string) => {
    setSelectedIds((prev) =>
      prev.includes(externalDestinationId)
        ? prev.filter((id) => id !== externalDestinationId)
        : [...prev, externalDestinationId]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0 || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/connect/${platform}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationIds: selectedIds }),
      });
      if (!res.ok) {
        setErrorMessage("Couldn't save your choices. Please try again.");
        setIsSaving(false);
        return;
      }
      const data = (await res.json()) as { accountsUrl?: string };
      window.location.assign(
        data.accountsUrl ?? `/tenant/${subdomain}/accounts`
      );
    } catch {
      setErrorMessage("Couldn't save your choices. Please try again.");
      setIsSaving(false);
    }
  };

  const rows = isSingleConfirm ? confirmTarget : destinations;

  return (
    <div data-testid="destination-picker" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        {rows.map((destination) => {
          const isChecked = selectedIds.includes(
            destination.externalDestinationId
          );
          const isDuplicateName = duplicateNames.has(
            destination.name.trim().toLowerCase()
          );
          const subtitle = destinationSubtitle(destination, isDuplicateName);
          const rowContent = (
            <>
              {!isSingleConfirm && (
                <input
                  type="checkbox"
                  data-testid={`destination-checkbox-${destination.externalDestinationId}`}
                  checked={isChecked}
                  onChange={() => handleToggle(destination.externalDestinationId)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: PALETTE.primary,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
              )}
              <DestinationAvatar
                name={destination.name}
                avatarUrl={destination.avatarUrl ?? null}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    fontSize: '0.875rem',
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {destination.name}
                </div>
                {subtitle && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      marginTop: '2px',
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
            </>
          );
          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            padding: '10px 12px',
            backgroundColor:
              isChecked && !isSingleConfirm
                ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                : 'transparent',
            borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          };
          return isSingleConfirm ? (
            <div
              key={destination.externalDestinationId}
              data-testid={`destination-row-${destination.externalDestinationId}`}
              style={rowStyle}
            >
              {rowContent}
            </div>
          ) : (
            <label
              key={destination.externalDestinationId}
              data-testid={`destination-row-${destination.externalDestinationId}`}
              style={{ ...rowStyle, cursor: 'pointer' }}
            >
              {rowContent}
            </label>
          );
        })}
      </div>

      {errorMessage && (
        <p
          data-testid="destination-picker-error"
          style={{
            margin: `${SPACING.md} 0 0 0`,
            fontSize: '0.875rem',
            color: PALETTE.accent3,
          }}
        >
          {errorMessage}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: SPACING.lg,
        }}
      >
        <button
          type="button"
          data-testid="destination-picker-confirm-btn"
          disabled={selectedIds.length === 0 || isSaving}
          onClick={() => void handleConfirm()}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            height: '38px',
            padding: `0 ${SPACING.lg}`,
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor:
              selectedIds.length === 0 || isSaving
                ? 'not-allowed'
                : 'pointer',
            opacity: selectedIds.length === 0 || isSaving ? 0.6 : 1,
          }}
        >
          {isSaving
            ? 'Adding…'
            : isSingleConfirm
              ? `Add this ${platformName} destination`
              : `Add selected (${selectedIds.length})`}
        </button>
      </div>
    </div>
  );
}
