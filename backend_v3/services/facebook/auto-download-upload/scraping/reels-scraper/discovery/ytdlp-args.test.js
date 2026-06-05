import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYtdlpFlatPlaylistArgs } from './ytdlp-args.js';

const BASE_CONFIG = {
  RETRIES: 1,
  EXTRACTOR_RETRIES: 3,
  SOCKET_TIMEOUT: 30,
  USER_AGENT: 'Mozilla/5.0 PuppeteerAutomation',
  COOKIES_FROM_BROWSER: 'chromium:/abs/.browser-profile',
  SLEEP_REQUESTS: 5,
  DOWNLOAD_ARCHIVE: '',
  YOUTUBE_PLAYER_CLIENT: '',
  YOUTUBE_PO_TOKEN: '',
};

test('buildYtdlpFlatPlaylistArgs includes flat-playlist JSON flags', () => {
  const args = buildYtdlpFlatPlaylistArgs(
    'tiktok',
    'https://www.tiktok.com/@user',
    BASE_CONFIG,
  );
  assert.ok(args.includes('--flat-playlist'));
  assert.ok(args.includes('-J'));
  assert.equal(args.at(-1), 'https://www.tiktok.com/@user');
});

test('buildYtdlpFlatPlaylistArgs uses automation browser cookies and UA', () => {
  const args = buildYtdlpFlatPlaylistArgs('tiktok', 'https://www.tiktok.com/@user', BASE_CONFIG);
  assert.ok(args.includes('--user-agent'));
  assert.ok(args.includes('Mozilla/5.0 PuppeteerAutomation'));
  assert.ok(args.includes('--cookies-from-browser'));
  assert.ok(args.includes('chromium:/abs/.browser-profile'));
  assert.ok(args.includes('Referer:https://www.tiktok.com/'));
});

test('buildYtdlpFlatPlaylistArgs applies youtube extractor args without proxy', () => {
  const args = buildYtdlpFlatPlaylistArgs('youtube', 'https://www.youtube.com/@u/shorts', {
    ...BASE_CONFIG,
    YOUTUBE_PLAYER_CLIENT: 'mweb',
    YOUTUBE_PO_TOKEN: 'web.gvs+TOKEN',
  });
  assert.equal(args.includes('--proxy'), false);
  assert.ok(args.includes('--extractor-args'));
  assert.ok(args.includes('youtube:player_client=mweb;po_token=web.gvs+TOKEN'));
});
