import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CaptionModal } from '../../src/components/media/caption-modal';
import type { CaptionTemplateResponse } from '@fbuploadpro/contracts';

describe('CaptionModal Component (T109)', () => {
  const dummyTemplates: CaptionTemplateResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      title: 'Summer Sale Promo',
      content: 'Get 50% off all apparel this weekend! #sale #apparel',
      tags: ['sale', 'summer'],
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      userId: 'user-1',
      title: 'Daily Motivational Reel',
      content: 'Stay hungry, stay foolish. #motivation #growth',
      tags: ['motivation'],
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
  ];

  it('returns null when isOpen is false', () => {
    const html = renderToString(
      <CaptionModal
        isOpen={false}
        onClose={vi.fn()}
        templates={dummyTemplates}
        onCreateTemplate={vi.fn()}
        onUpdateTemplate={vi.fn()}
        onDeleteTemplate={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders caption templates list and tags when isOpen is true', () => {
    const html = renderToString(
      <CaptionModal
        isOpen={true}
        onClose={vi.fn()}
        templates={dummyTemplates}
        onCreateTemplate={vi.fn()}
        onUpdateTemplate={vi.fn()}
        onDeleteTemplate={vi.fn()}
      />
    );

    expect(html).toContain('Caption Templates Vault');
    expect(html).toContain('Summer Sale Promo');
    expect(html).toContain('Get 50% off all apparel this weekend!');
    expect(html).toContain('#sale');
    expect(html).toContain('Daily Motivational Reel');
    expect(html).toContain('Stay hungry, stay foolish.');
    expect(html).toContain('+ New Template');
  });

  it('renders empty prompt when templates list is empty', () => {
    const html = renderToString(
      <CaptionModal
        isOpen={true}
        onClose={vi.fn()}
        templates={[]}
        onCreateTemplate={vi.fn()}
        onUpdateTemplate={vi.fn()}
        onDeleteTemplate={vi.fn()}
      />
    );

    expect(html).toContain('No caption templates saved');
  });
});
