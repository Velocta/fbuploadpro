import { NextResponse } from 'next/server'
import { listAduReels } from '@/server/services/facebook/adu-reels-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const view = url.searchParams.get('view') === 'history' ? 'history' : 'queue'
    const reels = await listAduReels(id, view)
    return NextResponse.json({ reels })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load reels'
    const status = message === 'Unauthorized' ? 401 : message === 'Page not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
