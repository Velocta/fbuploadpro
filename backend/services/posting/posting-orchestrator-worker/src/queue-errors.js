export function isTerminalQueueError(error) {
    const msg = String(error?.message || '');
    const lower = msg.toLowerCase();
    if (msg.startsWith('invalid_job_payload')) return true;
    if (msg.startsWith('state_conflict')) return true;
    if (msg.includes('no_pending_reel')) return true;
    if (msg.includes('queue_retries_exhausted')) return true;
    if (lower.includes('confirm your identity')) return true;
    if (lower.includes('subject does not have permission to post videos')) return true;
    if (lower.includes('limited access to the site')) return true;
    if (msg.includes('OAuthException') && (msg.includes('"code":190') || msg.includes('"code": 190'))) {
        return true;
    }
    if (msg.includes('failed after')) return true;
    return false;
}

export function classifyErrorCode(error) {
    const msg = String(error?.message || '');
    const lower = msg.toLowerCase();
    if (msg.startsWith('invalid_job_payload')) return 'invalid_job_payload';
    if (msg.startsWith('state_conflict')) return 'state_conflict';
    if (msg.includes('no_pending_reel')) return 'no_pending_reel';
    if (msg.includes('queue_retries_exhausted')) return 'queue_retries_exhausted';
    if (lower.includes('confirm your identity')) return 'facebook_verification_required';
    if (lower.includes('subject does not have permission to post videos')) return 'facebook_permission_denied';
    if (lower.includes('limited access to the site')) return 'facebook_account_limited';
    if (msg.includes('OAuthException') && (msg.includes('"code":190') || msg.includes('"code": 190'))) {
        return 'facebook_auth_invalid';
    }
    if (msg.includes('Download failed after')) return 'download_transient_exhausted';
    if (msg.includes('Upload failed after')) return 'facebook_transient_exhausted';
    if (msg.includes('facebook_publish_unsuccessful')) return 'facebook_transient_exhausted';
    return 'orchestrator_error';
}
