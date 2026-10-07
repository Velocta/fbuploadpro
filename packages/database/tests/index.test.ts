import { describe, it, expect } from 'vitest';
import { DATABASE_VERSION } from '../src/index.js';

describe('Database Substrate Package', () => {
  it('exports DATABASE_VERSION constant', () => {
    expect(DATABASE_VERSION).toBe('0.1.0');
  });
});
