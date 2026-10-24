'use client';

/**
 * A compact live preview of the X post (spec 132 §4.5) — destination
 * identity, text, the single media thumbnail, poll options and the
 * quote, so what publishes is what was reviewed (UX rule 12: no
 * separate review step in v1).
 */
import React from 'react';
import Image from 'next/image';
import type { XMediaItem } from './x-media-area';

export interface XComposerPreviewProps {
  destinationName: string;
  handle: string | null;
  text: string;
  item: XMediaItem | null;
  pollOptions: readonly string[] | null;
  quoteTweetId: string;
}

export function XComposerPreview({
  destinationName,
  handle,
  text,
  item,
  pollOptions,
  quoteTweetId,
}: Readonly<XComposerPreviewProps>) {
  const thumb = item ? item.thumbnailUrl || item.url : null;

  return (
    <div data-testid="x-composer-preview" className="flex flex-col gap-2">
      <span className="text-body font-medium text-ink">Preview</span>
      <div className="flex flex-col gap-2 rounded-md border border-line bg-panel p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-body font-semibold text-ink">{destinationName}</span>
          {handle && <span className="text-metadata text-ink-sub">{handle}</span>}
        </div>
        {text.trim() ? (
          <p className="m-0 text-body whitespace-pre-wrap text-ink">{text}</p>
        ) : (
          <p className="m-0 text-body text-ink-sub">Your post text will appear here.</p>
        )}
        {item && (
          <div className="relative aspect-video w-full max-w-80 overflow-hidden rounded-sm border border-line">
            {thumb ? (
              <Image
                src={thumb}
                alt={item.name}
                width={320}
                height={180}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-metadata text-ink-sub">
                {item.mediaType}
              </div>
            )}
          </div>
        )}
        {pollOptions && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {pollOptions.map((option, index) => (
              <li
                key={index}
                className="rounded-sm border border-line px-3 py-2 text-body text-ink"
              >
                {option.trim() || `Option ${index + 1}`}
              </li>
            ))}
          </ul>
        )}
        {quoteTweetId.trim() && (
          <p className="m-0 text-metadata text-ink-sub">Quoting post {quoteTweetId.trim()}</p>
        )}
      </div>
    </div>
  );
}
