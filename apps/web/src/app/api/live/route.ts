import { NextResponse } from 'next/server';

/**
 * Liveness split (spec 116): static response with no dependencies.
 * Use /api/health for readiness (database, auth, config probes).
 */
export function GET() {
  return NextResponse.json(
    { status: 'ok' },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
