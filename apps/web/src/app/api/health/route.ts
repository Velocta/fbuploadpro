import { NextResponse } from 'next/server';
import { createDatabaseClient, type DatabaseClient } from '@fbuploadpro/database';

let defaultDbClient: DatabaseClient | null = null;

function getDbClient(): DatabaseClient {
  defaultDbClient ??= createDatabaseClient();
  return defaultDbClient;
}

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
  const db = client ?? getDbClient();

  try {
    const probePromise = db.query('SELECT 1');
    let timerId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('Health probe timeout exceeded budget'));
      }, timeoutMs);
    });

    try {
      await Promise.race([probePromise, timeoutPromise]);
    } finally {
      clearTimeout(timerId!);
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
