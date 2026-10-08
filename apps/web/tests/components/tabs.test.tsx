import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../src/components/ui/tabs';

describe('Tabs Component Suite', () => {
  it('renders tablist and triggers with ARIA roles', () => {
    const html = renderToString(
      <Tabs value="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Overview</TabsTrigger>
          <TabsTrigger value="tab2">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Overview Panel Content</TabsContent>
        <TabsContent value="tab2">Settings Panel Content</TabsContent>
      </Tabs>
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Overview');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Overview Panel Content');
    expect(html).not.toContain('Settings Panel Content');
  });

  it('renders tabs using items configuration prop', () => {
    const items = [
      { id: 'first', label: 'First Tab', content: <div>First View</div> },
      { id: 'second', label: 'Second Tab', content: <div>Second View</div> },
    ];
    const html = renderToString(<Tabs value="first" items={items} />);
    expect(html).toContain('First Tab');
    expect(html).toContain('Second Tab');
    expect(html).toContain('First View');
  });
});
