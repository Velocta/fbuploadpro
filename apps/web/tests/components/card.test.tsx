import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../src/components/ui/card';

describe('Card Component Suite', () => {
  it('renders card container with hairline border and modular subcomponents', () => {
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>Daily performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div>Metric content</div>
        </CardContent>
        <CardFooter>
          <button type="button">Refresh</button>
        </CardFooter>
      </Card>
    );

    expect(html).toContain('fbu-card');
    expect(html).toContain('Analytics Overview');
    expect(html).toContain('Daily performance metrics');
    expect(html).toContain('Metric content');
    expect(html).toContain('Refresh');
    expect(html).toContain('border:1px solid var(--border-subtle)');
  });
});
