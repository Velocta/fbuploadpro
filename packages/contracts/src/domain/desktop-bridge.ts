/**
 * Desktop bridge contract — FROZEN v1.0 (spec 145, §7–§11).
 *
 * Single source of truth for the Tauri v2 native bridge. Rust structs mirror
 * these schemas field-for-field; there is no second schema. While specs
 * 146–148 build in parallel, this module may only change by a §12 amendment
 * (additive optional fields via a minor bump, or the one pre-approved
 * manifest-values edit in PR-145-E). Renames, removals and semantic changes
 * require a major version bump + coordinator approval.
 *
 * Invocation convention (§6.1): every command except the two legacy commands
 * (`handle_window_action`, `open_external_url`) takes exactly one argument
 * named `payload` and is invoked as `invoke('<command>', { payload })`.
 * Wire JSON is camelCase in both directions. Responses are objects, never
 * bare strings. Errors are DesktopBridgeError objects, never bare strings.
 * New wrappers throw DesktopBridgeError (BRIDGE_UNAVAILABLE outside the
 * shell); only the two legacy helpers keep their false-on-failure behaviour.
 */
import { z } from 'zod';
import { DesktopWindowActionEnum, isDesktopApp } from './desktop.js';

export const BRIDGE_VERSION = '1.0.0' as const;

/** Required bridge version a feature declares (spec §12.2). */
export const DESKTOP_BRIDGE_REQUIRED_VERSION = { major: 1, minor: 0 } as const;

// ---------------------------------------------------------------------------
// §11 — Error taxonomy (FROZEN)
// ---------------------------------------------------------------------------

export const DesktopBridgeErrorCodeEnum = z.enum([
  'VALIDATION_ERROR',
  'BRIDGE_UNAVAILABLE',
  'BRIDGE_VERSION_MISMATCH',
  'INTERNAL_ERROR',
  'SCOPE_NOT_FOUND',
  'PATH_TRAVERSAL',
  'FS_NOT_FOUND',
  'FS_ALREADY_EXISTS',
  'FS_NOT_EMPTY',
  'FS_NOT_TEXT',
  'FS_PERMISSION_DENIED',
  'FS_TOO_MANY_ENTRIES',
  'PROCESS_ALREADY_RUNNING',
  'PROCESS_NOT_FOUND',
  'PROCESS_SPAWN_FAILED',
  'BINARY_NOT_READY',
  'ARTIFACT_UNSUPPORTED_PLATFORM',
  'ARTIFACT_CHECKSUM_MISMATCH',
  'ARTIFACT_CORRUPT',
  'ARTIFACT_IN_USE',
  'ARTIFACT_OFFLINE',
  'ARTIFACT_CANCELLED',
  'SIDECAR_MODEL_NOT_READY',
  'SECRETS_UNAVAILABLE',
  'SECRETS_NOT_FOUND',
  'MEDIA_URL_INVALID',
  'MEDIA_NOT_FOUND',
  'MEDIA_PROBE_FAILED',
  'MEDIA_DOWNLOAD_FAILED',
  'MEDIA_CONVERT_FAILED',
  'MEDIA_TIMEOUT',
  'TRANSCRIBE_FAILED',
  'AI_KEY_MISSING',
  'AI_REQUEST_NOT_FOUND',
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_PROVIDER_ERROR',
]);
export type DesktopBridgeErrorCode = z.infer<typeof DesktopBridgeErrorCodeEnum>;

/**
 * `details` may carry ONLY these keys — never a filesystem path, URL
 * credential, secret, or stack trace. Enforced by .strict() + the test suite.
 */
export const DesktopBridgeErrorDetailsSchema = z
  .object({
    runId: z.string().optional(),
    requestId: z.string().optional(),
    artifactId: z.string().optional(),
    modelId: z.string().optional(),
    scopeId: z.string().optional(),
    retryAfterMs: z.number().int().nonnegative().optional(),
  })
  .strict()
  .partial();
export type DesktopBridgeErrorDetails = z.infer<typeof DesktopBridgeErrorDetailsSchema>;

export const DesktopBridgeErrorSchema = z.object({
  code: DesktopBridgeErrorCodeEnum,
  /** User-safe plain language: no paths, secrets, keys, binary locations. */
  message: z.string().min(1),
  retryable: z.boolean(),
  details: DesktopBridgeErrorDetailsSchema.optional(),
});
export type DesktopBridgeErrorData = z.infer<typeof DesktopBridgeErrorSchema>;

export class DesktopBridgeError extends Error {
  readonly code: DesktopBridgeErrorCode;
  readonly retryable: boolean;
  readonly details?: DesktopBridgeErrorDetails;
  constructor(code: DesktopBridgeErrorCode, message: string, retryable: boolean, details?: DesktopBridgeErrorDetails) {
    super(message);
    this.name = 'DesktopBridgeError';
    this.code = code;
    this.retryable = retryable;
    if (details !== undefined) this.details = details;
  }
  toData(): DesktopBridgeErrorData {
    const data: DesktopBridgeErrorData = { code: this.code, message: this.message, retryable: this.retryable };
    if (this.details !== undefined) data.details = this.details;
    return data;
  }
  static fromUnknown(value: unknown): DesktopBridgeError {
    const parsed = DesktopBridgeErrorSchema.safeParse(value);
    if (parsed.success) {
      return new DesktopBridgeError(parsed.data.code, parsed.data.message, parsed.data.retryable, parsed.data.details);
    }
    return new DesktopBridgeError('INTERNAL_ERROR', 'The desktop bridge returned an unexpected error.', false);
  }
}

export function bridgeUnavailableError(): DesktopBridgeError {
  return new DesktopBridgeError('BRIDGE_UNAVAILABLE', 'This feature requires the FBUploadPro desktop app.', false);
}
export function validationError(message: string): DesktopBridgeError {
  return new DesktopBridgeError('VALIDATION_ERROR', message, false);
}

// ---------------------------------------------------------------------------
// Shared field validators
// ---------------------------------------------------------------------------

export const BridgeSubdomainSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'subdomain must match ^[a-z0-9][a-z0-9-]{1,62}$');
export const NamespaceSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/);
export const JobIdSchema = z.string().uuid();
export const TracingSchema = z.object({
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
});

/** A scoped relative path: never absolute, never containing a `..` segment. */
export function isSafeRelativePath(value: string): boolean {
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:/.test(value)) return false; // Windows drive-absolute
  return !value.split(/[\\/]/).includes('..');
}
export const RelativePathSchema = z.string().refine(isSafeRelativePath, 'relativePath must not be absolute or contain ".."');
export const OptionalRelativePathSchema = z.string().refine(isSafeRelativePath, 'relativePath must not be absolute or contain ".."').optional();
export const BareExtensionSchema = z.string().regex(/^[A-Za-z0-9]{1,10}$/, 'extensions must be bare (e.g. "mp4", not ".mp4" or "*")');
export const ServiceNameSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/);

/** https/http URL without embedded userinfo (same rule as the Rust validator). */
export function isCleanHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username !== '' || u.password !== '') return false;
    return true;
  } catch {
    return false;
  }
}
export const CleanHttpUrlSchema = z.string().refine(isCleanHttpUrl, 'URL must be http(s) without embedded credentials');

// ---------------------------------------------------------------------------
// §6.1 — invoke + event plumbing
// ---------------------------------------------------------------------------

type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const internals = win.__TAURI_INTERNALS__ as { invoke?: TauriInvoke } | undefined;
  if (internals?.invoke) return internals.invoke;
  const core = win.__TAURI__ as { core?: { invoke?: TauriInvoke } } | undefined;
  if (core?.core?.invoke) return core.core.invoke;
  return null;
}

/**
 * Generic typed invoke. Throws BRIDGE_UNAVAILABLE outside the shell, and
 * maps any non-object rejection to INTERNAL_ERROR (never surfaces raw text).
 */
export async function invokeDesktopCommand<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  if (!isDesktopApp()) throw bridgeUnavailableError();
  const invoke = getTauriInvoke();
  if (!invoke) throw bridgeUnavailableError();
  try {
    const args = payload === undefined ? undefined : { payload };
    return (await invoke(command, args)) as T;
  } catch (err) {
    if (err instanceof DesktopBridgeError) throw err;
    throw DesktopBridgeError.fromUnknown(err);
  }
}

/** Legacy bare-shape invoke (only handle_window_action / open_external_url). */
export async function invokeDesktopLegacyCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  if (!isDesktopApp()) throw bridgeUnavailableError();
  const invoke = getTauriInvoke();
  if (!invoke) throw bridgeUnavailableError();
  try {
    return (await invoke(command, args)) as T;
  } catch (err) {
    if (err instanceof DesktopBridgeError) throw err;
    throw DesktopBridgeError.fromUnknown(err);
  }
}

export type DesktopEventUnlisten = () => Promise<void> | void;

/**
 * Subscribe to a desktop:* event. Returns an unlisten function; callers MUST
 * call it on unmount. Throws BRIDGE_UNAVAILABLE outside the shell.
 */
export async function subscribeDesktopEvent<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<DesktopEventUnlisten> {
  if (!isDesktopApp()) throw bridgeUnavailableError();
  if (typeof window === 'undefined') throw bridgeUnavailableError();
  const win = window as unknown as Record<string, unknown>;
  const tauri = win.__TAURI__ as { event?: { listen?: (e: string, h: (ev: { payload: T }) => void) => Promise<DesktopEventUnlisten> } } | undefined;
  if (!tauri?.event?.listen) throw bridgeUnavailableError();
  return tauri.event.listen(event, (ev) => handler(ev.payload));
}

/** §12.2 compatibility check: same major, minor >= required. */
export function assertBridgeVersion(info: { bridgeVersion: string }, requiredMajor = 1, requiredMinor = 0): void {
  const parts = info.bridgeVersion.split('.').map((p) => Number.parseInt(p, 10));
  const [major = 0, minor = 0] = parts;
  if (major !== requiredMajor || minor < requiredMinor || Number.isNaN(major) || Number.isNaN(minor)) {
    throw new DesktopBridgeError(
      'BRIDGE_VERSION_MISMATCH',
      'Please update the FBUploadPro desktop app to use this feature.',
      false,
    );
  }
}

// ---------------------------------------------------------------------------
// §7.3 — Core + window + external (FROZEN)
// ---------------------------------------------------------------------------

export const GetShellInfoResponseSchema = z.object({
  appName: z.string(),
  version: z.string(),
  bridgeVersion: z.literal('1.0.0'),
  platform: z.enum(['macos', 'windows', 'linux']),
  arch: z.string(),
  frameless: z.boolean(),
  window: z.object({
    defaultWidth: z.number().int().positive(),
    defaultHeight: z.number().int().positive(),
    minWidth: z.number().int().positive(),
    minHeight: z.number().int().positive(),
  }),
  capabilities: z.object({
    filesystem: z.boolean(),
    process: z.boolean(),
    dialogs: z.boolean(),
    secrets: z.boolean(),
    artifacts: z.boolean(),
    media: z.boolean(),
    ai: z.boolean(),
  }),
});
export type GetShellInfoResponse = z.infer<typeof GetShellInfoResponseSchema>;

export const StartUrlResponseSchema = z.object({
  url: z.string(),
  source: z.enum(['env-override', 'remembered-tenant', 'default']),
  tenantSubdomain: z.string().nullable(),
});
export type StartUrlResponse = z.infer<typeof StartUrlResponseSchema>;

export const RememberTenantRequestSchema = z.object({ subdomain: BridgeSubdomainSchema });
export const RememberTenantResponseSchema = z.object({ subdomain: z.string(), stored: z.literal(true) });
export const ForgetTenantResponseSchema = z.object({ forgotten: z.literal(true) });
export const RetryConnectionResponseSchema = z.object({ reachable: z.boolean(), url: z.string() });

export const WindowActionResponseSchema = z.object({
  action: DesktopWindowActionEnum,
  applied: z.literal(true),
  maximized: z.boolean().nullable(),
});
export type WindowActionResponse = z.infer<typeof WindowActionResponseSchema>;
export const OpenExternalUrlResponseSchema = z.object({ opened: z.literal(true), url: z.string() });
export type OpenExternalUrlResponse = z.infer<typeof OpenExternalUrlResponseSchema>;

export async function getShellInfo(): Promise<GetShellInfoResponse> {
  return invokeDesktopCommand<GetShellInfoResponse>('get_shell_info', {});
}
export async function getStartUrl(): Promise<StartUrlResponse> {
  return invokeDesktopCommand<StartUrlResponse>('shell_get_start_url', {});
}
export async function rememberTenant(subdomain: string): Promise<z.infer<typeof RememberTenantResponseSchema>> {
  const payload = RememberTenantRequestSchema.parse({ subdomain });
  return invokeDesktopCommand('shell_remember_tenant', payload);
}
export async function forgetTenant(): Promise<z.infer<typeof ForgetTenantResponseSchema>> {
  return invokeDesktopCommand('shell_forget_tenant', {});
}
export async function retryConnection(): Promise<z.infer<typeof RetryConnectionResponseSchema>> {
  return invokeDesktopCommand('shell_retry_connection', {});
}

// ---------------------------------------------------------------------------
// §7.4 — Dialogs + scoped filesystem (FROZEN)
// ---------------------------------------------------------------------------

export const DialogFilterSchema = z.object({ name: z.string().min(1), extensions: z.array(BareExtensionSchema) });
export const DialogOpenFileRequestSchema = z.object({
  title: z.string().optional(),
  filters: z.array(DialogFilterSchema).optional(),
  multiple: z.boolean().optional(),
});
export const DialogFileSchema = z.object({ path: z.string(), scopeId: z.string(), name: z.string() });
export const DialogOpenFileResponseSchema = z.union([
  z.object({ files: z.array(DialogFileSchema), cancelled: z.literal(false) }),
  z.object({ files: z.array(DialogFileSchema).length(0), cancelled: z.literal(true) }),
]);
export const DialogOpenDirectoryRequestSchema = z.object({ title: z.string().optional(), multiple: z.boolean().optional() });
export const DialogDirectorySchema = z.object({ path: z.string(), scopeId: z.string() });
export const DialogOpenDirectoryResponseSchema = z.union([
  z.object({ directories: z.array(DialogDirectorySchema), cancelled: z.literal(false) }),
  z.object({ directories: z.array(DialogDirectorySchema).length(0), cancelled: z.literal(true) }),
]);
export const DialogSaveFileRequestSchema = z.object({
  title: z.string().optional(),
  defaultName: z.string().refine((v) => !v.includes('/') && !v.includes('\\'), 'defaultName must not contain a path separator').optional(),
  filters: z.array(DialogFilterSchema).optional(),
});
export const DialogSaveFileResponseSchema = z.union([
  z.object({ path: z.string(), scopeId: z.string(), cancelled: z.literal(false) }),
  z.object({ path: z.string().nullable(), scopeId: z.string().nullable(), cancelled: z.literal(true) }),
]);

export const ScopeInfoSchema = z.object({ scopeId: z.string(), kind: z.enum(['directory', 'file']), path: z.string() });
export const FsScopeListResponseSchema = z.object({ scopes: z.array(ScopeInfoSchema) });
export const FsScopeRevokeRequestSchema = z.object({ scopeId: z.string() });
export const FsScopeRevokeResponseSchema = z.object({ scopeId: z.string(), revoked: z.literal(true) });

export const FsEntrySchema = z.object({
  name: z.string(),
  relativePath: z.string(),
  kind: z.enum(['file', 'directory']),
  sizeBytes: z.number().int().nonnegative().nullable(),
  modifiedAt: z.string().nullable(),
});
export const FsListRequestSchema = z.object({ scopeId: z.string(), relativePath: OptionalRelativePathSchema, recursive: z.boolean().optional() });
export const FsListResponseSchema = z.object({ entries: z.array(FsEntrySchema) });
export const FsStatRequestSchema = z.object({ scopeId: z.string(), relativePath: OptionalRelativePathSchema });
export const FsStatResponseSchema = z.object({
  kind: z.enum(['file', 'directory']),
  sizeBytes: z.number().int().nonnegative().nullable(),
  modifiedAt: z.string().nullable(),
  relativePath: z.string(),
});
export const FsExistsRequestSchema = FsStatRequestSchema;
export const FsExistsResponseSchema = z.object({ exists: z.boolean() });
export const FsReadTextRequestSchema = z.object({
  scopeId: z.string(),
  relativePath: OptionalRelativePathSchema,
  maxBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
});
export const FsReadTextResponseSchema = z.object({ content: z.string(), truncated: z.literal(false), sizeBytes: z.number().int().nonnegative() });
export const FsWriteTextRequestSchema = z.object({
  scopeId: z.string(),
  relativePath: RelativePathSchema,
  content: z.string().max(10 * 1024 * 1024),
  createParents: z.boolean().optional(),
  overwrite: z.boolean().optional(),
});
export const FsWriteTextResponseSchema = z.object({ relativePath: z.string(), sizeBytes: z.number().int().nonnegative(), overwritten: z.boolean() });
export const FsMkdirRequestSchema = z.object({ scopeId: z.string(), relativePath: RelativePathSchema, recursive: z.boolean().optional() });
export const FsMkdirResponseSchema = z.object({ relativePath: z.string(), created: z.boolean() });
export const FsDeleteRequestSchema = z.object({ scopeId: z.string(), relativePath: RelativePathSchema, recursive: z.boolean().optional() });
export const FsDeleteResponseSchema = z.object({ relativePath: z.string(), deleted: z.literal(true) });
export const FsCopyRequestSchema = z.object({
  sourceScopeId: z.string(),
  sourceRelativePath: RelativePathSchema,
  destScopeId: z.string(),
  destRelativePath: RelativePathSchema,
  overwrite: z.boolean().optional(),
});
export const FsCopyResponseSchema = z.object({ destRelativePath: z.string(), sizeBytes: z.number().int().nonnegative() });
export const FsMoveRequestSchema = FsCopyRequestSchema;
export const FsMoveResponseSchema = FsCopyResponseSchema;

export async function dialogOpenFile(req: z.infer<typeof DialogOpenFileRequestSchema> = {}) {
  return invokeDesktopCommand<z.infer<typeof DialogOpenFileResponseSchema>>('dialog_open_file', DialogOpenFileRequestSchema.parse(req));
}
export async function dialogOpenDirectory(req: z.infer<typeof DialogOpenDirectoryRequestSchema> = {}) {
  return invokeDesktopCommand<z.infer<typeof DialogOpenDirectoryResponseSchema>>('dialog_open_directory', DialogOpenDirectoryRequestSchema.parse(req));
}
export async function dialogSaveFile(req: z.infer<typeof DialogSaveFileRequestSchema> = {}) {
  return invokeDesktopCommand<z.infer<typeof DialogSaveFileResponseSchema>>('dialog_save_file', DialogSaveFileRequestSchema.parse(req));
}
export async function fsScopeList() {
  return invokeDesktopCommand<z.infer<typeof FsScopeListResponseSchema>>('fs_scope_list', {});
}
export async function fsScopeRevoke(scopeId: string) {
  return invokeDesktopCommand<z.infer<typeof FsScopeRevokeResponseSchema>>('fs_scope_revoke', FsScopeRevokeRequestSchema.parse({ scopeId }));
}
export async function fsList(req: z.infer<typeof FsListRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsListResponseSchema>>('fs_list', FsListRequestSchema.parse(req));
}
export async function fsStat(req: z.infer<typeof FsStatRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsStatResponseSchema>>('fs_stat', FsStatRequestSchema.parse(req));
}
export async function fsExists(req: z.infer<typeof FsExistsRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsExistsResponseSchema>>('fs_exists', FsExistsRequestSchema.parse(req));
}
export async function fsReadText(req: z.infer<typeof FsReadTextRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsReadTextResponseSchema>>('fs_read_text', FsReadTextRequestSchema.parse(req));
}
export async function fsWriteText(req: z.infer<typeof FsWriteTextRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsWriteTextResponseSchema>>('fs_write_text', FsWriteTextRequestSchema.parse(req));
}
export async function fsMkdir(req: z.infer<typeof FsMkdirRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsMkdirResponseSchema>>('fs_mkdir', FsMkdirRequestSchema.parse(req));
}
export async function fsDelete(req: z.infer<typeof FsDeleteRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsDeleteResponseSchema>>('fs_delete', FsDeleteRequestSchema.parse(req));
}
export async function fsCopy(req: z.infer<typeof FsCopyRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsCopyResponseSchema>>('fs_copy', FsCopyRequestSchema.parse(req));
}
export async function fsMove(req: z.infer<typeof FsMoveRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof FsMoveResponseSchema>>('fs_move', FsMoveRequestSchema.parse(req));
}

// ---------------------------------------------------------------------------
// §7.5 — Processes (FROZEN)
// ---------------------------------------------------------------------------

export const BinaryIdEnum = z.enum(['yt-dlp', 'ffmpeg', 'ffprobe', 'whisper']);
export type BinaryId = z.infer<typeof BinaryIdEnum>;
const EnvKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]+$/).refine(
  (k) => k !== 'PATH' && !k.startsWith('LD_') && !k.startsWith('DYLD_') && !k.endsWith('_KEY') && !k.endsWith('_TOKEN') && !k.includes('_SECRET'),
  'env keys must not be PATH, LD_*/DYLD_*, or secret-like names',
);
export const ProcessSpawnRequestSchema = z.object({
  runId: z.string().optional(),
  binaryId: BinaryIdEnum,
  args: z.array(z.string().max(4096)).max(128),
  cwdScopeId: z.string().optional(),
  cwdRelativePath: OptionalRelativePathSchema,
  env: z.record(EnvKeySchema, z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(86400000).optional(),
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
});
export const ProcessSpawnResponseSchema = z.object({ runId: z.string(), pid: z.number().int(), binaryId: BinaryIdEnum, startedAt: z.string() });
export const ProcessWriteStdinRequestSchema = z.object({ runId: z.string(), data: z.string().max(1024 * 1024), close: z.boolean().optional() });
export const ProcessWriteStdinResponseSchema = z.object({ runId: z.string(), written: z.literal(true), closed: z.boolean() });
export const ProcessCancelRequestSchema = z.object({ runId: z.string(), mode: z.enum(['terminate', 'kill']).optional() });
export const ProcessCancelResponseSchema = z.object({ runId: z.string(), state: z.enum(['cancelled', 'exited']), alreadyExited: z.boolean() });
export const ProcessStatusRequestSchema = z.object({ runId: z.string() });
export const ProcessStatusResponseSchema = z.object({
  runId: z.string(),
  state: z.enum(['running', 'exited', 'cancelled']),
  exitCode: z.number().int().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export const ProcessListEntrySchema = z.object({
  runId: z.string(),
  binaryId: BinaryIdEnum,
  state: z.enum(['running', 'exited', 'cancelled']),
  namespace: z.string().nullable(),
  jobId: z.string().nullable(),
  startedAt: z.string(),
});
export const ProcessListResponseSchema = z.object({ processes: z.array(ProcessListEntrySchema) });

export async function processSpawn(req: z.infer<typeof ProcessSpawnRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ProcessSpawnResponseSchema>>('process_spawn', ProcessSpawnRequestSchema.parse(req));
}
export async function processWriteStdin(req: z.infer<typeof ProcessWriteStdinRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ProcessWriteStdinResponseSchema>>('process_write_stdin', ProcessWriteStdinRequestSchema.parse(req));
}
export async function processCancel(req: z.infer<typeof ProcessCancelRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ProcessCancelResponseSchema>>('process_cancel', ProcessCancelRequestSchema.parse(req));
}
export async function processStatus(req: z.infer<typeof ProcessStatusRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ProcessStatusResponseSchema>>('process_status', ProcessStatusRequestSchema.parse(req));
}
export async function processList() {
  return invokeDesktopCommand<z.infer<typeof ProcessListResponseSchema>>('process_list', {});
}

// ---------------------------------------------------------------------------
// §8 — Artifacts + secrets (FROZEN shapes)
// ---------------------------------------------------------------------------

export const ArtifactPlatformEnum = z.enum(['macos-arm64', 'macos-x64', 'windows-x64', 'linux-x64']);
export const ArtifactAssetSchema = z.object({
  platform: ArtifactPlatformEnum,
  url: z.string().refine(isCleanHttpUrl, 'artifact URL must be https without embedded credentials').refine((u) => u.startsWith('https://'), 'artifact URL must be https'),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'sha256 must be 64 hex chars'),
  archiveKind: z.enum(['none', 'zip', 'tar.gz']),
  binaryNames: z.array(z.string().min(1)).optional(),
});
export const ArtifactManifestEntrySchema = z.object({
  artifactId: z.string().min(1),
  kind: z.enum(['binary', 'model']),
  version: z.string().min(1).refine((v) => v !== 'latest' && !v.includes('*') && !v.includes(' '), 'version must be pinned, never "latest" or floating'),
  description: z.string(),
  assets: z.array(ArtifactAssetSchema).min(1),
});
export const DesktopArtifactManifestSchema = z.array(ArtifactManifestEntrySchema);
export type DesktopArtifactManifestEntry = z.infer<typeof ArtifactManifestEntrySchema>;

/**
 * Manifest VALUES land in PR-145-E (the one pre-approved post-freeze edit to
 * this file, spec §8.1 / tasks T-14). PR-145-A ships the shape + validation
 * only — never a fake hash. An empty manifest validates; handlers treat an
 * absent entry as VALIDATION_ERROR, never as a silent fallback.
 */
export const DESKTOP_ARTIFACT_MANIFEST: DesktopArtifactManifestEntry[] = [];

export const ArtifactStatusSchema = z.object({
  artifactId: z.string(),
  kind: z.enum(['binary', 'model']),
  state: z.enum(['missing', 'downloading', 'ready', 'corrupt', 'error']),
  version: z.string().nullable(),
  error: DesktopBridgeErrorSchema.optional(),
});
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;
export const ArtifactListResponseSchema = z.object({ artifacts: z.array(ArtifactStatusSchema) });
export const ArtifactStatusResponseSchema = z.object({ artifact: ArtifactStatusSchema });
export const BinaryStatusRequestSchema = z.object({ binaryId: z.string() });
export const BinaryEnsureRequestSchema = z.object({ binaryId: z.string(), version: z.string().optional() });
export const SidecarModelStatusRequestSchema = z.object({ modelId: z.string() });
export const SidecarModelEnsureRequestSchema = z.object({ modelId: z.string(), version: z.string().optional() });

export async function binaryList() {
  return invokeDesktopCommand<z.infer<typeof ArtifactListResponseSchema>>('binary_list', {});
}
export async function binaryStatus(binaryId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('binary_status', BinaryStatusRequestSchema.parse({ binaryId }));
}
export async function binaryEnsure(req: z.infer<typeof BinaryEnsureRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('binary_ensure', BinaryEnsureRequestSchema.parse(req));
}
export async function binaryVerify(binaryId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('binary_verify', BinaryStatusRequestSchema.parse({ binaryId }));
}
export async function binaryRemove(binaryId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('binary_remove', BinaryStatusRequestSchema.parse({ binaryId }));
}
export async function binaryCancelDownload(binaryId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('binary_cancel_download', BinaryStatusRequestSchema.parse({ binaryId }));
}
export async function sidecarModelList() {
  return invokeDesktopCommand<z.infer<typeof ArtifactListResponseSchema>>('sidecar_model_list', {});
}
export async function sidecarModelStatus(modelId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('sidecar_model_status', SidecarModelStatusRequestSchema.parse({ modelId }));
}
export async function sidecarModelEnsure(req: z.infer<typeof SidecarModelEnsureRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('sidecar_model_ensure', SidecarModelEnsureRequestSchema.parse(req));
}
export async function sidecarModelRemove(modelId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('sidecar_model_remove', SidecarModelStatusRequestSchema.parse({ modelId }));
}
export async function sidecarModelCancelDownload(modelId: string) {
  return invokeDesktopCommand<z.infer<typeof ArtifactStatusResponseSchema>>('sidecar_model_cancel_download', SidecarModelStatusRequestSchema.parse({ modelId }));
}

export const SecretsSetRequestSchema = z.object({ service: ServiceNameSchema, keyName: ServiceNameSchema, value: z.string().min(1).max(8192) });
export const SecretsKeyRequestSchema = z.object({ service: ServiceNameSchema, keyName: ServiceNameSchema });
export const SecretsSetResponseSchema = z.object({ service: z.string(), keyName: z.string(), stored: z.literal(true) });
export const SecretsGetResponseSchema = z.object({ service: z.string(), keyName: z.string(), value: z.string() });
export const SecretsHasResponseSchema = z.object({ service: z.string(), keyName: z.string(), present: z.boolean() });
export const SecretsListRequestSchema = z.object({ service: ServiceNameSchema });
export const SecretsListResponseSchema = z.object({ service: z.string(), keyNames: z.array(z.string()) });
export const SecretsDeleteResponseSchema = z.object({ service: z.string(), keyName: z.string(), deleted: z.literal(true) });

export async function secretsSet(req: z.infer<typeof SecretsSetRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof SecretsSetResponseSchema>>('secrets_set', SecretsSetRequestSchema.parse(req));
}
export async function secretsGet(req: z.infer<typeof SecretsKeyRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof SecretsGetResponseSchema>>('secrets_get', SecretsKeyRequestSchema.parse(req));
}
export async function secretsHas(req: z.infer<typeof SecretsKeyRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof SecretsHasResponseSchema>>('secrets_has', SecretsKeyRequestSchema.parse(req));
}
export async function secretsList(service: string) {
  return invokeDesktopCommand<z.infer<typeof SecretsListResponseSchema>>('secrets_list', SecretsListRequestSchema.parse({ service }));
}
export async function secretsDelete(req: z.infer<typeof SecretsKeyRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof SecretsDeleteResponseSchema>>('secrets_delete', SecretsKeyRequestSchema.parse(req));
}

// ---------------------------------------------------------------------------
// §9 — Generic media primitives (FROZEN)
// ---------------------------------------------------------------------------

const YtDlpOutputTemplateSchema = z.string().refine((t) => {
  if (t.includes('..')) return false;
  const fields = [...t.matchAll(/%\(([^)]+)\)s/g)].map((m) => m[1]);
  const allowed = new Set(['title', 'id', 'ext', 'upload_date']);
  return fields.every((f) => allowed.has(f));
}, 'outputTemplate may only contain %(title)s, %(id)s, %(ext)s, %(upload_date)s and no ".."');
// Built via RegExp string so both '[' and ']' can appear in the class without
// tripping the regex-literal lint rules; the set is exactly [A-Za-z0-9_+[]:<>=].
const FormatSelectorSchema = z.string().regex(new RegExp('^[A-Za-z0-9_+\\[\\]:<>=]+$'));
const LanguageCodeSchema = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/);

export const YtDlpMetadataRequestSchema = z.object({ url: CleanHttpUrlSchema });
export const YtDlpMetadataResponseSchema = z.object({
  metadata: z.object({
    title: z.string().nullable(),
    uploader: z.string().nullable(),
    durationSeconds: z.number().nullable(),
    thumbnailUrl: z.string().nullable(),
    formats: z.array(z.object({ formatId: z.string(), ext: z.string().nullable(), resolution: z.string().nullable(), filesizeBytes: z.number().int().nullable() })),
  }),
});
export const YtDlpSubtitlesRequestSchema = z.object({ url: CleanHttpUrlSchema, languages: z.array(LanguageCodeSchema).optional() });
export const YtDlpSubtitlesResponseSchema = z.object({
  subtitles: z.array(z.object({ language: z.string(), formats: z.array(z.string()) })),
  automaticCaptions: z.array(z.object({ language: z.string(), formats: z.array(z.string()) })),
});
export const YtDlpDownloadRequestSchema = z.object({
  url: CleanHttpUrlSchema,
  outputScopeId: z.string(),
  outputTemplate: YtDlpOutputTemplateSchema,
  formatSelector: FormatSelectorSchema.optional(),
  subtitles: z.object({ languages: z.array(LanguageCodeSchema), format: z.string().optional() }).optional(),
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
});
export const MediaJobResponseSchema = z.object({ runId: z.string(), outputScopeId: z.string(), outputRelativePath: z.string().optional(), outputTemplate: z.string().optional() });
export const MediaProbeRequestSchema = z.object({ scopeId: z.string(), relativePath: RelativePathSchema });
export const MediaProbeResponseSchema = z.object({
  durationSeconds: z.number().nullable(),
  formatName: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  streams: z.array(z.object({
    index: z.number().int(),
    codecType: z.enum(['video', 'audio', 'subtitle', 'other']),
    codecName: z.string(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    sampleRate: z.number().int().optional(),
    channels: z.number().int().optional(),
    durationSeconds: z.number().optional(),
  })),
});
export const MediaConvertRequestSchema = z.object({
  inputScopeId: z.string(),
  inputRelativePath: RelativePathSchema,
  outputScopeId: z.string(),
  outputRelativePath: RelativePathSchema,
  video: z.object({
    codec: z.enum(['h264', 'vp9', 'copy']).optional(),
    width: z.number().int().positive().max(7680).optional(),
    height: z.number().int().positive().max(4320).optional(),
    bitrateKbps: z.number().int().positive().max(100000).optional(),
  }).optional(),
  audio: z.object({
    codec: z.enum(['aac', 'opus', 'copy']).optional(),
    bitrateKbps: z.number().int().positive().max(100000).optional(),
  }).optional(),
  trim: z.object({ startSeconds: z.number().nonnegative().optional(), endSeconds: z.number().nonnegative().optional() }).optional(),
  overwrite: z.boolean().optional(),
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
}).superRefine((v, ctx) => {
  if (v.trim?.startSeconds !== undefined && v.trim?.endSeconds !== undefined && !(v.trim.startSeconds < v.trim.endSeconds)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'trim.startSeconds must be < trim.endSeconds' });
  }
});
export const MediaTranscribeRequestSchema = z.object({
  inputScopeId: z.string(),
  inputRelativePath: RelativePathSchema,
  modelId: z.string(),
  language: z.union([z.string().regex(/^[a-z]{2}$/), z.literal('auto')]).optional(),
  outputScopeId: z.string(),
  outputRelativePath: RelativePathSchema.optional(),
  outputFormat: z.enum(['text', 'srt', 'vtt', 'json']).optional(),
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
});

export async function ytDlpMetadata(req: z.infer<typeof YtDlpMetadataRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof YtDlpMetadataResponseSchema>>('media_yt_dlp_metadata', YtDlpMetadataRequestSchema.parse(req));
}
export async function ytDlpSubtitles(req: z.infer<typeof YtDlpSubtitlesRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof YtDlpSubtitlesResponseSchema>>('media_yt_dlp_subtitles', YtDlpSubtitlesRequestSchema.parse(req));
}
export async function ytDlpDownload(req: z.infer<typeof YtDlpDownloadRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof MediaJobResponseSchema>>('media_yt_dlp_download', YtDlpDownloadRequestSchema.parse(req));
}
export async function mediaProbe(req: z.infer<typeof MediaProbeRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof MediaProbeResponseSchema>>('media_probe', MediaProbeRequestSchema.parse(req));
}
export async function mediaConvert(req: z.infer<typeof MediaConvertRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof MediaJobResponseSchema>>('media_convert', MediaConvertRequestSchema.parse(req));
}
export async function mediaTranscribe(req: z.infer<typeof MediaTranscribeRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof MediaJobResponseSchema>>('media_transcribe', MediaTranscribeRequestSchema.parse(req));
}

// ---------------------------------------------------------------------------
// §10 — Bridge-mediated AI (FROZEN). Strict schemas: NO key field exists.
// Any apiKey/key/token/secret key in a payload is a VALIDATION_ERROR,
// never silently stripped.
// ---------------------------------------------------------------------------

export const AiMessageSchema = z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1).max(100000) }).strict();
export const AiProviderEnum = z.enum(['openai', 'anthropic', 'openai-compatible']);
function aiBaseUrlRefinement(v: { provider: string; baseUrl?: string | undefined }, ctx: z.RefinementCtx): void {
  if (v.provider === 'openai-compatible') {
    if (!v.baseUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'baseUrl is required for openai-compatible' });
    else if (!isCleanHttpUrl(v.baseUrl) || !v.baseUrl.startsWith('https://')) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'baseUrl must be https without embedded credentials' });
  } else if (v.baseUrl !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'baseUrl is forbidden for named providers' });
  }
}
const AiCompleteBaseShape = {
  service: ServiceNameSchema,
  provider: AiProviderEnum,
  baseUrl: z.string().optional(),
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  messages: z.array(AiMessageSchema).min(1).max(100),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().min(10000).max(600000).optional(),
  namespace: NamespaceSchema.optional(),
  jobId: JobIdSchema.optional(),
};
export const AiCompleteRequestSchema = z.object(AiCompleteBaseShape).strict().superRefine(aiBaseUrlRefinement);
export const AiCompleteResponseSchema = z.object({
  output: z.string(),
  model: z.string(),
  usage: z.object({ inputTokens: z.number().int().optional(), outputTokens: z.number().int().optional() }).nullable(),
  finishReason: z.string().nullable(),
});
export const AiCompleteStreamRequestSchema = z.object({ ...AiCompleteBaseShape, requestId: z.string().optional() }).strict().superRefine(aiBaseUrlRefinement);
export const AiCompleteStreamResponseSchema = z.object({ requestId: z.string() });
export const AiCancelRequestSchema = z.object({ requestId: z.string() });
export const AiCancelResponseSchema = z.object({ requestId: z.string(), cancelled: z.boolean() });
export const AiStatusRequestSchema = z.object({ service: ServiceNameSchema });
export const AiStatusResponseSchema = z.object({ service: z.string(), hasKey: z.boolean() });

export async function aiComplete(req: z.infer<typeof AiCompleteRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof AiCompleteResponseSchema>>('ai_complete', AiCompleteRequestSchema.parse(req));
}
export async function aiCompleteStream(req: z.infer<typeof AiCompleteStreamRequestSchema>) {
  return invokeDesktopCommand<z.infer<typeof AiCompleteStreamResponseSchema>>('ai_complete_stream', AiCompleteStreamRequestSchema.parse(req));
}
export async function aiCancel(requestId: string) {
  return invokeDesktopCommand<z.infer<typeof AiCancelResponseSchema>>('ai_cancel', AiCancelRequestSchema.parse({ requestId }));
}
export async function aiStatus(service: string) {
  return invokeDesktopCommand<z.infer<typeof AiStatusResponseSchema>>('ai_status', AiStatusRequestSchema.parse({ service }));
}

// ---------------------------------------------------------------------------
// §7.6 — Events (FROZEN, exact Tauri event names)
// ---------------------------------------------------------------------------

const EventBaseSchema = z.object({ seq: z.number().int().nonnegative(), emittedAt: z.string().min(1) });
export const ProcessStdoutEventSchema = EventBaseSchema.extend({ runId: z.string(), chunk: z.string(), namespace: z.string().optional(), jobId: z.string().optional() });
export const ProcessStderrEventSchema = ProcessStdoutEventSchema;
export const ProcessExitEventSchema = EventBaseSchema.extend({
  runId: z.string(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  reason: z.enum(['completed', 'cancelled', 'timeout', 'failed']),
  namespace: z.string().optional(),
  jobId: z.string().optional(),
});
export const ArtifactProgressEventSchema = EventBaseSchema.extend({
  artifactId: z.string(),
  kind: z.enum(['binary', 'model']),
  phase: z.enum(['downloading', 'verifying', 'extracting', 'ready', 'failed']),
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nullable(),
  percent: z.number().nullable(),
  error: DesktopBridgeErrorSchema.optional(),
});
export const MediaProgressEventSchema = EventBaseSchema.extend({
  runId: z.string(),
  phase: z.enum(['downloading', 'converting', 'transcribing', 'probing']),
  percent: z.number().nullable(),
  detail: z.string().nullable(),
  namespace: z.string().optional(),
  jobId: z.string().optional(),
});
export const MediaDoneEventSchema = EventBaseSchema.extend({
  runId: z.string(),
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  outputs: z.array(z.object({ scopeId: z.string(), relativePath: z.string() })),
  error: DesktopBridgeErrorSchema.optional(),
  namespace: z.string().optional(),
  jobId: z.string().optional(),
});
export const AiDeltaEventSchema = EventBaseSchema.extend({ requestId: z.string(), delta: z.string(), namespace: z.string().optional(), jobId: z.string().optional() });
export const AiDoneEventSchema = EventBaseSchema.extend({
  requestId: z.string(),
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  output: z.string().nullable(),
  usage: z.object({ inputTokens: z.number().int().optional(), outputTokens: z.number().int().optional() }).nullable(),
  error: DesktopBridgeErrorSchema.optional(),
  namespace: z.string().optional(),
  jobId: z.string().optional(),
});

export const DESKTOP_BRIDGE_EVENTS = [
  'desktop:process:stdout',
  'desktop:process:stderr',
  'desktop:process:exit',
  'desktop:artifact:progress',
  'desktop:media:progress',
  'desktop:media:done',
  'desktop:ai:delta',
  'desktop:ai:done',
] as const;

// ---------------------------------------------------------------------------
// Command index (Appendix A — 52 commands, FROZEN)
// ---------------------------------------------------------------------------

export const DESKTOP_BRIDGE_COMMANDS = [
  'get_shell_info', 'shell_get_start_url', 'shell_remember_tenant', 'shell_forget_tenant', 'shell_retry_connection',
  'handle_window_action', 'open_external_url',
  'dialog_open_file', 'dialog_open_directory', 'dialog_save_file',
  'fs_scope_list', 'fs_scope_revoke',
  'fs_list', 'fs_stat', 'fs_exists', 'fs_read_text', 'fs_write_text', 'fs_mkdir', 'fs_delete', 'fs_copy', 'fs_move',
  'process_spawn', 'process_write_stdin', 'process_cancel', 'process_status', 'process_list',
  'binary_list', 'binary_status', 'binary_ensure', 'binary_verify', 'binary_remove', 'binary_cancel_download',
  'sidecar_model_list', 'sidecar_model_status', 'sidecar_model_ensure', 'sidecar_model_remove', 'sidecar_model_cancel_download',
  'secrets_set', 'secrets_get', 'secrets_has', 'secrets_list', 'secrets_delete',
  'media_yt_dlp_metadata', 'media_yt_dlp_subtitles', 'media_yt_dlp_download', 'media_probe', 'media_convert', 'media_transcribe',
  'ai_complete', 'ai_complete_stream', 'ai_cancel', 'ai_status',
] as const;
export type DesktopBridgeCommand = (typeof DESKTOP_BRIDGE_COMMANDS)[number];

/** Request-schema registry used by the fixture suite (and feature tests). */
export const DESKTOP_BRIDGE_REQUEST_SCHEMAS: Record<string, z.ZodTypeAny> = {
  dialog_open_file: DialogOpenFileRequestSchema,
  dialog_open_directory: DialogOpenDirectoryRequestSchema,
  dialog_save_file: DialogSaveFileRequestSchema,
  fs_scope_revoke: FsScopeRevokeRequestSchema,
  fs_list: FsListRequestSchema,
  fs_stat: FsStatRequestSchema,
  fs_exists: FsExistsRequestSchema,
  fs_read_text: FsReadTextRequestSchema,
  fs_write_text: FsWriteTextRequestSchema,
  fs_mkdir: FsMkdirRequestSchema,
  fs_delete: FsDeleteRequestSchema,
  fs_copy: FsCopyRequestSchema,
  fs_move: FsMoveRequestSchema,
  process_spawn: ProcessSpawnRequestSchema,
  process_write_stdin: ProcessWriteStdinRequestSchema,
  process_cancel: ProcessCancelRequestSchema,
  process_status: ProcessStatusRequestSchema,
  binary_status: BinaryStatusRequestSchema,
  binary_verify: BinaryStatusRequestSchema,
  binary_remove: BinaryStatusRequestSchema,
  binary_cancel_download: BinaryStatusRequestSchema,
  binary_ensure: BinaryEnsureRequestSchema,
  sidecar_model_status: SidecarModelStatusRequestSchema,
  sidecar_model_remove: SidecarModelStatusRequestSchema,
  sidecar_model_cancel_download: SidecarModelStatusRequestSchema,
  sidecar_model_ensure: SidecarModelEnsureRequestSchema,
  secrets_set: SecretsSetRequestSchema,
  secrets_get: SecretsKeyRequestSchema,
  secrets_has: SecretsKeyRequestSchema,
  secrets_list: SecretsListRequestSchema,
  secrets_delete: SecretsKeyRequestSchema,
  media_yt_dlp_metadata: YtDlpMetadataRequestSchema,
  media_yt_dlp_subtitles: YtDlpSubtitlesRequestSchema,
  media_yt_dlp_download: YtDlpDownloadRequestSchema,
  media_probe: MediaProbeRequestSchema,
  media_convert: MediaConvertRequestSchema,
  media_transcribe: MediaTranscribeRequestSchema,
  ai_complete: AiCompleteRequestSchema,
  ai_complete_stream: AiCompleteStreamRequestSchema,
  ai_cancel: AiCancelRequestSchema,
  ai_status: AiStatusRequestSchema,
  shell_remember_tenant: RememberTenantRequestSchema,
};
