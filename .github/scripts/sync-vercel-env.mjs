#!/usr/bin/env node

/**
 * Sync GitHub Secrets to Vercel Environment Variables
 *
 * This script runs in GitHub Actions to synchronize defined environment variables
 * directly into the linked Vercel project using Vercel REST API v10 with upsert=true.
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;

const isDryRun = process.argv.includes('--dry-run');

// Public, non-sensitive config. These values are embedded in client bundles
// anyway, so syncing them to preview deployments is harmless and keeps
// previews functional. Everything else is secret and production-only.
const PREVIEW_SAFE_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_MARKETING_URL',
  'NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER',
  'NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE',
  'NEXT_PUBLIC_SIGNUPS_ENABLED',
]);

const SYNC_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_MARKETING_URL',
  'SESSION_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER',
  'NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE',
  'NEXT_PUBLIC_SIGNUPS_ENABLED',
  'POSTHOG_KEY',
  'POSTHOG_HOST',
  // Spec 125: the web YouTube connect flow calls Post for Me server-side
  // with the same key the worker publishes with. Secret, production-only.
  'POST_FOR_ME_API_KEY',
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
];

async function run() {
  console.log('--- Vercel Environment Sync ---');

  if (!VERCEL_TOKEN) {
    console.error('❌ Error: Missing VERCEL_TOKEN environment variable in GitHub Secrets.');
    process.exit(1);
  }
  if (!VERCEL_PROJECT_ID) {
    console.error('❌ Error: Missing VERCEL_PROJECT_ID environment variable in GitHub Secrets.');
    process.exit(1);
  }

  console.log(`Target Project ID: ${VERCEL_PROJECT_ID}`);
  if (VERCEL_ORG_ID) {
    console.log(`Target Team / Org ID: ${VERCEL_ORG_ID}`);
  }
  if (isDryRun) {
    console.log('Mode: DRY RUN (no API calls will be made)');
  }

  let syncedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const key of SYNC_KEYS) {
    const val = process.env[key];

    if (!val || val.trim() === '') {
      console.log(`- Skipping ${key}: Not provided in environment.`);
      skippedCount++;
      continue;
    }

    const isPublicConfig = key.startsWith('NEXT_PUBLIC_');

    // Secrets are production-only. Syncing production secrets to preview
    // deployments would hand every PR preview build the prod keys.
    const targets = PREVIEW_SAFE_KEYS.has(key) ? ['production', 'preview'] : ['production'];
    const payload = {
      key,
      value: val,
      type: isPublicConfig ? 'plain' : 'sensitive',
      target: targets,
    };

    if (isDryRun) {
      console.log(`[DRY-RUN] Would upsert ${key} as ${payload.type} (targets: ${payload.target.join(', ')})`);
      syncedCount++;
      continue;
    }

    try {
      const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/env`);
      url.searchParams.set('upsert', 'true');
      if (VERCEL_ORG_ID) {
        url.searchParams.set('teamId', VERCEL_ORG_ID);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to upsert ${key} (HTTP ${response.status}): ${errorText}`);
        errorCount++;
      } else {
        console.log(`✅ Upserted ${key} successfully.`);
        syncedCount++;
      }
    } catch (err) {
      console.error(`❌ Network error while syncing ${key}:`, err);
      errorCount++;
    }
  }

  console.log('\n--- Sync Summary ---');
  console.log(`Upserted: ${syncedCount}`);
  console.log(`Skipped:  ${skippedCount}`);
  console.log(`Failed:   ${errorCount}`);

  if (errorCount > 0) {
    console.error('One or more environment variables failed to sync.');
    process.exit(1);
  }

  console.log('Vercel environment synchronization completed successfully.');
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
