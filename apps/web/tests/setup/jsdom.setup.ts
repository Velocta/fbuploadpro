/**
 * @file jsdom.setup.ts
 * @description Setup for the jsdom Vitest project (spec 137-A3, T30):
 * jest-dom matchers, Testing Library cleanup between tests, and the DOM
 * shims Radix/Sonner need under jsdom (matchMedia, ResizeObserver,
 * pointer capture, scrollIntoView).
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ensureDomShims } from '../../src/components/shared/ui/test-utils';

ensureDomShims();

afterEach(() => {
  cleanup();
});
