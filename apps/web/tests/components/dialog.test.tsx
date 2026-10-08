import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../../src/components/ui/dialog';

describe('Dialog Component Suite', () => {
  it('renders modal dialog when open is true with accessible roles', () => {
    const html = renderToString(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>Are you sure?</DialogBody>
          <DialogFooter>
            <button type="button">Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Confirm Delete');
    expect(html).toContain('This action cannot be undone.');
    expect(html).toContain('Are you sure?');
  });

  it('renders nothing when open is false', () => {
    const html = renderToString(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Hidden</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Hidden');
  });
});
