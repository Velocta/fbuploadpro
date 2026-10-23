/**
 * @file media-preview-modal.test.tsx
 * @description Behavioural tests for the decomposed media preview
 * (spec 133 PR-133-5, T41): the shell on shared/ui Dialog
 * (media-preview-modal.tsx), the viewer (media-preview-viewer.tsx),
 * the metadata column, the footer, and video-frame-capture.ts.
 *
 * This suite carries the spec 113 suite it replaces — the preview
 * pane rendered black while the grid thumbnail rendered fine, because
 * the preview used only the full-size `item.url` (a <video> with no
 * poster, an <img> with no error fallback) on a pitch-black pane.
 * The fallback chain (full-size → thumbnail → placeholder) and the
 * video poster are pinned here as behaviour, rendered live in jsdom:
 * Radix portal content does not exist in the legacy static-markup
 * harness, and behaviour — not markup — is what the decomposition
 * must preserve (spec §2.5). The explorer suite's three preview
 * blocks (spec 029 render, spec 046/US4 frame capture, spec 071
 * lockouts) migrated here in the same PR for the same reason.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaItemResponse } from '@fbuploadpro/contracts';

import { MediaPreviewModal } from '@/components/media/media-preview-modal';
import { resolvePreviewImageSrc } from '@/components/media/media-preview-viewer';
import { captureVideoFrameAsWebp } from '@/components/media/video-frame-capture';

const VIDEO_ITEM: MediaItemResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  userId: '00000000-0000-4000-8000-000000000001',
  folderId: null,
  name: 'Viral Launch Reel.mp4',
  mediaType: 'video',
  mimeType: 'video/mp4',
  fileSize: 15728640,
  storageKey: 'users/u1/media/m1.mp4',
  url: 'https://media.fbuploadpro.com/users/u1/media/m1.mp4',
  thumbnailKey: 'users/u1/thumbnails/m1.webp',
  thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/m1.webp',
  durationSeconds: 45,
  aspectRatio: '9:16',
  captionText: 'Viral Launch Reel',
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
};

const IMAGE_ITEM: MediaItemResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  userId: '00000000-0000-4000-8000-000000000001',
  folderId: null,
  name: 'Product_Showcase_Banner.png',
  mediaType: 'image',
  mimeType: 'image/png',
  fileSize: 2097152,
  storageKey: 'users/u1/media/m2.png',
  url: 'https://media.fbuploadpro.com/users/u1/media/m2.png',
  thumbnailKey: 'users/u1/thumbnails/m2.webp',
  thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/m2.webp',
  durationSeconds: null,
  aspectRatio: '1:1',
  captionText: '',
  createdAt: '2026-10-10T11:00:00.000Z',
  updatedAt: '2026-10-10T11:00:00.000Z',
};

describe('Spec 113: resolvePreviewImageSrc fallback order', () => {
  const item = { url: IMAGE_ITEM.url, thumbnailUrl: IMAGE_ITEM.thumbnailUrl };

  it('prefers the full-size URL when nothing has failed', () => {
    expect(resolvePreviewImageSrc(item, new Set())).toBe(IMAGE_ITEM.url);
  });

  it('falls back to the thumbnail URL (the grid source) when the full-size URL fails', () => {
    expect(resolvePreviewImageSrc(item, new Set([IMAGE_ITEM.url]))).toBe(
      IMAGE_ITEM.thumbnailUrl
    );
  });

  it('returns null when both sources have failed so a placeholder renders instead of black', () => {
    expect(
      resolvePreviewImageSrc(item, new Set([IMAGE_ITEM.url, IMAGE_ITEM.thumbnailUrl!]))
    ).toBeNull();
  });

  it('returns null when the full-size URL fails and there is no distinct thumbnail', () => {
    expect(
      resolvePreviewImageSrc({ url: IMAGE_ITEM.url, thumbnailUrl: null }, new Set([IMAGE_ITEM.url]))
    ).toBeNull();
    expect(
      resolvePreviewImageSrc(
        { url: IMAGE_ITEM.url, thumbnailUrl: IMAGE_ITEM.url },
        new Set([IMAGE_ITEM.url])
      )
    ).toBeNull();
  });
});

describe('Spec 113: preview pane rendering (never black for a loadable asset)', () => {
  it('renders the video with the thumbnail as poster so the pane is not black before playback', () => {
    render(<MediaPreviewModal item={VIDEO_ITEM} open={true} onOpenChange={vi.fn()} />);

    const video = screen.getByTestId('modal-video-player') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(VIDEO_ITEM.url);
    expect(video.getAttribute('poster')).toBe(VIDEO_ITEM.thumbnailUrl);
    expect(video.getAttribute('preload')).toBe('metadata');
    expect(screen.queryByTestId('modal-preview-placeholder')).not.toBeInTheDocument();
  });

  it('renders a video without a thumbnail with no poster and no placeholder', () => {
    const noThumb = { ...VIDEO_ITEM, thumbnailKey: null, thumbnailUrl: null };
    render(<MediaPreviewModal item={noThumb} open={true} onOpenChange={vi.fn()} />);

    const video = screen.getByTestId('modal-video-player') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(noThumb.url);
    expect(video.getAttribute('poster')).toBeNull();
    expect(screen.queryByTestId('modal-preview-placeholder')).not.toBeInTheDocument();
  });

  it('renders an image preview from the full-size URL', () => {
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />);

    const img = screen.getByTestId('modal-image-preview');
    expect(img.getAttribute('src')).toContain('m2.png');
    expect(img.getAttribute('alt')).toBe(IMAGE_ITEM.name);
    expect(screen.queryByTestId('modal-preview-placeholder')).not.toBeInTheDocument();
  });

  it('falls back to the thumbnail when the full-size image fails to load', () => {
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />);

    fireEvent.error(screen.getByTestId('modal-image-preview'));
    const img = screen.getByTestId('modal-image-preview');
    expect(img.getAttribute('src')).toContain('m2.webp');
    expect(screen.queryByTestId('modal-preview-placeholder')).not.toBeInTheDocument();
  });

  it('shows the placeholder — not a black pane — when every image source has failed', () => {
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />);

    fireEvent.error(screen.getByTestId('modal-image-preview'));
    fireEvent.error(screen.getByTestId('modal-image-preview'));
    expect(screen.queryByTestId('modal-image-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-preview-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
  });

  it('falls back to the thumbnail still when the video source fails', () => {
    render(<MediaPreviewModal item={VIDEO_ITEM} open={true} onOpenChange={vi.fn()} />);

    fireEvent.error(screen.getByTestId('modal-video-player'));
    const still = screen.getByTestId('modal-video-fallback-still');
    expect(still.getAttribute('src')).toContain('m1.webp');
    expect(screen.queryByTestId('modal-preview-placeholder')).not.toBeInTheDocument();
  });
});

describe('Preview metadata + editors (PB-8)', () => {
  it('renders the label/value rows incl. upload date and duration for video', () => {
    render(<MediaPreviewModal item={VIDEO_ITEM} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Asset Details')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('15.0 MB')).toBeInTheDocument();
    expect(screen.getByText('9:16')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('0:45')).toBeInTheDocument();
    expect(screen.getByText('Upload date')).toBeInTheDocument();
    expect(screen.getByText('Oct 10, 2026')).toBeInTheDocument();
    // PB-9: no Schedule, no eligibility tags anywhere in the preview.
    expect(screen.queryByText(/Schedule/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reels|Feed|Story/)).not.toBeInTheDocument();
  });

  it('omits the duration row for images and seeds the caption counter', () => {
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('0 / 2,200')).toBeInTheDocument();
  });

  it('saves the trimmed name + caption through onSave and closes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    const nameInput = screen.getByTestId('modal-filename-input');
    await user.clear(nameInput);
    await user.type(nameInput, '  Renamed Reel.mp4  ');
    const captionInput = screen.getByTestId('modal-caption-input');
    await user.clear(captionInput);
    await user.type(captionInput, '  Fresh caption  ');
    expect(screen.getByText('17 / 2,200')).toBeInTheDocument();

    await user.click(screen.getByTestId('modal-save-caption-btn'));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(VIDEO_ITEM.id, {
        name: 'Renamed Reel.mp4',
        captionText: 'Fresh caption',
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('locks out duplicate actions while a save is in flight (spec 071)', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('modal-save-caption-btn'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('modal-save-caption-btn')).toBeDisabled();
    expect(screen.getByTestId('modal-delete-media-btn')).toBeDisabled();
    expect(screen.getByTestId('modal-filename-input')).toBeDisabled();
    expect(screen.getByTestId('modal-caption-input')).toBeDisabled();

    resolveSave();
    await waitFor(() =>
      expect(screen.getByTestId('modal-save-caption-btn')).not.toBeDisabled()
    );
  });

  it('keeps the dialog open with an inline error when the save fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('network down'));
    const onOpenChange = vi.fn();
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    await user.click(screen.getByTestId('modal-save-caption-btn'));
    expect(
      await screen.findByText('Could not save changes. Please try again.')
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId('media-preview-modal')).toBeInTheDocument();
  });
});

describe('Preview navigation + frame capture (PB-14)', () => {
  it('renders visible Previous/Next controls and wires them to the handlers', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        hasPrevious={true}
        hasNext={false}
        onPrevious={onPrevious}
        onNext={onNext}
        onOpenChange={vi.fn()}
      />
    );

    const prev = screen.getByTestId('preview-prev-btn');
    const next = screen.getByTestId('preview-next-btn');
    expect(prev).not.toBeDisabled();
    expect(next).toBeDisabled();
    await user.click(prev);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('renders no navigation controls when the consumer wires none', () => {
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('preview-prev-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-next-btn')).not.toBeInTheDocument();
  });

  it('shows "Set Current Frame as Thumbnail" for video only and captures through the utility', async () => {
    const user = userEvent.setup();
    const onUpdateThumbnail = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateThumbnail={onUpdateThumbnail}
      />
    );

    const captureBtn = screen.getByTestId('set-video-frame-thumbnail-btn');
    expect(captureBtn).toHaveAttribute('aria-label', 'Set Current Frame as Thumbnail');
    await user.click(captureBtn);
    await waitFor(() => expect(onUpdateThumbnail).toHaveBeenCalledTimes(1));
    const [mediaId, captured] = onUpdateThumbnail.mock.calls[0] as [
      string,
      { blob: Blob | null; dataUrl: string },
    ];
    expect(mediaId).toBe(VIDEO_ITEM.id);
    expect(captured.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect(
      await screen.findByText('Frame captured as thumbnail')
    ).toBeInTheDocument();
    unmount();

    render(
      <MediaPreviewModal
        item={IMAGE_ITEM}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateThumbnail={onUpdateThumbnail}
      />
    );
    expect(
      screen.queryByTestId('set-video-frame-thumbnail-btn')
    ).not.toBeInTheDocument();
  });

  it('captureVideoFrameAsWebp falls back to the placeholder data URL with no video', async () => {
    const captured = await captureVideoFrameAsWebp(null);
    expect(captured.blob).toBeNull();
    expect(captured.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });
});

describe('Preview delete (AlertDialog pattern, PB-8 footer)', () => {
  it('confirms through the AlertDialog: focus on Keep, Esc does not dismiss, Keep deletes nothing', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={vi.fn()}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('modal-delete-media-btn'));
    const confirm = await screen.findByTestId('preview-delete-confirm-dialog');
    expect(confirm).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    const keep = screen.getByTestId('preview-delete-keep-btn');
    await waitFor(() => expect(keep).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('preview-delete-confirm-dialog')).toBeInTheDocument();

    await user.click(keep);
    await waitFor(() =>
      expect(screen.queryByTestId('preview-delete-confirm-dialog')).not.toBeInTheDocument()
    );
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes through the confirm and closes the preview', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <MediaPreviewModal
        item={VIDEO_ITEM}
        open={true}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('modal-delete-media-btn'));
    await user.click(await screen.findByTestId('preview-delete-confirm-btn'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(VIDEO_ITEM.id));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape when nothing is in flight', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<MediaPreviewModal item={IMAGE_ITEM} open={true} onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
