/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PromptLibrarySurface } from './prompt-library-surface';

const payload = {
  curated: [
    {
      id: 'hooks-01',
      title: 'Hook prompt',
      body: 'Write a hook about [topic].',
      category: 'hooks',
    },
    {
      id: 'captions-01',
      title: 'Caption prompt',
      body: 'Write a caption for [photo].',
      category: 'captions',
    },
  ],
  personal: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000001',
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'My private prompt',
      body: 'My private body.',
      category: 'engagement',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    },
  ],
};

function renderSurface() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PromptLibrarySurface subdomain="acme" />
    </QueryClientProvider>
  );
}

describe('PromptLibrarySurface', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders curated and personal prompts', async () => {
    renderSurface();
    expect(await screen.findByText('Hook prompt')).toBeInTheDocument();
    expect(screen.getByText('Caption prompt')).toBeInTheDocument();
    expect(screen.getByText('My private prompt')).toBeInTheDocument();
  });

  it('narrows the list on search (title and body)', async () => {
    const user = userEvent.setup();
    renderSurface();
    await screen.findByText('Hook prompt');
    await user.type(screen.getByTestId('prompt-search'), 'caption');
    await waitFor(() => {
      expect(screen.queryByText('Hook prompt')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Caption prompt')).toBeInTheDocument();
  });

  it('partitions curated vs personal via the source tabs', async () => {
    const user = userEvent.setup();
    renderSurface();
    await screen.findByText('Hook prompt');
    await user.click(screen.getByRole('tab', { name: 'My prompts' }));
    await waitFor(() => {
      expect(screen.queryByText('Hook prompt')).not.toBeInTheDocument();
    });
    expect(screen.getByText('My private prompt')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Curated' }));
    await waitFor(() => {
      expect(screen.queryByText('My private prompt')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hook prompt')).toBeInTheDocument();
  });

  it('filters by category via the category select', async () => {
    const user = userEvent.setup();
    renderSurface();
    await screen.findByText('Hook prompt');
    await user.click(screen.getByTestId('prompt-category-filter'));
    await user.click(await screen.findByRole('option', { name: 'Captions' }));
    await waitFor(() => {
      expect(screen.queryByText('Hook prompt')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Caption prompt')).toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderSurface();
    await screen.findByText('Hook prompt');
    await user.type(screen.getByTestId('prompt-search'), 'zzz-no-match');
    expect(await screen.findByText('No prompts match your search')).toBeInTheDocument();
  });
});
