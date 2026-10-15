# Technical Research & Architectural Decisions: Spec 043

## 1. Cloudflare Workers Stream Piping to R2

### Problem
In Vercel Serverless (Node.js runtime), buffering large media files in RAM triggers memory spikes and serverless execution timeouts (10s on Free).

### Decision
Use Cloudflare R2's native support for `ReadableStream`. In Workers runtime, `env.MEDIA_BUCKET.put(key, stream)` accepts a standard Web `ReadableStream` directly:
```typescript
const response = await fetch(remoteUrl);
const byteTransform = new TransformStream({
  transform(chunk, controller) {
    bytesCount += chunk.byteLength;
    controller.enqueue(chunk);
  }
});
await env.MEDIA_BUCKET.put(storageKey, response.body.pipeThrough(byteTransform), {
  httpMetadata: { contentType: mimeType }
});
```
This requires `< 5 MB` of memory, regardless of file size, and network streaming time does not count against Cloudflare Worker CPU limits.

---

## 2. Asynchronous Job Dispatch on Cloudflare

### Problem
How to return immediately to the frontend while continuing the stream download on Cloudflare?

### Decision
Use `ctx.waitUntil()` within the Cloudflare Worker fetch event handler.
1. Authenticate user and validate URL.
2. Insert a record into `media_download_jobs` with `status: 'queued'`.
3. Return `202 Accepted` or `200 OK` with `{ jobId }` immediately (< 100ms).
4. Run `ctx.waitUntil(processDownloadJob(jobId, env))` to asynchronously execute the download, stream to R2, update `progress_percent` throttled to Supabase, and transition job status to `completed` or `failed`.

---

## 3. Edge-Compatible SSRF Protection

### Problem
Node's `dns.lookup` and `net.isIP` are not available in standard Cloudflare Worker V8 isolates.

### Decision
Implement edge-safe validation:
- Disallow non-HTTP/HTTPS protocols (`file:`, `gopher:`, `ftp:`, etc.).
- Regex-based validation against loopback (`127.0.0.0/8`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`), carrier-grade NAT (`100.64.0.0/10`), and cloud metadata IP (`169.254.169.254`).
- Whitelist and sanitize domains, preventing DNS rebinding tricks or encoded IP representations (e.g., hex, octal, or dword IP formats).

---

## 4. Throttled Database Progress Updates

### Problem
If a 100 MB video downloads in 2 seconds, emitting a database update on every 64 KB chunk would attempt 1,500 database writes in 2 seconds, exhausting Postgres connections.

### Decision
Implement a throttle threshold:
- Update `media_download_jobs` only when progress advances by at least **10%** OR at least **3,000 milliseconds** have elapsed since the last DB write.
- Always guarantee a write on completion (100%) or failure.
