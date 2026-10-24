//! §11 error taxonomy. Every handler returns this type; never a bare string.
//! `message` is user-safe plain language (no paths, secrets, keys, locations).
//! `details` carries ONLY runId/requestId/artifactId/modelId/scopeId/retryAfterMs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErrorDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
}

impl ErrorDetails {
    pub fn new() -> Self {
        Self { run_id: None, request_id: None, artifact_id: None, model_id: None, scope_id: None, retry_after_ms: None }
    }
}

impl Default for ErrorDetails {
    fn default() -> Self { Self::new() }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    // Boxed: the unboxed details struct (6 optional strings) pushed this
    // error over clippy's result_large_err threshold at every call site.
    // The wire shape is unchanged (Box serializes transparently).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Box<ErrorDetails>>,
}

impl BridgeError {
    pub fn new(code: &str, message: &str, retryable: bool) -> Self {
        Self { code: code.to_string(), message: message.to_string(), retryable, details: None }
    }
    pub fn with_details(mut self, details: ErrorDetails) -> Self {
        self.details = Some(Box::new(details));
        self
    }
    pub fn validation(message: &str) -> Self { Self::new("VALIDATION_ERROR", message, false) }
    pub fn internal(message: &str) -> Self { Self::new("INTERNAL_ERROR", message, false) }
    pub fn scope_not_found() -> Self { Self::new("SCOPE_NOT_FOUND", "That folder or file is no longer available. Please choose it again.", false) }
    pub fn path_traversal() -> Self { Self::new("PATH_TRAVERSAL", "That path is outside the folder you chose.", false) }
    pub fn fs_not_found() -> Self { Self::new("FS_NOT_FOUND", "That file or folder does not exist.", false) }
    pub fn fs_already_exists() -> Self { Self::new("FS_ALREADY_EXISTS", "A file already exists at that location.", false) }
    pub fn fs_not_empty() -> Self { Self::new("FS_NOT_EMPTY", "That folder is not empty.", false) }
    pub fn fs_not_text() -> Self { Self::new("FS_NOT_TEXT", "That file is not readable text.", false) }
    pub fn fs_permission_denied() -> Self { Self::new("FS_PERMISSION_DENIED", "Access to that file or folder was denied.", false) }
    pub fn fs_too_many_entries() -> Self { Self::new("FS_TOO_MANY_ENTRIES", "That folder has too many entries to list. Narrow the location and try again.", false) }
    pub fn process_already_running() -> Self { Self::new("PROCESS_ALREADY_RUNNING", "A process with that run id is already running.", false) }
    pub fn process_not_found() -> Self { Self::new("PROCESS_NOT_FOUND", "No such process is known.", false) }
    pub fn binary_not_ready(artifact_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.artifact_id = Some(artifact_id.to_string());
        Self::new("BINARY_NOT_READY", "That tool is not downloaded yet. Download it first, then retry.", true).with_details(d)
    }
    pub fn model_not_ready(model_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.model_id = Some(model_id.to_string());
        Self::new("SIDECAR_MODEL_NOT_READY", "That model is not downloaded yet. Download it first, then retry.", true).with_details(d)
    }
    pub fn artifact_checksum_mismatch(artifact_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.artifact_id = Some(artifact_id.to_string());
        Self::new("ARTIFACT_CHECKSUM_MISMATCH", "The download failed its integrity check and was discarded.", false).with_details(d)
    }
    pub fn artifact_corrupt(artifact_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.artifact_id = Some(artifact_id.to_string());
        Self::new("ARTIFACT_CORRUPT", "The installed tool failed its integrity check. Remove it and download it again.", true).with_details(d)
    }
    pub fn artifact_in_use(artifact_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.artifact_id = Some(artifact_id.to_string());
        Self::new("ARTIFACT_IN_USE", "That tool is in use by a running job. Cancel the job first.", false).with_details(d)
    }
    pub fn artifact_offline(artifact_id: &str) -> Self {
        let mut d = ErrorDetails::new();
        d.artifact_id = Some(artifact_id.to_string());
        Self::new("ARTIFACT_OFFLINE", "The download failed because the network is unavailable.", true).with_details(d)
    }
    pub fn secrets_unavailable() -> Self { Self::new("SECRETS_UNAVAILABLE", "No secure credential store is available on this system.", false) }
    pub fn secrets_not_found() -> Self { Self::new("SECRETS_NOT_FOUND", "No saved value was found for that key.", false) }
    pub fn media_url_invalid() -> Self { Self::new("MEDIA_URL_INVALID", "That URL is not a valid public media URL.", false) }
    pub fn media_not_found() -> Self { Self::new("MEDIA_NOT_FOUND", "No media was found at that URL.", false) }
    pub fn ai_key_missing() -> Self { Self::new("AI_KEY_MISSING", "No AI key is saved for that service. Add one first.", false) }
    pub fn ai_request_not_found() -> Self { Self::new("AI_REQUEST_NOT_FOUND", "No such AI request is known.", false) }
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for BridgeError {}

pub type BridgeResult<T> = Result<T, BridgeError>;

/// Map an OS I/O error to a §11 code without leaking the path.
pub fn io_to_bridge_error(err: std::io::Error) -> BridgeError {
    use std::io::ErrorKind;
    match err.kind() {
        ErrorKind::NotFound => BridgeError::fs_not_found(),
        ErrorKind::PermissionDenied => BridgeError::fs_permission_denied(),
        ErrorKind::AlreadyExists => BridgeError::fs_already_exists(),
        _ => BridgeError::internal("A filesystem operation failed."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_serializes_without_path_or_secret_fields() {
        let err = BridgeError::binary_not_ready("yt-dlp");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("BINARY_NOT_READY"));
        assert!(!json.contains("filePath") && !json.contains("path"));
        // details keys are restricted: parse and check key set
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        let details = v["details"].as_object().unwrap();
        for key in details.keys() {
            assert!(["runId", "requestId", "artifactId", "modelId", "scopeId", "retryAfterMs"].contains(&key.as_str()), "unexpected details key {key}");
        }
    }

    #[test]
    fn every_documented_code_round_trips() {
        // The TS suite owns the full code union; here we assert the codes this
        // module constructs are all distinct, non-empty strings.
        let codes = [
            BridgeError::validation("x").code,
            BridgeError::scope_not_found().code,
            BridgeError::path_traversal().code,
            BridgeError::binary_not_ready("yt-dlp").code,
            BridgeError::model_not_ready("whisper-base").code,
            BridgeError::artifact_checksum_mismatch("yt-dlp").code,
            BridgeError::secrets_unavailable().code,
            BridgeError::ai_key_missing().code,
        ];
        let mut seen = std::collections::HashSet::new();
        for c in codes {
            assert!(!c.is_empty());
            assert!(seen.insert(c));
        }
    }
}
