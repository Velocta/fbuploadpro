import { createClient } from '@/lib/supabase/server'
import { SuperAdminDashboardClient } from './super-admin-dashboard-client'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/server'

function getStartOfPktDayUtc() {
    // Start of current calendar day in Pakistan (UTC+5, no DST)
    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
    const pktWallClockAsUtc = new Date(Date.now() + PKT_OFFSET_MS)
    const y = pktWallClockAsUtc.getUTCFullYear()
    const m = pktWallClockAsUtc.getUTCMonth()
    const d = pktWallClockAsUtc.getUTCDate()
    return new Date(Date.UTC(y, m, d) - PKT_OFFSET_MS)
}

export async function SuperAdminOverviewContent() {
    const user = await getSessionUser()
    if (!user) {
        redirect('/login')
    }

    const supabase = await createClient()

    const startOfPktDayUtc = getStartOfPktDayUtc()

    const [
        { data: agencies },
        { data: stats },
        { data: tokensUsedTodayRaw, error: tokensUsedError },
    ] = await Promise.all([
        supabase.from('users').select('id,name,email,tokens_balance,is_active_override,created_at').eq('role', 'agency'),
        supabase.from('agency_page_stats' as any).select('adu_active_pages,inapp_active_pages') as any,
        supabase.rpc('get_tokens_used_since', {
            p_since: startOfPktDayUtc.toISOString(),
        }),
    ])

    if (tokensUsedError) {
        throw new Error(tokensUsedError.message)
    }

    const tokensUsedToday =
        typeof tokensUsedTodayRaw === 'string'
            ? Number(tokensUsedTodayRaw)
            : Number(tokensUsedTodayRaw ?? 0)

    const activePagesCount = ((stats as any) || []).reduce(
        (sum: number, s: any) => sum + (s.adu_active_pages ?? 0) + (s.inapp_active_pages ?? 0),
        0
    )

    const initialData = {
        agencies: agencies || [],
        pages: [], // Unused in SuperAdminDashboardClient
        activePagesCount,
        tokensUsedToday,
    }

    return <SuperAdminDashboardClient initialData={initialData} />
}
