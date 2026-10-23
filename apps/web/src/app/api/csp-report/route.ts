import { NextResponse, type NextRequest } from 'next/server';
import { parseCspReports } from '@/lib/csp';
import { enforceIpRateLimit } from '@/lib/request-body';

const MAX_BODY_BYTES = 64 * 1024;

// Reads the request body as a stream and stops as soon as the cap is
// exceeded, so an oversized report body is never buffered in full.
// Returns null when the body exceeds MAX_BODY_BYTES.
async function readBodyWithCap(request: NextRequest): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

// Unauthenticated by design: browsers send CSP violation reports without
// credentials. Submitted data is only logged server-side (normalized) and
// is never reflected in the response.
export async function POST(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, 'csp_report', 120);
  if (limited) return limited;

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  const text = await readBodyWithCap(request);
  if (text === null) {
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
