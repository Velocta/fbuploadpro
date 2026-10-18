import { NextResponse } from 'next/server';
import type { DatabaseClient } from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';

export async function probeHealth(
  client?: DatabaseClient,
  timeoutMs = 2000
): Promise<{
  statusCode: number;
  payload: {
    status: 'ok' | 'unhealthy';
    timestamp: string;
    database: 'connected' | 'disconnected';
  };
}> {
  const timestamp = new Date().toISOString();

  // If mock client is provided (e.g. in tests)
  if (client) {
    let timerId: NodeJS.Timeout;
    try {
      const probePromise = client.query('SELECT 1');
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error('Health probe timeout exceeded budget'));
        }, timeoutMs);
      });

      await Promise.race([probePromise, timeoutPromise]);
      clearTimeout(timerId!);

      return {
        statusCode: 200,
        payload: {
          status: 'ok',
          timestamp,
          database: 'connected',
        },
      };
    } catch {
      clearTimeout(timerId!);
      return {
        statusCode: 503,
        payload: {
          status: 'unhealthy',
          timestamp,
          database: 'disconnected',
        },
      };
    }
  }

  let timerId: NodeJS.Timeout;
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const probePromise = supabase.from('workspaces').select('id', { head: true, count: 'exact' });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('Health probe timeout exceeded budget'));
      }, timeoutMs);
    });

    const { error } = await Promise.race([probePromise, timeoutPromise]);
    clearTimeout(timerId!);

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      payload: {
        status: 'ok',
        timestamp,
        database: 'connected',
      },
    };
  } catch (error) {
    clearTimeout(timerId!);
    // Stripped of internal connection credentials and stack traces for external clients
    console.error('Diagnostic probe failure:', error instanceof Error ? error.message : error);

    return {
      statusCode: 503,
      payload: {
        status: 'unhealthy',
        timestamp,
        database: 'disconnected',
      },
    };
  }
}

export async function GET() {
  const result = await probeHealth();
  return NextResponse.json(result.payload, {
    status: result.statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
