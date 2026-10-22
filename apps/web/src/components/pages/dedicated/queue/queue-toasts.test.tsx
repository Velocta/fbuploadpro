import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  QueueToasts,
  QUEUE_REORDER_ERROR_MESSAGE,
  QUEUE_REORDER_SUCCESS_MESSAGE,
  type QueueToast,
} from './queue-toasts';

function renderToasts(toasts: QueueToast[]): string {
  return renderToStaticMarkup(<QueueToasts toasts={toasts} onDismiss={vi.fn()} />);
}

describe('queue reorder feedback', () => {
  it('defines a plain-language success message for reorder (arrows and drag)', () => {
    expect(QUEUE_REORDER_SUCCESS_MESSAGE).toBe('Queue reordered — posting times updated.');
  });

  it('defines a plain-language error message for a failed reorder', () => {
    expect(QUEUE_REORDER_ERROR_MESSAGE).toBe("Couldn't save the new order.");
  });

  it('renders the reorder success toast visibly', () => {
    const html = renderToasts([{ id: 1, message: QUEUE_REORDER_SUCCESS_MESSAGE, tone: 'success' }]);
    expect(html).toContain('Queue reordered — posting times updated.');
  });

  it('renders the reorder error toast visibly', () => {
    const html = renderToasts([{ id: 2, message: QUEUE_REORDER_ERROR_MESSAGE, tone: 'error' }]);
    expect(html).toContain('Couldn&#x27;t save the new order.');
  });

  it('renders nothing when there are no toasts', () => {
    expect(renderToasts([])).toBe('');
  });
});
