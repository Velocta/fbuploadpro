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
        { data: aduPages },
        { data: inappPages },
        { count: activeAduPagesCount },
        { count: activeInappPagesCount },
        { data: tokensUsedTodayRaw, error: tokensUsedError },
    ] = await Promise.all([
        supabase.from('users').select('id,name,email,tokens_balance,is_active_override,created_at').eq('role', 'agency'),
        supabase.from('pages').select('id,agency_id,page_name,status,sync_status,source_platform,followers_count'),
        supabase.from('facebook_inapp_schedule_pages').select('id,agency_id,fb_page_name,status,followers_count'),
        supabase
            .from('pages')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
        supabase
            .from('facebook_inapp_schedule_pages')
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

    const mappedInappPages = (inappPages || []).map((p) => ({
        id: p.id,
        agency_id: p.agency_id,
        page_name: p.fb_page_name || 'InApp Scheduled Page',
        status: p.status,
        sync_status: null,
        source_platform: null,
        followers_count: p.followers_count ? Number(p.followers_count) : null,
    }))

    const combinedPages = [
        ...(aduPages || []),
        ...mappedInappPages,
    ]

    const activePagesCount = (activeAduPagesCount || 0) + (activeInappPagesCount || 0)

    const initialData = {
        agencies: agencies || [],
        pages: combinedPages,
        activePagesCount,
        tokensUsedToday,
    }

    return <SuperAdminDashboardClient initialData={initialData} />
}
