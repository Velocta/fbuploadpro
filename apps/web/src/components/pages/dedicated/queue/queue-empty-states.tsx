'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { THEME, PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { PostingTimeQuickAdd } from '../composer/posting-time-quick-add';
import type { PageSlotSummary } from '../tab-dashboard';

export interface QueueEmptyStatesProps {
  pageId: string;
  subdomain: string;
  slots: PageSlotSummary[];
  onSlotsChanged: (slots: PageSlotSummary[]) => void;
  onCreatePost: () => void;
  onBulkAdd: () => void;
  checklistDismissed: boolean;
  onDismissChecklist: () => void;
}

const CHECKLIST_LINK_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: TYPOGRAPHY.weights.medium,
  color: PALETTE.primary,
  textAlign: 'left',
};

/**
 * Content-tab empty states (brief §11.1): a dismissible 3-step checklist plus
 * the centered "Nothing here yet." state with working entry buttons.
 */
export function QueueEmptyStates({
  pageId,
  subdomain,
  slots,
  onSlotsChanged,
  onCreatePost,
  onBulkAdd,
  checklistDismissed,
  onDismissChecklist,
}: Readonly<QueueEmptyStatesProps>) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <div
      data-testid="queue-empty-state"
      style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}
    >
      {!checklistDismissed && (
        <div
          aria-label="Getting started checklist"
          style={{
            padding: `${SPACING.md} 0`,
            borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACING.md,
              marginBottom: SPACING.sm,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Get your queue running
            </h3>
            <Button variant="link" size="sm" onClick={onDismissChecklist}>
              Dismiss
            </Button>
          </div>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.sm,
            }}
          >
            <li style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                1.
              </span>
              <button
                type="button"
                onClick={() => setShowQuickAdd((prev) => !prev)}
                style={CHECKLIST_LINK_STYLE}
                aria-expanded={showQuickAdd}
              >
                Set posting times
              </button>
              {slots.length > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  ({slots.length} set)
                </span>
              )}
            </li>
            {showQuickAdd && (
              <li style={{ paddingLeft: SPACING.lg }}>
                <PostingTimeQuickAdd
                  pageId={pageId}
                  subdomain={subdomain}
                  onAdded={(slot) => {
                    onSlotsChanged([...slots, slot]);
                    setShowQuickAdd(false);
                  }}
                />
              </li>
            )}
            <li style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                2.
              </span>
              <Link
                href={`/tenant/${subdomain}/media`}
                style={{ ...CHECKLIST_LINK_STYLE, textDecoration: 'none' }}
              >
                Add media
              </Link>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                3.
              </span>
              <button type="button" onClick={onCreatePost} style={CHECKLIST_LINK_STYLE}>
                Create your first posts
              </button>
            </li>
          </ol>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: `${SPACING.xxl} 0`,
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Nothing here yet.
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            maxWidth: '380px',
          }}
        >
          Create a post or bulk-add media to fill your queue.
        </p>
        <div style={{ display: 'flex', gap: SPACING.sm, marginTop: SPACING.xs }}>
          <Button variant="primary" size="sm" onClick={onCreatePost}>
            Create post
          </Button>
          <Button variant="secondary" size="sm" onClick={onBulkAdd}>
            Bulk add
          </Button>
        </div>
      </div>
    </div>
  );
}
