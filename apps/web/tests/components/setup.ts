/**
 * @file setup.ts
 * @description React 19 / Node-compatible test helpers using renderToStaticMarkup.
 * Zero external DOM dependency (no jsdom / happy-dom needed).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface RenderResult {
  /** The full static HTML string output */
  html: string;
  /** Whether the rendered markup contains the specified text */
  hasText: (text: string) => boolean;
  /** Check if any element has an attribute with optional matching value */
  hasAttribute: (name: string, value?: string | RegExp) => boolean;
  /** Get the value of the first matching attribute */
  getAttribute: (name: string) => string | null;
  /** Check if a class exists anywhere in the rendered markup */
  hasClass: (className: string) => boolean;
  /** Check if a specific HTML tag exists */
  hasTag: (tagName: string) => boolean;
  /** Check if role attribute matches */
  findByRole: (role: string) => boolean;
  /** Check aria-* attribute */
  hasAria: (ariaName: string, value?: string | boolean) => boolean;
  /** Check inline style property */
  hasStyle: (property: string, value?: string | RegExp) => boolean;
  /** Find all elements matching tag name */
  findTags: (tagName: string) => Array<{
    outerHtml: string;
    attributes: Record<string, string>;
    innerHTML: string;
  }>;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attrString)) !== null) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

export function render(ui: React.ReactElement): RenderResult {
  const html = renderToStaticMarkup(ui);

  return {
    html,
    hasText: (text: string) => html.includes(text),
    hasAttribute: (name: string, value?: string | RegExp) => {
      if (value === undefined) {
        // Boolean or valued attribute presence
        const regex = new RegExp(`[\\s<]${escapeRegex(name)}(?:=|[\\s/>])`, 'i');
        return regex.test(html);
      }
      if (value instanceof RegExp) {
        const regex = new RegExp(`[\\s<]${escapeRegex(name)}=["']([^"']*)["']`, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
          if (value.test(match[1])) return true;
        }
        return false;
      }
      const regex = new RegExp(`[\\s<]${escapeRegex(name)}=["']${escapeRegex(value)}["']`, 'i');
      return regex.test(html);
    },
    getAttribute: (name: string) => {
      const match = html.match(new RegExp(`[\\s<]${escapeRegex(name)}=["']([^"']*)["']`, 'i'));
      if (match) return match[1];
      // Check boolean attribute
      if (new RegExp(`[\\s<]${escapeRegex(name)}(?=[\\s/>])`, 'i').test(html)) {
        return '';
      }
      return null;
    },
    hasClass: (className: string) => {
      const regex = /class=["']([^"']*)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const classes = match[1].split(/\s+/);
        if (classes.includes(className)) return true;
      }
      return false;
    },
    hasTag: (tagName: string) => {
      return new RegExp(`<${escapeRegex(tagName)}(?:\\s|>|/)`, 'i').test(html);
    },
    findByRole: (role: string) => {
      return new RegExp(`role=["']${escapeRegex(role)}["']`, 'i').test(html);
    },
    hasAria: (ariaName: string, value?: string | boolean) => {
      const fullAria = ariaName.startsWith('aria-') ? ariaName : `aria-${ariaName}`;
      if (value === undefined) {
        return new RegExp(`[\\s<]${escapeRegex(fullAria)}(?:=|[\\s/>])`, 'i').test(html);
      }
      return new RegExp(`[\\s<]${escapeRegex(fullAria)}=["']${escapeRegex(String(value))}["']`, 'i').test(html);
    },
    hasStyle: (property: string, value?: string | RegExp) => {
      const regex = /style=["']([^"']*)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const styleStr = match[1];
        if (value === undefined) {
          if (new RegExp(`(^|;)\\s*${escapeRegex(property)}\\s*:`, 'i').test(styleStr)) return true;
        } else if (value instanceof RegExp) {
          const propMatch = styleStr.match(new RegExp(`(?:^|;)\\s*${escapeRegex(property)}\\s*:\\s*([^;]+)`, 'i'));
          if (propMatch && value.test(propMatch[1])) return true;
        } else {
          const propMatch = styleStr.match(new RegExp(`(?:^|;)\\s*${escapeRegex(property)}\\s*:\\s*([^;]+)`, 'i'));
          if (propMatch && propMatch[1].trim().toLowerCase() === value.trim().toLowerCase()) return true;
        }
      }
      return false;
    },
    findTags: (tagName: string) => {
      const results: Array<{ outerHtml: string; attributes: Record<string, string>; innerHTML: string }> = [];
      const regex = new RegExp(`<${escapeRegex(tagName)}\\b([^>]*)>(.*?)</${escapeRegex(tagName)}>`, 'gis');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        results.push({
          outerHtml: match[0],
          attributes: parseAttributes(match[1]),
          innerHTML: match[2],
        });
      }
      // Also match self-closing tags
      const selfClosingRegex = new RegExp(`<${escapeRegex(tagName)}\\b([^>]*)/?>`, 'gi');
      while ((match = selfClosingRegex.exec(html)) !== null) {
        // avoid duplicating if already matched
        if (!results.some((r) => r.outerHtml.startsWith(match![0]))) {
          results.push({
            outerHtml: match[0],
            attributes: parseAttributes(match[1]),
            innerHTML: '',
          });
        }
      }
      return results;
    },
  };
}
