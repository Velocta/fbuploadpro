import { NextResponse, type NextRequest } from 'next/server';
import { parseCspReports } from '@/lib/csp';

const MAX_BODY_BYTES = 64 * 1024;

// Unauthenticated by design: browsers send CSP violation reports without
// credentials. Submitted data is only logged server-side (normalized) and
// is never reflected in the response.
export async function POST(request: NextRequest) {
  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  for (const report of parseCspReports(parsed)) {
    console.warn('[csp-report]', JSON.stringify(report));
  }

  return new NextResponse(null, { status: 204 });
}
