import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTiktokYtdlpArgs, TIKTOK_YTDLP_USER_AGENT } from './ytdlp-args.js';

const PROFILE_URL = 'https://www.tiktok.com/@user';

test('buildTiktokYtdlpArgs matches main-scraper flat-playlist flags', () => {
  const args = buildTiktokYtdlpArgs(PROFILE_URL, 500);
  assert.ok(args.includes('--flat-playlist'));
  assert.ok(args.includes('-J'));
  assert.ok(args.includes('--quiet'));
  assert.ok(args.includes('--no-check-certificates'));
  assert.equal(args.at(-1), PROFILE_URL);
});

test('buildTiktokYtdlpArgs sets playlist-items, impersonation, referer, and retries', () => {
  const args = buildTiktokYtdlpArgs(PROFILE_URL, 250);
  assert.ok(args.includes('--playlist-items'));
  assert.ok(args.includes('1:250'));
  assert.ok(args.includes('--impersonate'));
  assert.ok(args.includes('chrome'));
  assert.ok(args.includes('--add-header'));
  assert.ok(args.includes('Referer: https://www.tiktok.com/'));
  assert.ok(args.includes('--retries'));
  assert.ok(args.includes('3'));
  assert.ok(args.includes('--socket-timeout'));
  assert.ok(args.includes('30'));
});
