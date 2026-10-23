import type { Metadata } from 'next';
import React from 'react';
import { Card } from '@/components/shared/ui/card';
import { getWorkspaceDisplayName } from './workspace-display-name';

/** Title resolves through the tenant layout's `<Section> · <Workspace>` template (§3.3.4). */
export const metadata: Metadata = { title: 'Home' };

interface TenantIndexPageProps {
  params: Promise<{ subdomain: string }>;
}

/**
 * Workspace home (spec 130 §5.5, PR-130-3) — preservation rebuild
 * (OD130-1 = A): the welcome card ONLY. No vital-few elements, no
 * checklist, no new data sections. Copy and behaviour are §4.2-verbatim;
 * only the construction changes — the former hand-rolled card (inline
 * styles + `lib/theme` preset imports) is rebuilt on the shared/ui
 * `Card` primitive and semantic token utilities.
 *
 * Server-first (§6 duty 1): the display name resolves in the server
 * component through the `cache()`-deduped resolver (§5.8) — no client
 * fetch and no raw fetch call. A failed name lookup falls back to the
 * subdomain slug (§4.1 — the workspace's real identifier, preserved
 * deliberately; distinct from the deleted identity fabrication).
 *
 * Geometry: outer measure `max-w-3xl` (48rem — the container-token step
 * nearest the former 800px) with 24px page padding; the card carries
 * 24px padding via the primitive's `py-6` + `px-6` here. The heading
 * sits on the token type scale (`text-xl` — the scale has no 24px step;
 * UI Rule 14 mandates the scale) with the original `tracking-h1`,
 * bold weight and primary text colour; the body is `text-body` (the
 * former 0.875rem exactly) in secondary text. `loading.tsx` mirrors
 * this geometry skeleton-for-skeleton.
 */
export default async function TenantIndexPage({ params }: Readonly<TenantIndexPageProps>) {
  const { subdomain } = await params;
  // H5: the heading must show the workspace display name, never the internal slug.
  const workspaceName = (await getWorkspaceDisplayName(subdomain)) ?? subdomain;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <Card className="gap-1 px-6">
        <h1 className="text-xl leading-heading font-bold tracking-h1 text-ink">
          Workspace: {workspaceName}
        </h1>
        <p className="text-body leading-body text-ink-sub">
          Welcome to your FBUploadPro workspace.
        </p>
      </Card>
    </div>
  );
}
