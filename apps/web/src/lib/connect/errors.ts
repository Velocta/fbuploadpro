/**
 * Plain-language connect-flow errors (Spec 123, Part C).
 *
 * User-facing copy only: no protocol or implementation terms ever appear in
 * these messages (repo ux-writing rule). Internal codes stay in URLs and
 * logs; people see the sentences below.
 */

export type ConnectNoticeCode =
  | 'denied'
  | 'missing_reply'
  | 'expired_link'
  | 'connect_failed'
  | 'nothing_found'
  | 'credentials_required';

export const CONNECT_NOTICE_MESSAGES: Record<ConnectNoticeCode, string> = {
  denied: 'Connection canceled. No changes were made.',
  missing_reply:
    "We didn't hear back from the platform. Please try connecting again.",
  expired_link:
    'This connection link has expired. Please start again from Accounts.',
  connect_failed:
    "Couldn't finish connecting your account. Please try again.",
  nothing_found:
    'Nothing was found to add for this account. Check you signed in with the right account and try again.',
  credentials_required:
    'Add your app details in Settings first, then come back to connect.',
};

export function connectNoticeMessage(code: string | null | undefined): string {
  if (code && code in CONNECT_NOTICE_MESSAGES) {
    return CONNECT_NOTICE_MESSAGES[code as ConnectNoticeCode];
  }
  return CONNECT_NOTICE_MESSAGES.connect_failed;
}

/** Maps a platform's denial signal to our plain-language notice code. */
export function mapProviderDenial(errorParam: string | null): ConnectNoticeCode {
  if (
    errorParam === 'access_denied' ||
    errorParam === 'user_cancelled' ||
    errorParam === 'user_denied'
  ) {
    return 'denied';
  }
  return 'connect_failed';
}
