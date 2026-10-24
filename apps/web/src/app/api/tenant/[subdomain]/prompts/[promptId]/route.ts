import { type NextRequest, NextResponse } from 'next/server';
import {
  DeletePromptResponseSchema,
  PromptResponseSchema,
  UpdatePromptRequestSchema,
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
 * PATCH /api/tenant/[subdomain]/prompts/[promptId] — edit a personal prompt.
 *
 * Ownership rule (OD-144-1): the row must match BOTH the id AND the
 * session user. A foreign id returns 404 PROMPT_NOT_FOUND — never a
 * 403 that would confirm another user's row exists.
 */
export async function handleUpdatePrompt(
  request: NextRequest,
  subdomain: string,
  promptId: string,
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

  const parsed = UpdatePromptRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const notFound = NextResponse.json(
    { error: 'PROMPT_NOT_FOUND', message: 'Prompt not found' },
    { status: 404 }
  );

  if (isLegacyClient(dbClient)) {
    try {
      const setClauses: string[] = [];
      const params: unknown[] = [session.userId];
      let idx = 2;
      if (parsed.data.title !== undefined) {
        setClauses.push(`title = $${idx++}`);
        params.push(parsed.data.title);
      }
      if (parsed.data.body !== undefined) {
        setClauses.push(`body = $${idx++}`);
        params.push(parsed.data.body);
      }
      if (parsed.data.category !== undefined) {
        setClauses.push(`category = $${idx++}`);
        params.push(parsed.data.category);
      }
      setClauses.push('updated_at = now()');
      params.push(promptId);

      const rows = (await dbClient.query(
        `UPDATE user_prompts SET ${setClauses.join(', ')}
         WHERE user_id = $1 AND id = $${idx}
         RETURNING id, user_id, title, body, category, created_at, updated_at`,
        params
      )) as Array<Record<string, unknown>>;
      const row = rows[0];
      if (!row) return notFound;

      const responsePayload = PromptResponseSchema.parse({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        category: row.category,
        createdAt: new Date(row.created_at as string).toISOString(),
        updatedAt: new Date(row.updated_at as string).toISOString(),
      });
      return NextResponse.json(responsePayload);
    } catch (err) {
      logServerError('[prompts] Failed to update prompt', err, {
        source: 'prompts',
        subdomain,
      });
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to update prompt' },
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
    const { data: updated, error: updateErr } = await supabase
      .from('user_prompts')
      .update({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId)
      .eq('user_id', session.userId)
      .select('id, user_id, title, body, category, created_at, updated_at')
      .single();
    if (updateErr || !updated) {
      if (updateErr && updateErr.code !== 'PGRST116') {
        throw updateErr;
      }
      return notFound;
    }

    const responsePayload = PromptResponseSchema.parse({
      id: updated.id,
      userId: updated.user_id,
      title: updated.title,
      body: updated.body,
      category: updated.category,
      createdAt: new Date(updated.created_at).toISOString(),
      updatedAt: new Date(updated.updated_at).toISOString(),
    });
    return NextResponse.json(responsePayload);
  } catch (err) {
    logServerError('[prompts] Failed to update prompt', err, {
      source: 'prompts',
      subdomain,
    });
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenant/[subdomain]/prompts/[promptId] — delete a personal prompt.
 * Same ownership rule as PATCH: foreign ids return 404, never 403.
 */
export async function handleDeletePrompt(
  request: NextRequest,
  subdomain: string,
  promptId: string,
  dbClient?: DatabaseClient | SupabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRoute(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const { session } = auth;

  const notFound = NextResponse.json(
    { error: 'PROMPT_NOT_FOUND', message: 'Prompt not found' },
    { status: 404 }
  );

  if (isLegacyClient(dbClient)) {
    try {
      const rows = (await dbClient.query(
        `DELETE FROM user_prompts WHERE user_id = $1 AND id = $2 RETURNING id`,
        [session.userId, promptId]
      )) as Array<Record<string, unknown>>;
      if (!rows[0]) return notFound;
      return NextResponse.json(
        DeletePromptResponseSchema.parse({ success: true, deletedPromptId: promptId })
      );
    } catch (err) {
      logServerError('[prompts] Failed to delete prompt', err, {
        source: 'prompts',
        subdomain,
      });
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to delete prompt' },
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
    const { data: deleted, error: deleteErr } = await supabase
      .from('user_prompts')
      .delete()
      .eq('id', promptId)
      .eq('user_id', session.userId)
      .select('id')
      .single();
    if (deleteErr || !deleted) {
      if (deleteErr && deleteErr.code !== 'PGRST116') {
        throw deleteErr;
      }
      return notFound;
    }
    return NextResponse.json(
      DeletePromptResponseSchema.parse({ success: true, deletedPromptId: promptId })
    );
  } catch (err) {
    logServerError('[prompts] Failed to delete prompt', err, {
      source: 'prompts',
      subdomain,
    });
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; promptId: string }> }
): Promise<NextResponse> {
  const { subdomain, promptId } = await context.params;
  return handleUpdatePrompt(request, subdomain, promptId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; promptId: string }> }
): Promise<NextResponse> {
  const { subdomain, promptId } = await context.params;
  return handleDeletePrompt(request, subdomain, promptId);
}
