# Contract: Diagnostic Health Probes

This document specifies the health check endpoint contracts for both the web application and edge worker.

---

## 1. Web Application (`apps/web` - `GET /api/health`)

### Contract Details
- **Method**: `GET`
- **Path**: `/api/health`
- **Timeout Budget**: 2000ms (`AbortController`)
- **Headers**:
  - Response: `Content-Type: application/json`, `Cache-Control: no-store, no-cache, must-revalidate`

### Success Response (HTTP 200 OK)
Returned when the database probe query (`SELECT 1`) succeeds within 2000ms.
```json
{
  "status": "ok",
  "timestamp": "2026-10-07T10:00:00.000Z",
  "database": "connected"
}
```

### Degraded / Outage Response (HTTP 503 Service Unavailable)
Returned when the database fails, rejects connection, or exceeds the 2000ms timeout budget.
```json
{
  "status": "unhealthy",
  "timestamp": "2026-10-07T10:00:02.000Z",
  "database": "disconnected"
}
```

### Security & Sanitization Invariants
- 100% of internal stack traces, connection strings, database usernames, hostnames, and ports are stripped from HTTP responses.
- Internal errors are logged strictly to server-side stderr for debugging.

---

## 2. Edge Worker (`apps/worker` - `GET /health`)

### Contract Details
- **Method**: `GET`
- **Path**: `/health`
- **Response Format**: `Content-Type: application/json`

### Success Response (HTTP 200 OK)
```json
{
  "status": "ok",
  "worker": "fbuploadpro-worker"
}
```

### Fallback Response (HTTP 404 Not Found)
For any unhandled paths on the edge worker:
```json
{
  "error": "Not Found"
}
```
