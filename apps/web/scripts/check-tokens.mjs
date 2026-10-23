/**
 * tokens:check — CI parity gate (spec 129 §5.2). Regenerates both token
 * outputs into a temp directory and fails if they differ from the committed
 * generated files by even one byte. Drift becomes a red build.
 * Usage: pnpm --filter @fbuploadpro/web tokens:check
 */
import StyleDictionary from 'style-dictionary';
import console from 'node:console';
import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTokenConfig, defaultDestinations } from './tokens.config.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbu-tokens-check-'));
try {
  const destinations = {
    cssDestination: path.join(tmpDir, 'tokens.generated.css'),
    tsDestination: path.join(tmpDir, 'theme.ts'),
  };
  const sd = new StyleDictionary(makeTokenConfig(destinations));
  await sd.buildAllPlatforms();

  const pairs = [
    [destinations.cssDestination, defaultDestinations.cssDestination],
    [destinations.tsDestination, defaultDestinations.tsDestination],
  ];

  let failed = false;
  for (const [generated, committed] of pairs) {
    const generatedContent = fs.readFileSync(generated, 'utf-8');
    if (!fs.existsSync(committed)) {
      console.error(`tokens:check FAILED — missing committed file: ${committed}`);
      failed = true;
      continue;
    }
    const committedContent = fs.readFileSync(committed, 'utf-8');
    if (generatedContent !== committedContent) {
      console.error(`tokens:check FAILED — ${committed} is out of date.`);
      console.error('Run: pnpm --filter @fbuploadpro/web tokens:build');
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('tokens:check OK — generated outputs match apps/web/tokens/ source.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
