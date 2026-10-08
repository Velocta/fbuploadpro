import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../src/components/ui/table';

describe('Table Component Suite', () => {
  it('renders data table with headers, rows, cells, and tabular figures', () => {
    const html = renderToString(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset Name</TableHead>
            <TableHead>Views</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Video 1</TableCell>
            <TableCell tabular>1,420,500</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(html).toContain('fbu-table');
    expect(html).toContain('Asset Name');
    expect(html).toContain('Video 1');
    expect(html).toContain('1,420,500');
    expect(html).toContain('tabular-nums');
  });
});
