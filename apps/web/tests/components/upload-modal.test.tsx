import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  UploadModal,
  computeAspectRatio,
  detectMediaType,
} from '../../src/components/media/upload-modal';
import type { FolderResponse } from '@fbuploadpro/contracts';

describe('UploadModal Component & Helpers (T106)', () => {
  const dummyFolders: FolderResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      name: 'Reels',
      color: 'blue',
      itemCount: 2,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
  ];

  describe('Helper Functions', () => {
    it('detects media type from MIME string', () => {
      expect(detectMediaType('video/mp4')).toBe('video');
      expect(detectMediaType('video/quicktime')).toBe('video');
      expect(detectMediaType('image/png')).toBe('image');
      expect(detectMediaType('image/webp')).toBe('image');
    });

    it('computes standard aspect ratios accurately', () => {
      expect(computeAspectRatio(1080, 1920)).toBe('9:16');
      expect(computeAspectRatio(1920, 1080)).toBe('16:9');
      expect(computeAspectRatio(1080, 1080)).toBe('1:1');
      expect(computeAspectRatio(1080, 1350)).toBe('4:5');
    });
  });

  describe('Modal Rendering', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <UploadModal
          isOpen={false}
          onClose={vi.fn()}
          subdomain="acme"
          folders={dummyFolders}
          onUploadSuccess={vi.fn()}
        />
      );
      expect(html).toBe('');
    });

    it('renders upload dropzone, folder selector, and tags field when isOpen is true', () => {
      const html = renderToString(
        <UploadModal
          isOpen={true}
          onClose={vi.fn()}
          subdomain="acme"
          folders={dummyFolders}
          onUploadSuccess={vi.fn()}
        />
      );

      expect(html).toContain('Upload Media Asset');
      expect(html).toContain('Drag &amp; drop video or image');
      expect(html).toContain('Select folder');
      expect(html).toContain('Reels');
      expect(html).toContain('Tags');
    });
  });
});
