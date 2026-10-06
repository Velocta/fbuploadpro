import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Legacy endpoint retained for backward compatibility.
  return NextResponse.redirect(new URL('/api/v1/agency/usage/export.csv', request.url), 307)
}
