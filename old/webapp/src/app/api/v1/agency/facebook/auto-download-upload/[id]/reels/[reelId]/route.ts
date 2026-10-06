import { NextResponse } from 'next/server'
import {
  deleteAduReel,
  skipAduReel,
  updateAduReelCaption,
} from '@/server/services/facebook/adu-reels-service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  try {
    const { id, reelId } = await params
    const body = await request.json()
    if (typeof body.caption !== 'string') {
      return NextResponse.json({ error: 'caption is required' }, { status: 400 })
    }
    await updateAduReelCaption(id, Number(reelId), body.caption)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update caption'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  try {
    const { id, reelId } = await params
    await deleteAduReel(id, Number(reelId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete reel'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  try {
    const { id, reelId } = await params
    const body = await request.json().catch(() => ({}))
    if (body.action === 'skip') {
      await skipAduReel(id, Number(reelId))
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update reel'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
