//! Command payload/response structs (binary crate). These mirror
//! `packages/contracts/src/domain/desktop-bridge.ts` field-for-field; the
//! shared JSON fixtures under `apps/desktop/tests/fixtures/` are parsed by
//! both suites, so a drift fails in CI. Wire JSON is camelCase.
//! AI requests use `deny_unknown_fields` (spec §10.2): a renderer-supplied
//! key field is a validation error, never silently stripped.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- core (§7.3) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfoResponse {
    pub app_name: String,
    pub version: String,
    pub bridge_version: String,
    pub platform: String,
    pub arch: String,
    pub frameless: bool,
    pub window: WindowGeometry,
    pub capabilities: Capabilities,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowGeometry {
    pub default_width: u32,
    pub default_height: u32,
    pub min_width: u32,
    pub min_height: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub filesystem: bool,
    pub process: bool,
    pub dialogs: bool,
    pub secrets: bool,
    pub artifacts: bool,
    pub media: bool,
    pub ai: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartUrlResponse {
    pub url: String,
    pub source: String,
    pub tenant_subdomain: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RememberTenantPayload {
    pub subdomain: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RememberTenantResponse {
    pub subdomain: String,
    pub stored: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForgetTenantResponse {
    pub forgotten: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryConnectionResponse {
    pub reachable: bool,
    pub url: String,
}
// Legacy bare shapes (frozen exception, §7.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowActionResponse {
    pub action: String,
    pub applied: bool,
    pub maximized: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenExternalUrlResponse {
    pub opened: bool,
    pub url: String,
}

// --- dialogs + filesystem (§7.4) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DialogOpenFilePayload {
    pub title: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
    pub multiple: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogFile {
    pub path: String,
    pub scope_id: String,
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogOpenFileResponse {
    pub files: Vec<DialogFile>,
    pub cancelled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DialogOpenDirectoryPayload {
    pub title: Option<String>,
    pub multiple: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogDirectory {
    pub path: String,
    pub scope_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogOpenDirectoryResponse {
    pub directories: Vec<DialogDirectory>,
    pub cancelled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DialogSaveFilePayload {
    pub title: Option<String>,
    pub default_name: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogSaveFileResponse {
    pub path: Option<String>,
    pub scope_id: Option<String>,
    pub cancelled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeInfo {
    pub scope_id: String,
    pub kind: String,
    pub path: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeListResponse {
    pub scopes: Vec<ScopeInfo>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeRevokePayload {
    pub scope_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeRevokeResponse {
    pub scope_id: String,
    pub revoked: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FsListPayload {
    pub scope_id: String,
    pub relative_path: Option<String>,
    pub recursive: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub relative_path: String,
    pub kind: String,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsListResponse {
    pub entries: Vec<FsEntry>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FsPathPayload {
    pub scope_id: String,
    pub relative_path: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsStatResponse {
    pub kind: String,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub relative_path: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsExistsResponse {
    pub exists: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FsReadTextPayload {
    pub scope_id: String,
    pub relative_path: Option<String>,
    pub max_bytes: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsReadTextResponse {
    pub content: String,
    pub truncated: bool,
    pub size_bytes: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsWriteTextPayload {
    pub scope_id: String,
    pub relative_path: String,
    pub content: String,
    #[serde(default)]
    pub create_parents: Option<bool>,
    #[serde(default)]
    pub overwrite: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsWriteTextResponse {
    pub relative_path: String,
    pub size_bytes: u64,
    pub overwritten: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsMkdirPayload {
    pub scope_id: String,
    pub relative_path: String,
    #[serde(default)]
    pub recursive: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsMkdirResponse {
    pub relative_path: String,
    pub created: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsDeletePayload {
    pub scope_id: String,
    pub relative_path: String,
    #[serde(default)]
    pub recursive: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsDeleteResponse {
    pub relative_path: String,
    pub deleted: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsCopyPayload {
    pub source_scope_id: String,
    pub source_relative_path: String,
    pub dest_scope_id: String,
    pub dest_relative_path: String,
    #[serde(default)]
    pub overwrite: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsCopyResponse {
    pub dest_relative_path: String,
    pub size_bytes: u64,
}

// --- processes (§7.5) ---
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ProcessSpawnPayload {
    pub run_id: Option<String>,
    pub binary_id: String,
    pub args: Vec<String>,
    pub cwd_scope_id: Option<String>,
    pub cwd_relative_path: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub timeout_ms: Option<u64>,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessSpawnResponse {
    pub run_id: String,
    pub pid: u32,
    pub binary_id: String,
    pub started_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessWriteStdinPayload {
    pub run_id: String,
    pub data: String,
    #[serde(default)]
    pub close: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessWriteStdinResponse {
    pub run_id: String,
    pub written: bool,
    pub closed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ProcessCancelPayload {
    pub run_id: String,
    pub mode: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCancelResponse {
    pub run_id: String,
    pub state: String,
    pub already_exited: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStatusPayload {
    pub run_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStatusResponse {
    pub run_id: String,
    pub state: String,
    pub exit_code: Option<i32>,
    pub started_at: String,
    pub ended_at: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessListEntry {
    pub run_id: String,
    pub binary_id: String,
    pub state: String,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
    pub started_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessListResponse {
    pub processes: Vec<ProcessListEntry>,
}

// --- artifacts (§8.2) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactStatusWire {
    pub artifact_id: String,
    pub kind: String,
    pub state: String,
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<fbuploadpro_desktop::errors::BridgeError>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactListResponse {
    pub artifacts: Vec<ArtifactStatusWire>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactStatusResponse {
    pub artifact: ArtifactStatusWire,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct BinaryIdPayload {
    pub binary_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct BinaryEnsurePayload {
    pub binary_id: String,
    pub version: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ModelIdPayload {
    pub model_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ModelEnsurePayload {
    pub model_id: String,
    pub version: Option<String>,
}

// --- secrets (§8.3) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsSetPayload {
    pub service: String,
    pub key_name: String,
    pub value: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsKeyPayload {
    pub service: String,
    pub key_name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsSetResponse {
    pub service: String,
    pub key_name: String,
    pub stored: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsGetResponse {
    pub service: String,
    pub key_name: String,
    pub value: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsHasResponse {
    pub service: String,
    pub key_name: String,
    pub present: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsListPayload {
    pub service: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsListResponse {
    pub service: String,
    pub key_names: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsDeleteResponse {
    pub service: String,
    pub key_name: String,
    pub deleted: bool,
}

// --- media (§9) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpMetadataPayload {
    pub url: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpMetadataResponse {
    pub metadata: fbuploadpro_desktop::media::YtDlpMetadata,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct YtDlpSubtitlesPayload {
    pub url: String,
    pub languages: Option<Vec<String>>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpSubtitlesResponse {
    pub subtitles: Vec<fbuploadpro_desktop::media::SubtitleEntry>,
    pub automatic_captions: Vec<fbuploadpro_desktop::media::SubtitleEntry>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct YtDlpDownloadPayload {
    pub url: String,
    pub output_scope_id: String,
    pub output_template: String,
    pub format_selector: Option<String>,
    pub subtitles: Option<DownloadSubtitles>,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSubtitles {
    pub languages: Vec<String>,
    pub format: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaJobDownloadResponse {
    pub run_id: String,
    pub output_scope_id: String,
    pub output_template: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbePayload {
    pub scope_id: String,
    pub relative_path: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbeResponse {
    pub duration_seconds: Option<f64>,
    pub format_name: Option<String>,
    pub size_bytes: Option<i64>,
    pub streams: Vec<fbuploadpro_desktop::media::ProbeStream>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaConvertPayload {
    pub input_scope_id: String,
    pub input_relative_path: String,
    pub output_scope_id: String,
    pub output_relative_path: String,
    pub video: Option<ConvertVideoWire>,
    pub audio: Option<ConvertAudioWire>,
    pub trim: Option<ConvertTrimWire>,
    pub overwrite: Option<bool>,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ConvertVideoWire {
    pub codec: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub bitrate_kbps: Option<u32>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ConvertAudioWire {
    pub codec: Option<String>,
    pub bitrate_kbps: Option<u32>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ConvertTrimWire {
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaJobResponse {
    pub run_id: String,
    pub output_scope_id: String,
    pub output_relative_path: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaTranscribePayload {
    pub input_scope_id: String,
    pub input_relative_path: String,
    pub model_id: String,
    pub language: Option<String>,
    pub output_scope_id: String,
    pub output_relative_path: Option<String>,
    pub output_format: Option<String>,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
}

// --- AI (§10.4, strict: deny_unknown_fields) ---
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiMessageWire {
    pub role: String,
    pub content: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiCompletePayload {
    pub service: String,
    pub provider: String,
    #[serde(default)]
    pub base_url: Option<String>,
    pub model: String,
    pub messages: Vec<AiMessageWire>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub namespace: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiCompleteStreamPayload {
    pub service: String,
    pub provider: String,
    #[serde(default)]
    pub base_url: Option<String>,
    pub model: String,
    pub messages: Vec<AiMessageWire>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub namespace: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub request_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCompleteResponse {
    pub output: String,
    pub model: String,
    pub usage: Option<AiUsageWire>,
    pub finish_reason: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiUsageWire {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamResponse {
    pub request_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCancelPayload {
    pub request_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCancelResponse {
    pub request_id: String,
    pub cancelled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatusPayload {
    pub service: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatusResponse {
    pub service: String,
    pub has_key: bool,
}

// --- events (§7.6, emitted via AppHandle) ---
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStdoutEvent {
    pub run_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub chunk: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessExitEvent {
    pub run_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub exit_code: Option<i32>,
    pub signal: Option<String>,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactProgressEvent {
    pub artifact_id: String,
    pub kind: String,
    pub seq: u64,
    pub emitted_at: String,
    pub phase: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<fbuploadpro_desktop::errors::BridgeError>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProgressEvent {
    pub run_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub phase: String,
    pub percent: Option<f64>,
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaOutputRef {
    pub scope_id: String,
    pub relative_path: String,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDoneEvent {
    pub run_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub status: String,
    pub outputs: Vec<MediaOutputRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<fbuploadpro_desktop::errors::BridgeError>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDeltaEvent {
    pub request_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub delta: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDoneEvent {
    pub request_id: String,
    pub seq: u64,
    pub emitted_at: String,
    pub status: String,
    pub output: Option<String>,
    pub usage: Option<AiUsageWire>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<fbuploadpro_desktop::errors::BridgeError>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}
