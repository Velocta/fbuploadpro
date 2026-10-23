'use client';

/**
 * AuthShowcasePanel — the login showcase panel, rebuilt for spec 136
 * (PR-136A) on design tokens + token-backed utilities only.
 *
 * The copy is the approved block of 2026-10-16 (spec 136 §3.1),
 * carried verbatim: the eyebrow, the three-line headline (this panel
 * renders the login page's sole top-level heading, with the final
 * segment in the accent gold), the subhead, and the three feature
 * rows. The feature descriptions, platform line, and footer line
 * that shipped under specs 061/064 are preserved verbatim too
 * (spec 136 §3.5 / OD-136-1 default). Nothing from the approved
 * record's absent list is added: no first-comments row, no
 * testimonial, no "See how it works" link.
 */

import React from 'react';
import Link from 'next/link';
import { ClockIcon, LayoutGridIcon, LockIcon } from 'lucide-react';
import { BrandMark } from '@/components/brand';
import { cn } from '@/lib/utils';

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FEATURES: readonly FeatureItem[] = [
  {
    icon: <ClockIcon className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden="true" />,
    title: 'Post from anywhere',
    desc: 'Schedule from your phone or laptop — your posts publish from the cloud.',
  },
  {
    icon: <LayoutGridIcon className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden="true" />,
    title: 'Every platform, one dashboard',
    desc: 'Connect each account once, then run everything from a single place.',
  },
  {
    icon: <LockIcon className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden="true" />,
    title: 'Your accounts stay yours',
    desc: 'You sign in through each platform directly — your passwords never leave them.',
  },
] as const;

export function AuthShowcasePanel() {
  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div>
        {/* Brand row */}
        <Link href="/login" className="inline-flex items-center gap-3 self-start no-underline">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-line bg-subtle">
            <BrandMark size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg leading-heading font-bold tracking-h3 text-ink">
              FBUploadPro
            </span>
            <span className="text-metadata text-ink-sub">Content automation for creators</span>
          </div>
        </Link>

        {/* Showcase content */}
        <div className="mt-12">
          {/* Eyebrow */}
          <div className="mb-3 text-xs font-semibold tracking-caption text-primary uppercase">
            CREATE · SCHEDULE · GROW
          </div>

          {/* Headline — three lines, final segment in the accent gold. */}
          <h1 className="mb-4 text-xxxl leading-heading font-heavy tracking-h1 text-ink">
            Your pages,
            <br />
            posting themselves —
            <br />
            <span className="text-primary">100% on the cloud.</span>
          </h1>

          {/* Subhead */}
          <p className="mb-6 max-w-md text-body leading-body text-ink-sub">
            Schedule reels and posts across Facebook, Instagram, TikTok, YouTube, Threads, and X —
            they go live while you sleep, even when your laptop is closed.
          </p>

          {/* Feature list — three rows separated by hairline dividers. */}
          <div className="flex w-full flex-col">
            {FEATURES.map((item, index) => (
              <div
                key={item.title}
                className={cn(
                  'flex items-start gap-3',
                  index === 0 && 'pb-4',
                  index > 0 && index < FEATURES.length - 1 && 'py-4',
                  index === FEATURES.length - 1 && 'pt-4',
                  index < FEATURES.length - 1 && 'border-b border-line'
                )}
              >
                {item.icon}
                <div className="flex-1">
                  <div className="text-body leading-heading-loose font-semibold text-ink">
                    {item.title}
                  </div>
                  <div className="mt-1 text-metadata leading-body text-ink-sub">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Platform line */}
          <div className="my-6 text-xs text-ink-dim">
            Facebook · Instagram · TikTok · YouTube · Threads · X
          </div>
        </div>
      </div>

      {/* Footer row — no "See how it works" link, per the approved record. */}
      <div className="flex items-center justify-start border-t border-line pt-4 text-xs text-ink-dim">
        <span>Official platform logins · Encrypted end-to-end</span>
      </div>
    </div>
  );
}
export const LoginShowcasePanel = AuthShowcasePanel;
