/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PromptResponse } from '@fbuploadpro/contracts';
import { PromptFormDialog } from './prompt-form-dialog';

const editing: PromptResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000001',
  userId: '11111111-1111-4111-a111-111111111111',
  title: 'Old title',
  body: 'Old body.',
  category: 'hooks',
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
};

describe('PromptFormDialog', () => {
  it('submits title, body, and category for a new prompt', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PromptFormDialog open onOpenChange={() => {}} onSubmit={onSubmit} />);
    await user.type(screen.getByTestId('prompt-form-title'), 'My new hook');
    await user.type(screen.getByTestId('prompt-form-body'), 'Write a hook about a product launch.');
    await user.click(screen.getByTestId('prompt-form-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'My new hook',
      body: 'Write a hook about a product launch.',
      category: 'hooks',
    });
  });

  it('prefills the form when editing', async () => {
    render(
      <PromptFormDialog open onOpenChange={() => {}} editingPrompt={editing} onSubmit={vi.fn()} />
    );
    expect(screen.getByTestId('prompt-form-title')).toHaveValue('Old title');
    expect(screen.getByTestId('prompt-form-body')).toHaveValue('Old body.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('blocks submit with an empty title and shows the error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PromptFormDialog open onOpenChange={() => {}} onSubmit={onSubmit} />);
    await user.type(screen.getByTestId('prompt-form-body'), 'Some body.');
    await user.click(screen.getByTestId('prompt-form-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/at least 1 character/i)).toBeInTheDocument();
  });
});
