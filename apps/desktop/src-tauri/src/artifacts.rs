//! §8 artifact manager (binaries + Whisper models, one lifecycle).
//! Invariants: pinned version only (never `latest`); SHA-256 verified before
//! install; atomic rename into the version dir; the `.verified` marker is
//! written LAST, so a crashed install can never yield `ready`; a checksum
//! mismatch deletes the download and never installs it; one download per
//! artifact is coalesced by the handler layer (see commands_artifact.rs).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::errors::{BridgeError, BridgeResult};
use crate::validation::is_clean_http_url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactAsset {
    pub platform: String,
    pub url: String,
    pub sha256: String,
    pub archive_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary_names: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactManifestEntry {
    pub artifact_id: String,
    pub kind: String, // "binary" | "model"
    pub version: String,
    pub description: String,
    pub assets: Vec<ArtifactAsset>,
}

/// Manifest validation (§8.1): pinned version, https URL without userinfo,
/// 64-hex SHA-256 on every asset, at least one asset.
pub fn validate_manifest_entry(entry: &ArtifactManifestEntry) -> BridgeResult<()> {
    if entry.version.is_empty() || entry.version == "latest" || entry.version.contains('*') || entry.version.contains(' ') {
        return Err(BridgeError::validation("artifact version must be pinned, never \"latest\" or floating"));
    }
    if entry.assets.is_empty() {
        return Err(BridgeError::validation("artifact entry must have at least one platform asset"));
    }
    for asset in &entry.assets {
        if !is_clean_http_url(&asset.url) || !asset.url.starts_with("https://") {
            return Err(BridgeError::validation("artifact URL must be https without embedded credentials"));
        }
        if asset.sha256.len() != 64 || !asset.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(BridgeError::validation("artifact sha256 must be 64 hex chars"));
        }
    }
    Ok(())
}

pub fn current_platform() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "macos-arm64";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "macos-x64";
    #[cfg(target_os = "windows")]
    return "windows-x64";
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "linux-x64";
    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        target_os = "windows",
        all(target_os = "linux", target_arch = "x86_64")
    )))]
    return "unsupported";
}

pub fn asset_for_platform<'a>(entry: &'a ArtifactManifestEntry, platform: &str) -> Option<&'a ArtifactAsset> {
    entry.assets.iter().find(|a| a.platform == platform)
}

/// SHA-256 hex digest of a file, streamed (never whole-file in memory).
pub fn sha256_file(path: &Path) -> BridgeResult<String> {
    let mut file = std::fs::File::open(path).map_err(crate::errors::io_to_bridge_error)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|_| BridgeError::internal("Failed to read file for verification"))?;
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn verify_file_hash(path: &Path, expected_sha256: &str) -> BridgeResult<()> {
    let actual = sha256_file(path)?;
    if actual.eq_ignore_ascii_case(expected_sha256) {
        Ok(())
    } else {
        Err(BridgeError::validation("checksum mismatch"))
    }
}

/// Cache layout: `<cache>/artifacts/<id>/<version>/` + `<id>/<version>.verified`.
pub fn artifact_dir(cache: &Path, artifact_id: &str, version: &str) -> PathBuf {
    cache.join("artifacts").join(artifact_id).join(version)
}
pub fn verified_marker(cache: &Path, artifact_id: &str, version: &str) -> PathBuf {
    cache.join("artifacts").join(artifact_id).join(format!("{version}.verified"))
}
pub fn is_ready(cache: &Path, artifact_id: &str, version: &str) -> bool {
    verified_marker(cache, artifact_id, version).exists() && artifact_dir(cache, artifact_id, version).is_dir()
}

/// Atomic install: move `staging` into the version dir (replacing any prior
/// partial dir), then write the `.verified` marker LAST. Callers verify the
/// hash and the expected binary names BEFORE calling this.
pub fn atomic_install(cache: &Path, artifact_id: &str, version: &str, staging: &Path) -> BridgeResult<()> {
    let dest = artifact_dir(cache, artifact_id, version);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(crate::errors::io_to_bridge_error)?;
    }
    if dest.exists() {
        std::fs::remove_dir_all(&dest).map_err(crate::errors::io_to_bridge_error)?;
    }
    std::fs::rename(staging, &dest).map_err(crate::errors::io_to_bridge_error)?;
    // NOTE: executable bits are the installer's job (commands_artifact sets
    // +x on binary_names after install); this function only guarantees the
    // marker is written LAST, after the rename has succeeded.
    std::fs::write(verified_marker(cache, artifact_id, version), b"verified\n").map_err(crate::errors::io_to_bridge_error)?;
    Ok(())
}

pub fn remove_artifact(cache: &Path, artifact_id: &str, version: &str) -> BridgeResult<()> {
    let dest = artifact_dir(cache, artifact_id, version);
    if dest.exists() {
        std::fs::remove_dir_all(&dest).map_err(crate::errors::io_to_bridge_error)?;
    }
    let marker = verified_marker(cache, artifact_id, version);
    if marker.exists() {
        let _ = std::fs::remove_file(&marker);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactState {
    Missing,
    Downloading,
    Ready,
    Corrupt,
    Error,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(sha: &str, version: &str, url: &str) -> ArtifactManifestEntry {
        ArtifactManifestEntry {
            artifact_id: "yt-dlp".into(),
            kind: "binary".into(),
            version: version.into(),
            description: "test".into(),
            assets: vec![ArtifactAsset { platform: "linux-x64".into(), url: url.into(), sha256: sha.into(), archive_kind: "none".into(), binary_names: Some(vec!["yt-dlp".into()]) }],
        }
    }

    #[test]
    fn manifest_validation_cases() {
        assert!(validate_manifest_entry(&entry(&"a".repeat(64), "2025.01.01", "https://example.com/yt-dlp")).is_ok());
        assert!(validate_manifest_entry(&entry(&"a".repeat(64), "latest", "https://example.com/yt-dlp")).is_err());
        assert!(validate_manifest_entry(&entry("short", "2025.01.01", "https://example.com/yt-dlp")).is_err());
        assert!(validate_manifest_entry(&entry(&"a".repeat(64), "2025.01.01", "http://example.com/yt-dlp")).is_err());
        assert!(validate_manifest_entry(&entry(&"a".repeat(64), "2025.01.01", "https://user:p@example.com/yt-dlp")).is_err());
    }

    #[test]
    fn checksum_match_mismatch_and_truncation() {
        let dir = std::env::temp_dir().join(format!("fbup-hash-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("bin");
        std::fs::write(&file, b"hello world").unwrap();
        let digest = sha256_file(&file).unwrap();
        assert_eq!(digest.len(), 64);
        assert!(verify_file_hash(&file, &digest).is_ok());
        assert!(verify_file_hash(&file, &"0".repeat(64)).is_err());
        // Truncated file no longer matches the original digest.
        std::fs::write(&file, b"hello").unwrap();
        assert!(verify_file_hash(&file, &digest).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn marker_last_invariant() {
        let dir = std::env::temp_dir().join(format!("fbup-install-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(!is_ready(&dir, "yt-dlp", "1.0"));
        let staging = dir.join("staging");
        std::fs::create_dir_all(&staging).unwrap();
        std::fs::write(staging.join("yt-dlp"), b"fake-binary").unwrap();
        atomic_install(&dir, "yt-dlp", "1.0", &staging).unwrap();
        assert!(is_ready(&dir, "yt-dlp", "1.0"));
        assert!(!staging.exists()); // renamed, not copied
        remove_artifact(&dir, "yt-dlp", "1.0").unwrap();
        assert!(!is_ready(&dir, "yt-dlp", "1.0"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
