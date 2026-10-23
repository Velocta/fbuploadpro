/**
 * tokens:build — regenerate src/styles/tokens.generated.css and
 * src/lib/theme.ts from the DTCG token source in apps/web/tokens/.
 * Usage: pnpm --filter @fbuploadpro/web tokens:build
 */
import StyleDictionary from 'style-dictionary';
import console from 'node:console';
import { makeTokenConfig, defaultDestinations } from './tokens.config.mjs';

const sd = new StyleDictionary(makeTokenConfig(defaultDestinations));
await sd.buildAllPlatforms();
console.log('Tokens built from apps/web/tokens/ ->');
console.log(`  ${defaultDestinations.cssDestination}`);
console.log(`  ${defaultDestinations.tsDestination}`);
