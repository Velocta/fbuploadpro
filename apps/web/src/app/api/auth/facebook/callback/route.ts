import { type NextRequest, NextResponse } from 'next/server';
import {
  buildTenantUrl,
  decryptToken,
  encryptToken,
  FacebookTokenExchangeResponseSchema,
  type FacebookUserProfileResponse,
  FacebookUserProfileResponseSchema,
  getSessionSecret,
  getTokenEncryptionKey,
  type OAuthStatePayload,
  verifyOAuthState,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

async function resolveOAuthErrorTarget(
  requestUrl: string,
  state: string | null,
  sessionSecret: string,
  rootDomain: string,
  error: string,
  errorDescription: string | null
): Promise<URL> {
  let target = new URL('/accounts', requestUrl);
  if (state) {
    try {
      const statePayload = await verifyOAuthState(state, sessionSecret);
      if (statePayload.isMagic) {
        const magicErrorUrl = new URL('/connect/facebook/error', requestUrl);
        const isCancelled =
          error === 'access_denied' || error === 'user_cancelled';
        magicErrorUrl.searchParams.set(
          'reason',
          isCancelled ? 'cancelled' : 'oauth_failed'
        );
        return magicErrorUrl;
      }
      target = buildTenantUrl(
        statePayload.tenantSubdomain,
        '/accounts',
        requestUrl,
        rootDomain
      );
    } catch (_e) {
      // Fallback to /accounts if state cannot be verified
    }
  }
  target.searchParams.set('error', error);
  if (errorDescription) {
    target.searchParams.set('error_description', errorDescription);
  }
  return target;
}

function buildOAuthStepErrorRedirect(
  requestUrl: string,
  destinationUrl: URL,
  isMagic: boolean | undefined,
  errorCode: string
): NextResponse {
  if (isMagic) {
    const magicErrorUrl = new URL('/connect/facebook/error', requestUrl);
    magicErrorUrl.searchParams.set('reason', 'oauth_failed');
    return NextResponse.redirect(magicErrorUrl);
  }
  destinationUrl.searchParams.set('error', errorCode);
  return NextResponse.redirect(destinationUrl);
}

async function fetchGraphPageTokenMap(
  longAccessToken: string
): Promise<Map<string, string>> {
  const tokenMap = new Map<string, string>();
  const pagesUrl = new URL('https://graph.facebook.com/v26.0/me/accounts');
  pagesUrl.searchParams.set('fields', 'id,access_token');

  const pagesRes = await fetch(pagesUrl.toString(), {
    headers: {
      Authorization: `Bearer ${longAccessToken}`,
    },
  });
  if (!pagesRes.ok) {
    return tokenMap;
  }

  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  } | null;
  const data = Array.isArray(pagesJson?.data) ? pagesJson.data : [];
  for (const item of data) {
    if (
      typeof item?.id === 'string' &&
      item.id &&
      typeof item?.access_token === 'string' &&
      item.access_token
    ) {
      tokenMap.set(item.id, item.access_token);
    }
  }
  return tokenMap;
}

export async function refreshConnectedPageTokens(
  db: DatabaseClient | SupabaseClient<any> | null | undefined,
  userId: string,
  accountRowId: string,
  longAccessToken: string,
  expiresAt: Date,
  encryptionKey: string
): Promise<void> {
  const supabase =
    db && 'from' in db
      ? (db as SupabaseClient<any>)
      : !db || !('query' in db)
        ? getSupabaseClient()
        : null;
  const legacyDb = db && 'query' in db && typeof db.query === 'function' ? db : null;
  try {
    let validPages: Array<{ id: string; fb_page_id?: string; fbPageId?: string; status?: string }> = [];

    if (supabase) {
      const { data: linkedPages, error: fetchPagesError } = await supabase
        .from('facebook_pages')
        .select('id, fb_page_id, status')
        .eq('facebook_account_id', accountRowId)
        .eq('user_id', userId)
        .neq('status', 'disconnected');

      if (fetchPagesError) {
        console.warn(
          '[FacebookOAuth] Failed to fetch linked pages:',
          fetchPagesError.message
        );
      }

      validPages = Array.isArray(linkedPages)
        ? (linkedPages.filter((p) => Boolean(p?.fb_page_id)) as any[])
        : [];
    } else if (legacyDb) {
      const linkedPages = (await legacyDb.query(
        `SELECT id, fb_page_id, status
         FROM facebook_pages
         WHERE facebook_account_id = $1
           AND user_id = $2
           AND status != 'disconnected'`,
        [accountRowId, userId]
      )) as Array<{ id: string; fb_page_id?: string; fbPageId?: string; status?: string }>;

      validPages = Array.isArray(linkedPages)
        ? linkedPages.filter((p) => Boolean(p?.fb_page_id || p?.fbPageId))
        : [];
    }

    if (validPages.length === 0) {
      return;
    }

    const tokenMap = await fetchGraphPageTokenMap(longAccessToken);
    if (tokenMap.size === 0) {
      return;
    }

    await Promise.all(
      validPages.map(async (linkedPage) => {
        const fbPageId = linkedPage.fb_page_id ?? linkedPage.fbPageId ?? '';
        const rawPageToken = tokenMap.get(fbPageId);
        if (!rawPageToken) {
          return;
        }
        const encryptedPageToken = await encryptToken(rawPageToken, encryptionKey);
        if (supabase) {
          const { error: updateError } = await supabase
            .from('facebook_pages')
            .update({
              encrypted_access_token: encryptedPageToken,
              status: linkedPage.status === 'invalid_token' ? 'active' : linkedPage.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linkedPage.id)
            .eq('user_id', userId);

          if (updateError) {
            console.warn(
              '[FacebookOAuth] Failed to update facebook_page token:',
              updateError.message
            );
          }
        } else if (legacyDb) {
          await legacyDb.query(
            `UPDATE facebook_pages
             SET encrypted_access_token = $1,
                 status = CASE WHEN status = 'invalid_token' THEN 'active'::facebook_page_status ELSE status END,
                 updated_at = now()
             WHERE id = $2 AND user_id = $3`,
            [encryptedPageToken, linkedPage.id, userId]
          );
        }
      })
    );
  } catch (err) {
    console.warn(
      '[FacebookOAuth] Page token sync skipped:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

function buildPostConnectRedirect(
  requestUrl: string,
  destinationUrl: URL,
  statePayload: OAuthStatePayload,
  meProfile: { id: string; name: string },
  alreadyExisted: boolean
): NextResponse {
  const isReconnectMismatch = Boolean(
    statePayload.expectedFbAccountId &&
      meProfile.id !== statePayload.expectedFbAccountId
  );
  const isAlreadyConnected = Boolean(
    !statePayload.expectedFbAccountId && alreadyExisted
  );

  if (statePayload.isMagic) {
    const magicSuccessUrl = new URL('/connect/facebook/success', requestUrl);
    if (isReconnectMismatch) {
      magicSuccessUrl.searchParams.set('reconnected_mismatch', '1');
      magicSuccessUrl.searchParams.set('newAccountName', meProfile.name);
      magicSuccessUrl.searchParams.set(
        'expectedAccountName',
        statePayload.expectedDisplayName || ''
      );
    } else if (isAlreadyConnected) {
      magicSuccessUrl.searchParams.set('already_connected', '1');
      magicSuccessUrl.searchParams.set('accountName', meProfile.name);
    }
    return NextResponse.redirect(magicSuccessUrl);
  }

  if (isReconnectMismatch) {
    destinationUrl.searchParams.set('reconnected_mismatch', '1');
    destinationUrl.searchParams.set('newAccountName', meProfile.name);
    destinationUrl.searchParams.set(
      'expectedAccountName',
      statePayload.expectedDisplayName || 'the expired account'
    );
  } else if (isAlreadyConnected) {
    destinationUrl.searchParams.set('connected', 'already');
    destinationUrl.searchParams.set('accountName', meProfile.name);
  } else {
    destinationUrl.searchParams.set('connected', '1');
  }

  return NextResponse.redirect(destinationUrl);
}

function getCallbackEnvConfig() {
  const sessionSecret = getSessionSecret();
  const encryptionKey = getTokenEncryptionKey();
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appSecret = process.env.FACEBOOK_APP_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  return {
    sessionSecret,
    encryptionKey,
    appId,
    appSecret,
    rootDomain,
    redirectUri,
  };
}

async function resolveWorkspaceCredentials(
  db: DatabaseClient | SupabaseClient<any> | null | undefined,
  tenantSubdomain: string,
  encryptionKey: string,
  defaultAppId: string,
  defaultAppSecret: string
): Promise<{ appId: string; appSecret: string }> {
  const supabase =
    db && 'from' in db
      ? (db as SupabaseClient<any>)
      : !db || !('query' in db)
        ? getSupabaseClient()
        : null;
  const legacyDb = db && 'query' in db && typeof db.query === 'function' ? db : null;
  if (supabase) {
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('subdomain', tenantSubdomain)
        .maybeSingle();

      if (ws?.id) {
        const { data: creds } = await supabase
          .from('workspace_byoc_credentials')
          .select('fb_app_id, encrypted_fb_app_secret')
          .eq('workspace_id', ws.id)
          .maybeSingle();

        if (creds?.fb_app_id && creds?.encrypted_fb_app_secret) {
          const decryptedSecret = await decryptToken(creds.encrypted_fb_app_secret, encryptionKey);
          return { appId: creds.fb_app_id, appSecret: decryptedSecret };
        }
      }
    } catch (err) {
      console.warn('[FacebookOAuth] BYOC resolution error via Supabase:', err);
    }
  } else if (legacyDb) {
    try {
      const rows = (await legacyDb.query(
        `SELECT c.fb_app_id AS "fbAppId", c.encrypted_fb_app_secret AS "encryptedSecret"
         FROM workspace_byoc_credentials c
         JOIN workspaces w ON w.id = c.workspace_id
         WHERE w.subdomain = $1
         LIMIT 1`,
        [tenantSubdomain]
      )) as Array<{ fbAppId: string; encryptedSecret: string }>;

      const byoc = rows?.[0];
      if (byoc?.fbAppId && byoc.encryptedSecret) {
        const decryptedSecret = await decryptToken(byoc.encryptedSecret, encryptionKey);
        return { appId: byoc.fbAppId, appSecret: decryptedSecret };
      }
    } catch (err) {
      console.warn('[FacebookOAuth] BYOC resolution error in callback:', err);
    }
  }

  return { appId: defaultAppId, appSecret: defaultAppSecret };
}

async function upsertConnectedFacebookAccount(
  db: DatabaseClient | SupabaseClient<any> | null | undefined,
  userId: string,
  meProfile: FacebookUserProfileResponse,
  encryptedToken: string,
  expiresAt: Date
): Promise<{ accountRowId: string | undefined; alreadyExisted: boolean }> {
  const supabase =
    db && 'from' in db
      ? (db as SupabaseClient<any>)
      : !db || !('query' in db)
        ? getSupabaseClient()
        : null;
  const legacyDb = db && 'query' in db && typeof db.query === 'function' ? db : null;
  if (supabase) {
    const { data: existing } = await supabase
      .from('facebook_accounts')
      .select('id, status')
      .eq('user_id', userId)
      .eq('fb_account_id', meProfile.id)
      .maybeSingle();

    const alreadyExisted = Boolean(existing && typeof existing.status === 'string');
    const profilePictureUrl = meProfile.picture?.data?.url ?? null;
    const gender = meProfile.gender ?? null;
    const accountLink = meProfile.link ?? null;

    const { data: upserted } = await supabase
      .from('facebook_accounts')
      .upsert(
        {
          user_id: userId,
          fb_account_id: meProfile.id,
          display_name: meProfile.name,
          encrypted_access_token: encryptedToken,
          token_expires_at: expiresAt.toISOString(),
          profile_picture_url: profilePictureUrl,
          gender,
          account_link: accountLink,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,fb_account_id' }
      )
      .select('id')
      .single();

    const accountRowId = upserted?.id ?? existing?.id;
    return { accountRowId, alreadyExisted };
  }

  if (!legacyDb) {
    return { accountRowId: undefined, alreadyExisted: false };
  }
  const effectiveDb = legacyDb;
  const existingRows = (await effectiveDb.query(
    'SELECT id, status FROM facebook_accounts WHERE user_id = $1 AND fb_account_id = $2',
    [userId, meProfile.id]
  )) as Array<{ id: string; status?: string }>;
  const alreadyExisted =
    Array.isArray(existingRows) &&
    existingRows.some((row) => typeof row?.status === 'string');

  const profilePictureUrl = meProfile.picture?.data?.url ?? null;
  const gender = meProfile.gender ?? null;
  const accountLink = meProfile.link ?? null;

  const upsertRows = (await effectiveDb.query(
    `INSERT INTO facebook_accounts (
      user_id, fb_account_id, display_name, encrypted_access_token, token_expires_at, profile_picture_url, gender, account_link, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', now())
    ON CONFLICT (user_id, fb_account_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      encrypted_access_token = EXCLUDED.encrypted_access_token,
      token_expires_at = EXCLUDED.token_expires_at,
      profile_picture_url = EXCLUDED.profile_picture_url,
      gender = EXCLUDED.gender,
      account_link = EXCLUDED.account_link,
      status = 'active',
      updated_at = now()
    RETURNING id`,
    [
      userId,
      meProfile.id,
      meProfile.name,
      encryptedToken,
      expiresAt,
      profilePictureUrl,
      gender,
      accountLink,
    ]
  )) as Array<{ id: string }>;

  const accountRowId = upsertRows?.[0]?.id ?? existingRows?.[0]?.id;
  return { accountRowId, alreadyExisted };
}

export async function handleFacebookCallback(
  request: NextRequest,
  dbClient?: DatabaseClient | SupabaseClient<Database>
): Promise<NextResponse> {
  const {
    sessionSecret,
    encryptionKey,
    appId,
    appSecret,
    rootDomain,
    redirectUri,
  } = getCallbackEnvConfig();

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle upstream OAuth cancellation or error
  if (error) {
    const target = await resolveOAuthErrorTarget(
      request.url,
      state,
      sessionSecret,
      rootDomain,
      error,
      errorDescription
    );
    return NextResponse.redirect(target);
  }

  if (!code || !state) {
    const target = new URL('/accounts', request.url);
    target.searchParams.set('error', 'missing_code_or_state');
    return NextResponse.redirect(target);
  }

  // 1. Verify signed OAuth state
  let statePayload: OAuthStatePayload;
  try {
    statePayload = await verifyOAuthState(state, sessionSecret);
  } catch (_e) {
    const target = new URL('/accounts', request.url);
    target.searchParams.set('error', 'invalid_oauth_state');
    return NextResponse.redirect(target);
  }

  const { tenantSubdomain, userId } = statePayload;
  const destinationUrl = buildTenantUrl(
    tenantSubdomain,
    '/accounts',
    request.url,
    rootDomain
  );

  try {
    const db = dbClient ?? null;
    const { appId: effectiveAppId, appSecret: effectiveAppSecret } =
      await resolveWorkspaceCredentials(
        db,
        tenantSubdomain,
        encryptionKey,
        appId,
        appSecret
      );

    // 2. Exchange temporary code for short-lived token (Graph API v26.0)
    const codeExchangeUrl = new URL(
      'https://graph.facebook.com/v26.0/oauth/access_token'
    );
    codeExchangeUrl.searchParams.set('client_id', effectiveAppId);
    codeExchangeUrl.searchParams.set('client_secret', effectiveAppSecret);
    codeExchangeUrl.searchParams.set('redirect_uri', redirectUri);
    codeExchangeUrl.searchParams.set('code', code);

    const shortTokenRes = await fetch(codeExchangeUrl.toString(), {
      method: 'POST',
    });
    if (!shortTokenRes.ok) {
      return buildOAuthStepErrorRedirect(
        request.url,
        destinationUrl,
        statePayload.isMagic,
        'token_exchange_failed'
      );
    }
    const shortTokenJson = await shortTokenRes.json();
    const shortTokenData =
      FacebookTokenExchangeResponseSchema.parse(shortTokenJson);

    // 3. Exchange short-lived token for 60-day long-lived token
    const longTokenUrl = new URL(
      'https://graph.facebook.com/v26.0/oauth/access_token'
    );
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', effectiveAppId);
    longTokenUrl.searchParams.set('client_secret', effectiveAppSecret);
    longTokenUrl.searchParams.set(
      'fb_exchange_token',
      shortTokenData.access_token
    );

    const longTokenRes = await fetch(longTokenUrl.toString(), {
      method: 'GET',
    });
    if (!longTokenRes.ok) {
      return buildOAuthStepErrorRedirect(
        request.url,
        destinationUrl,
        statePayload.isMagic,
        'long_token_exchange_failed'
      );
    }
    const longTokenJson = await longTokenRes.json();
    const longTokenData =
      FacebookTokenExchangeResponseSchema.parse(longTokenJson);

    // 4. Fetch user profile from /me
    const meUrl = new URL('https://graph.facebook.com/v26.0/me');
    meUrl.searchParams.set('fields', 'id,name,gender,link,picture{url}');
    const meRes = await fetch(meUrl.toString(), {
      headers: {
        Authorization: `Bearer ${longTokenData.access_token}`,
      },
    });
    if (!meRes.ok) {
      return buildOAuthStepErrorRedirect(
        request.url,
        destinationUrl,
        statePayload.isMagic,
        'profile_fetch_failed'
      );
    }
    const meJson = await meRes.json();
    const meProfile = FacebookUserProfileResponseSchema.parse(meJson);

    // 5. Encrypt long-lived token using Web Crypto AES-256-GCM
    const encryptedToken = await encryptToken(
      longTokenData.access_token,
      encryptionKey
    );

    const expiresInSeconds = longTokenData.expires_in ?? 5184000; // ~60 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 6. Check existing & upsert into database
    const { accountRowId, alreadyExisted } =
      await upsertConnectedFacebookAccount(
        db,
        userId,
        meProfile,
        encryptedToken,
        expiresAt
      );

    if (accountRowId) {
      await refreshConnectedPageTokens(
        db,
        userId,
        accountRowId,
        longTokenData.access_token,
        expiresAt,
        encryptionKey
      );
    }

    return buildPostConnectRedirect(
      request.url,
      destinationUrl,
      statePayload,
      meProfile,
      alreadyExisted
    );
  } catch (err) {
    // Redirect to destination with safe generic error parameter rather than leaking internal details
    console.warn('[FacebookOAuth] Callback exchange error:', err instanceof Error ? err.message : String(err));
    if (statePayload?.isMagic) {
      const magicErrorUrl = new URL('/connect/facebook/error', request.url);
      magicErrorUrl.searchParams.set('reason', 'internal_oauth_error');
      return NextResponse.redirect(magicErrorUrl);
    }
    destinationUrl.searchParams.set('error', 'internal_oauth_error');
    return NextResponse.redirect(destinationUrl);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return await handleFacebookCallback(request);
}


