export async function logError(supabase, agencyId, pageId, reelId, message, phase = 'unknown', retryCount = 0) {
  console.error(`📝 Logging Error: ${message}`);
  return supabase.from('errors').insert({
    agency_id: agencyId,
    page_id: pageId,
    reel_id: reelId,
    error_message: message,
    error_phase: phase,
    retry_count: retryCount,
  });
}
