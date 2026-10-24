/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CuratedPrompt, PromptResponse } from '@fbuploadpro/contracts';
import { PromptCard } from './prompt-card';

const curated: CuratedPrompt = {
  id: 'hooks-01',
  title: 'Scroll-stopping video openers',
  body: 'Write 10 opening lines for a short video about [topic].',
  category: 'hooks',
};

const personal: PromptResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000001',
  userId: '11111111-1111-4111-a111-111111111111',
  title: 'My launch hook',
  body: 'Write a launch hook for [product].',
  category: 'captions',
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
};

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('PromptCard', () => {
  it('renders title, body, and category label for a curated prompt', () => {
    render(<PromptCard item={{ source: 'curated', prompt: curated }} />);
    expect(screen.getByText('Scroll-stopping video openers')).toBeInTheDocument();
    expect(screen.getByText(/Write 10 opening lines/)).toBeInTheDocument();
    expect(screen.getByText('Hooks')).toBeInTheDocument();
  });

  it('shows no Edit/Delete for curated prompts', () => {
    render(<PromptCard item={{ source: 'curated', prompt: curated }} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows Edit/Delete for personal prompts', () => {
    render(
      <PromptCard
        item={{ source: 'personal', prompt: personal }}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('copies the exact prompt body and shows Copied feedback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<PromptCard item={{ source: 'curated', prompt: curated }} />);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(curated.body);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('shows an inline error when copying fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    // Force the fallback path to fail too: jsdom has no execCommand success.
    document.execCommand = vi.fn().mockReturnValue(false);
    render(<PromptCard item={{ source: 'curated', prompt: curated }} />);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Copy failed/);
  });
});
