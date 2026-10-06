import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import {
  deleteInappSchedulePage,
  listInappSchedulePages,
  upsertInappSchedulePage,
} from '@/server/services/facebook/inapp-schedule-service'
import { parse, format } from 'date-fns'
import { sanitizeToUtcHHMM } from '@/lib/posting-times'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const pages = await listInappSchedulePages(auth.user.id)
    return NextResponse.json({ pages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list pages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    
    const rawPostingTimes = Array.isArray(body.postingTimes) ? body.postingTimes : undefined
    const postingTimes = rawPostingTimes?.map((timeStr: string) => {
      try {
        if (/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
          return timeStr
        }
        const date = parse(timeStr, 'hh:mm a', new Date())
        return format(date, 'HH:mm')
      } catch {
        return sanitizeToUtcHHMM(timeStr)
      }
    })

    const page = await upsertInappSchedulePage(auth.user.id, {
      facebookAccountId: String(body.facebookAccountId || ''),
      fbPageId: String(body.fbPageId || ''),
      fbPageName: String(body.fbPageName || ''),
      fbPageImage: body.fbPageImage,
      fbPageAccessToken: String(body.fbPageAccessToken || ''),
      followersCount: body.followersCount !== undefined ? Number(body.followersCount) : undefined,
      postsPerDay: body.postsPerDay !== undefined ? Number(body.postsPerDay) : undefined,
      postingTimes: postingTimes,
      scheduleTimezone: body.scheduleTimezone ? String(body.scheduleTimezone) : undefined,
    })
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await deleteInappSchedulePage(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
