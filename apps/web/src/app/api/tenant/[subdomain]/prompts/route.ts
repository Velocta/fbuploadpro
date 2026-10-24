import { type NextRequest, NextResponse } from 'next/server';
import {
  CURATED_PROMPTS,
  CreatePromptRequestSchema,
  PROMPT_PERSONAL_CAP,
  PromptListResponseSchema,
  PromptResponseSchema,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import {
  authenticateTenantRoute,
  getRouteSupabase,
  isLegacyClient,
} from '@/lib/route-auth';
import { readJsonBody } from '@/lib/request-body';
import { logServerError } from '@/lib/server-analytics';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/tenant/[subdomain]/prompts — the Prompt Library list (spec 144).
 *
 * Returns the curated set (in-code data, identical for everyone) plus the
 * signed-in user's own prompts (OD-144-1: per-USER, global across
 * workspaces — the query filters on the session user only, never on the
 * workspace). Personal rows are bounded (spec 139: no unbounded SELECT).
 */
export async function handleListPrompts(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRoute(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const { session } = auth;

  let personalRows: Array<Record<string, unknown>>;

  if (isLegacyClient(dbClient)) {
    personalRows = (await dbClient.query(
      `SELECT id, user_id, title, body, category, created_at, updated_at
       FROM user_prompts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1000`,
      [session.userId]
    )) as Array<Record<string, unknown>>;
  } else {
    const supabase = getRouteSupabase(dbClient);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database service unavailable' },
        { status: 500 }
      );
    }
    const { data, error } = await supabase
      .from('user_prompts')
      .select('id, user_id, title, body, category, created_at, updated_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      logServerError('[prompts] Failed to list personal prompts', error, {
        source: 'prompts',
        subdomain,
      });
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to list prompts' },
        { status: 500 }
      );
    }
    personalRows = (data || []) as Array<Record<string, unknown>>;
  }

  const personal = personalRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    category: row.category,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }));

  const responsePayload = PromptListResponseSchema.parse({
    curated: CURATED_PROMPTS,
    personal,
  });

  return NextResponse.json(responsePayload);
}

/**
 * POST /api/tenant/[subdomain]/prompts — create a personal prompt.
 *
 * The owner is always the session user — never taken from the body.
 * At the 200-prompt cap (OD-144-7) the request is rejected with 409
 * PROMPT_LIMIT_REACHED (a state conflict, not a rate limit).
 */
export async function handleCreatePrompt(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRoute(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const { session } = auth;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = CreatePromptRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (isLegacyClient(dbClient)) {
    try {
      const countRows = (await dbClient.query(
        `SELECT COUNT(*)::int AS prompt_count FROM user_prompts WHERE user_id = $1`,
        [session.userId]
      )) as Array<Record<string, unknown>>;
      const count = Number(countRows[0]?.prompt_count ?? 0);
      if (count >= PROMPT_PERSONAL_CAP) {
        return NextResponse.json(
          {
            error: 'PROMPT_LIMIT_REACHED',
            message: 'You have reached the limit of 200 saved prompts. Delete one to add another.',
          },
          { status: 409 }
        );
      }

      const rows = (await dbClient.query(
        `INSERT INTO user_prompts (user_id, title, body, category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
         RETURNING id, user_id, title, body, category, created_at, updated_at`,
        [session.userId, parsed.data.title, parsed.data.body, parsed.data.category]
      )) as Array<Record<string, unknown>>;
      const row = rows[0];
      if (!row) {
        throw new Error('Prompt insert returned no row');
      }

      const responsePayload = PromptResponseSchema.parse({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        category: row.category,
        createdAt: new Date(row.created_at as string).toISOString(),
        updatedAt: new Date(row.updated_at as string).toISOString(),
      });
      return NextResponse.json(responsePayload, { status: 201 });
    } catch (err) {
      logServerError('[prompts] Failed to create prompt', err, {
        source: 'prompts',
        subdomain,
      });
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create prompt' },
        { status: 500 }
      );
    }
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 500 }
    );
  }

  try {
    const { count, error: countErr } = await supabase
      .from('user_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.userId);
    if (countErr) {
      throw countErr;
    }
    if ((count ?? 0) >= PROMPT_PERSONAL_CAP) {
      return NextResponse.json(
        {
          error: 'PROMPT_LIMIT_REACHED',
          message: 'You have reached the limit of 200 saved prompts. Delete one to add another.',
        },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('user_prompts')
      .insert({
        user_id: session.userId,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category,
      })
      .select('id, user_id, title, body, category, created_at, updated_at')
      .single();
    if (insertErr || !inserted) {
      throw insertErr ?? new Error('Prompt insert returned no row');
    }

    const responsePayload = PromptResponseSchema.parse({
      id: inserted.id,
      userId: inserted.user_id,
      title: inserted.title,
      body: inserted.body,
      category: inserted.category,
      createdAt: new Date(inserted.created_at).toISOString(),
      updatedAt: new Date(inserted.updated_at).toISOString(),
    });
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    logServerError('[prompts] Failed to create prompt', err, {
      source: 'prompts',
      subdomain,
    });
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListPrompts(request, subdomain);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleCreatePrompt(request, subdomain);
}
