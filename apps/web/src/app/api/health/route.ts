export const HTTP_STATUS = {
  OK: 200,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const HEALTH_STATUS = {
  OK: "ok",
  UNHEALTHY: "unhealthy",
} as const;

export const DATABASE_STATUS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
} as const;

export const HEALTH_TIMEOUT_MS = 2000;

type DatabaseChecker = ((signal: AbortSignal) => Promise<boolean>) | null;
let customDatabaseChecker: DatabaseChecker = null;

export function setDatabaseChecker(checker: DatabaseChecker): void {
  customDatabaseChecker = checker;
}

function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new Error("Timeout"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Timeout"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}

async function performDatabaseCheck(signal: AbortSignal): Promise<boolean> {
  if (customDatabaseChecker) {
    return await raceWithSignal(customDatabaseChecker(signal), signal);
  }
  return true;
}

export async function GET(): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const isHealthy = await performDatabaseCheck(controller.signal);
    if (!isHealthy) {
      return buildHealthResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, HEALTH_STATUS.UNHEALTHY, DATABASE_STATUS.DISCONNECTED);
    }
    return buildHealthResponse(HTTP_STATUS.OK, HEALTH_STATUS.OK, DATABASE_STATUS.CONNECTED);
  } catch {
    return buildHealthResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, HEALTH_STATUS.UNHEALTHY, DATABASE_STATUS.DISCONNECTED);
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHealthResponse(
  status: typeof HTTP_STATUS[keyof typeof HTTP_STATUS],
  healthStatus: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS],
  databaseStatus: typeof DATABASE_STATUS[keyof typeof DATABASE_STATUS]
): Response {
  return Response.json(
    {
      status: healthStatus,
      timestamp: new Date().toISOString(),
      database: databaseStatus,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    }
  );
}
