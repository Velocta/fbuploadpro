import { createClient } from '@/lib/supabase/server'
import { SuperAdminDashboardClient } from './super-admin-dashboard-client'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/server'

export async function SuperAdminOverviewContent() {
    const user = await getSessionUser()
    if (!user) {
        redirect('/login')
    }

    const supabase = await createClient()

    // Start of current calendar day in Pakistan (UTC+5, no DST)
    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
    const pktWallClockAsUtc = new Date(Date.now() + PKT_OFFSET_MS)
    const y = pktWallClockAsUtc.getUTCFullYear()
    const m = pktWallClockAsUtc.getUTCMonth()
    const d = pktWallClockAsUtc.getUTCDate()
    const startOfPktDayUtc = new Date(Date.UTC(y, m, d) - PKT_OFFSET_MS)

    const [
        { data: agencies },
        { data: pages },
        { count: activePagesCount },
        { data: tokensUsedTodayRaw, error: tokensUsedError },
    ] = await Promise.all([
        supabase.from('users').select('id,name,email,tokens_balance,is_active_override,created_at').eq('role', 'agency'),
        supabase.from('pages').select('id,agency_id,page_name,status,sync_status,source_platform,followers_count'),
        supabase
            .from('pages')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
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

    const initialData = {
        agencies: agencies || [],
        pages: pages || [],
        activePagesCount: activePagesCount || 0,
        tokensUsedToday,
    }

    return <SuperAdminDashboardClient initialData={initialData} />
}
