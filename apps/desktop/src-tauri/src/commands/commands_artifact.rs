//! §8.2 artifact commands: download -> SHA-256 verify -> extract -> atomic
//! install -> `.verified` marker last. Mismatch deletes the download and
//! never installs it. One download per artifact is coalesced (a second
//! ensure while downloading returns the current `downloading` status).
//! No hidden auto-downloads: media/process commands gate on `ready` and
//! return BINARY_NOT_READY / SIDECAR_MODEL_NOT_READY instead.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use fbuploadpro_desktop::artifacts::{
    artifact_dir, asset_for_platform, atomic_install, current_platform, remove_artifact, sha256_file, validate_manifest_entry,
    verified_marker, ArtifactManifestEntry,
};
use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::processes::iso_now;
use tauri::{AppHandle, Emitter, State};

use super::manifest_data::{manifest_entries, manifest_entry};
use super::state::AppState;
use super::types::*;

#[derive(Debug, Clone)]
pub enum DownloadPhase {
    Downloading,
    Failed(BridgeError),
}

#[derive(Debug, Clone)]
pub struct DownloadState {
    pub phase: DownloadPhase,
    pub cancel: Arc<AtomicBool>,
}

fn corrupt_marker(cache: &Path, artifact_id: &str, version: &str) -> PathBuf {
    cache.join("artifacts").join(artifact_id).join(format!("{version}.corrupt"))
}

fn status_for(state: &AppState, entry: &ArtifactManifestEntry) -> ArtifactStatusWire {
    let cache = state.artifact_cache_dir();
    if corrupt_marker(&cache, &entry.artifact_id, &entry.version).exists() {
        return ArtifactStatusWire {
            artifact_id: entry.artifact_id.clone(),
            kind: entry.kind.clone(),
            state: "corrupt".to_string(),
            version: None,
            error: Some(BridgeError::artifact_corrupt(&entry.artifact_id)),
        };
    }
    let downloads = state.artifact_downloads.lock().unwrap();
    if let Some(dl) = downloads.get(&entry.artifact_id) {
        match &dl.phase {
            DownloadPhase::Downloading => {
                return ArtifactStatusWire { artifact_id: entry.artifact_id.clone(), kind: entry.kind.clone(), state: "downloading".to_string(), version: Some(entry.version.clone()), error: None };
            }
            DownloadPhase::Failed(err) => {
                return ArtifactStatusWire { artifact_id: entry.artifact_id.clone(), kind: entry.kind.clone(), state: "error".to_string(), version: None, error: Some(err.clone()) };
            }
        }
    }
    drop(downloads);
    let marker = verified_marker(&cache, &entry.artifact_id, &entry.version);
    let dir = artifact_dir(&cache, &entry.artifact_id, &entry.version);
    if marker.exists() && dir.is_dir() {
        // A ready marker with missing expected files is corrupt, not ready.
        if expected_files_present(&cache, entry) {
            ArtifactStatusWire { artifact_id: entry.artifact_id.clone(), kind: entry.kind.clone(), state: "ready".to_string(), version: Some(entry.version.clone()), error: None }
        } else {
            ArtifactStatusWire {
                artifact_id: entry.artifact_id.clone(),
                kind: entry.kind.clone(),
                state: "corrupt".to_string(),
                version: None,
                error: Some(BridgeError::artifact_corrupt(&entry.artifact_id)),
            }
        }
    } else {
        ArtifactStatusWire { artifact_id: entry.artifact_id.clone(), kind: entry.kind.clone(), state: "missing".to_string(), version: None, error: None }
    }
}

fn expected_files_present(cache: &Path, entry: &ArtifactManifestEntry) -> bool {
    let dir = artifact_dir(cache, &entry.artifact_id, &entry.version);
    let Some(asset) = asset_for_platform(entry, current_platform()) else {
        return false;
    };
    match entry.kind.as_str() {
        "model" => dir.is_dir() && std::fs::read_dir(&dir).map(|mut d| d.next().is_some()).unwrap_or(false),
        _ => {
            let names = asset.binary_names.clone().unwrap_or_else(|| vec![entry.artifact_id.clone()]);
            names.iter().all(|n| {
                dir.join(n).exists()
                    || (cfg!(windows) && dir.join(format!("{n}.exe")).exists())
            })
        }
    }
}

/// Resolve the executable path for a ready binary (ffprobe -> ffmpeg bundle).
/// Returns BINARY_NOT_READY when not ready, ARTIFACT_CORRUPT when the marker
/// exists but the file is missing.
pub fn artifact_binary_path(cache: &Path, entry: &ArtifactManifestEntry, binary_id: &str) -> BridgeResult<PathBuf> {
    let dir = artifact_dir(cache, &entry.artifact_id, &entry.version);
    let marker = verified_marker(cache, &entry.artifact_id, &entry.version);
    if !marker.exists() || !dir.is_dir() {
        return Err(BridgeError::binary_not_ready(&entry.artifact_id));
    }
    let candidates: Vec<PathBuf> = if cfg!(windows) {
        vec![dir.join(format!("{binary_id}.exe")), dir.join(binary_id)]
    } else {
        vec![dir.join(binary_id)]
    };
    for c in candidates {
        if c.is_file() {
            return Ok(c);
        }
    }
    Err(BridgeError::artifact_corrupt(&entry.artifact_id))
}

/// Resolve a ready model file path (first file in the version dir).
pub fn artifact_model_path(cache: &Path, entry: &ArtifactManifestEntry) -> BridgeResult<PathBuf> {
    let dir = artifact_dir(cache, &entry.artifact_id, &entry.version);
    let marker = verified_marker(cache, &entry.artifact_id, &entry.version);
    if !marker.exists() || !dir.is_dir() {
        return Err(BridgeError::model_not_ready(&entry.artifact_id));
    }
    let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
        .map_err(|_| BridgeError::artifact_corrupt(&entry.artifact_id))?
        .filter_map(|e| e.ok().map(|x| x.path()))
        .filter(|p| p.is_file())
        .collect();
    files.sort();
    files.into_iter().next().ok_or_else(|| BridgeError::artifact_corrupt(&entry.artifact_id))
}

#[allow(clippy::too_many_arguments)] // Event-emission plumbing; the tuple would hide the field order.
fn emit_progress(handle: &AppHandle, artifact_id: &str, kind: &str, seq: u64, phase: &str, downloaded: u64, total: Option<u64>, error: Option<BridgeError>) {
    let percent = total.and_then(|t| if t > 0 { Some(downloaded as f64 / t as f64 * 100.0) } else { None });
    let _ = handle.emit(
        "desktop:artifact:progress",
        ArtifactProgressEvent {
            artifact_id: artifact_id.to_string(),
            kind: kind.to_string(),
            seq,
            emitted_at: iso_now(),
            phase: phase.to_string(),
            downloaded_bytes: downloaded,
            total_bytes: total,
            percent,
            error,
        },
    );
}

fn start_download(app: AppHandle, state: &AppState, entry: ArtifactManifestEntry) {
    let cache = state.artifact_cache_dir();
    let cancel = Arc::new(AtomicBool::new(false));
    let downloads = Arc::clone(&state.artifact_downloads);
    {
        let mut guard = downloads.lock().unwrap();
        guard.insert(entry.artifact_id.clone(), DownloadState { phase: DownloadPhase::Downloading, cancel: cancel.clone() });
    }
    std::thread::spawn(move || {
        let seq = Arc::new(AtomicU64::new(0));
        let next_seq = || seq.fetch_add(1, Ordering::SeqCst);
        let result = download_and_install(&app, &cache, &entry, &cancel, &next_seq);
        match result {
            Ok(()) => {
                // Success: drop the downloading entry so status_for falls
                // through to the marker check (ready), and clear any stale
                // corrupt marker from a previous damaged install.
                downloads.lock().unwrap().remove(&entry.artifact_id);
                let _ = std::fs::remove_file(corrupt_marker(&cache, &entry.artifact_id, &entry.version));
                emit_progress(&app, &entry.artifact_id, &entry.kind, next_seq(), "ready", 0, None, None);
            }
            Err(err) => {
                let cancelled = err.code == "ARTIFACT_CANCELLED";
                if cancelled {
                    downloads.lock().unwrap().remove(&entry.artifact_id);
                } else {
                    downloads.lock().unwrap().insert(
                        entry.artifact_id.clone(),
                        DownloadState { phase: DownloadPhase::Failed(err.clone()), cancel: cancel.clone() },
                    );
                }
                emit_progress(&app, &entry.artifact_id, &entry.kind, next_seq(), "failed", 0, None, Some(err));
            }
        }
    });
}

fn download_and_install(
    app: &AppHandle,
    cache: &Path,
    entry: &ArtifactManifestEntry,
    cancel: &AtomicBool,
    next_seq: &dyn Fn() -> u64,
) -> BridgeResult<()> {
    let asset = asset_for_platform(entry, current_platform())
        .ok_or_else(|| BridgeError::new("ARTIFACT_UNSUPPORTED_PLATFORM", "No build of that tool exists for this platform.", false))?;
    validate_manifest_entry(entry)?;
    let tmp_path = cache.join("artifacts").join(format!(".{}.part", entry.artifact_id));
    if let Some(parent) = tmp_path.parent() {
        std::fs::create_dir_all(parent).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    }
    // Restart semantics (spec §8.2): resume is an optimisation; a fresh
    // download is always correct, so a stale partial file is discarded.
    let _ = std::fs::remove_file(&tmp_path);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|_| BridgeError::artifact_offline(&entry.artifact_id))?;
    let mut resp = client.get(&asset.url).send().map_err(|_| BridgeError::artifact_offline(&entry.artifact_id))?;
    if !resp.status().is_success() {
        return Err(BridgeError::artifact_offline(&entry.artifact_id));
    }
    let total = resp.content_length();
    let mut file = std::fs::File::create(&tmp_path).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    let mut downloaded: u64 = 0;
    // The blocking response implements `Read` (there is no `chunk()` on
    // the blocking API): stream it in 64 KiB reads so progress events
    // fire during the download instead of only at the end.
    use std::io::Read as _;
    let mut read_buf = vec![0u8; 65536];
    loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(BridgeError::new("ARTIFACT_CANCELLED", "The download was cancelled.", false));
        }
        match resp.read(&mut read_buf) {
            Ok(0) => break,
            Ok(n) => {
                use std::io::Write;
                file.write_all(&read_buf[..n]).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
                downloaded += n as u64;
                emit_progress(app, &entry.artifact_id, &entry.kind, next_seq(), "downloading", downloaded, total, None);
            }
            Err(_) => {
                let _ = std::fs::remove_file(&tmp_path);
                return Err(BridgeError::artifact_offline(&entry.artifact_id));
            }
        }
    }
    drop(file);
    emit_progress(app, &entry.artifact_id, &entry.kind, next_seq(), "verifying", downloaded, total, None);
    let actual = sha256_file(&tmp_path).map_err(|_| BridgeError::artifact_corrupt(&entry.artifact_id))?;
    if !actual.eq_ignore_ascii_case(&asset.sha256) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(BridgeError::artifact_checksum_mismatch(&entry.artifact_id));
    }
    emit_progress(app, &entry.artifact_id, &entry.kind, next_seq(), "extracting", downloaded, total, None);
    let staging = cache.join("artifacts").join(format!(".{}-staging", entry.artifact_id));
    let _ = std::fs::remove_dir_all(&staging);
    std::fs::create_dir_all(&staging).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    match asset.archive_kind.as_str() {
        "none" => {
            let name = asset
                .binary_names
                .as_ref()
                .and_then(|n| n.first().cloned())
                .unwrap_or_else(|| entry.artifact_id.clone());
            let dest_name = if cfg!(windows) && !name.ends_with(".exe") && entry.kind == "binary" {
                format!("{name}.exe")
            } else {
                name
            };
            std::fs::copy(&tmp_path, staging.join(dest_name)).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
        }
        "zip" => extract_zip(&tmp_path, &staging)?,
        "tar.gz" => extract_tar_gz(&tmp_path, &staging)?,
        "tar.xz" => extract_tar_xz(&tmp_path, &staging)?,
        other => return Err(BridgeError::validation(&format!("unsupported archive kind: {other}"))),
    }
    let _ = std::fs::remove_file(&tmp_path);
    // Expected binary names must exist after extraction, before install.
    if entry.kind == "binary" {
        if let Some(names) = &asset.binary_names {
            for name in names {
                let p = staging.join(name);
                let p_exe = staging.join(format!("{name}.exe"));
                if !p.exists() && !p_exe.exists() {
                    let _ = std::fs::remove_dir_all(&staging);
                    return Err(BridgeError::artifact_corrupt(&entry.artifact_id));
                }
            }
        }
    }
    atomic_install(cache, &entry.artifact_id, &entry.version, &staging)?;
    #[cfg(unix)]
    if entry.kind == "binary" {
        use std::os::unix::fs::PermissionsExt;
        let dir = artifact_dir(cache, &entry.artifact_id, &entry.version);
        if let Ok(read) = std::fs::read_dir(&dir) {
            for item in read.flatten() {
                if item.path().is_file() {
                    let _ = std::fs::set_permissions(item.path(), std::fs::Permissions::from_mode(0o755));
                }
            }
        }
    }
    Ok(())
}

fn safe_join(dir: &Path, name: &str) -> BridgeResult<PathBuf> {
    if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
        return Err(BridgeError::artifact_corrupt("download"));
    }
    Ok(dir.join(name))
}

fn extract_zip(archive: &Path, staging: &Path) -> BridgeResult<()> {
    let file = std::fs::File::open(archive).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| BridgeError::artifact_corrupt("download"))?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|_| BridgeError::artifact_corrupt("download"))?;
        let name = entry.name().to_string();
        if entry.is_dir() {
            continue;
        }
        let dest = safe_join(staging, &name)?;
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
        }
        let mut out = std::fs::File::create(&dest).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
        std::io::copy(&mut entry, &mut out).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    }
    // Flatten a single top-level directory (common in release archives).
    flatten_single_dir(staging);
    Ok(())
}

fn extract_tar_gz(archive: &Path, staging: &Path) -> BridgeResult<()> {
    let file = std::fs::File::open(archive).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    let gz = flate2::read::GzDecoder::new(file);
    extract_tar(gz, staging)
}

fn extract_tar_xz(archive: &Path, staging: &Path) -> BridgeResult<()> {
    let file = std::fs::File::open(archive).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
    let xz = xz2::read::XzDecoder::new(file);
    extract_tar(xz, staging)
}

fn extract_tar<R: std::io::Read>(reader: R, staging: &Path) -> BridgeResult<()> {
    let mut tar = tar::Archive::new(reader);
    let entries = tar.entries().map_err(|_| BridgeError::artifact_corrupt("download"))?;
    for entry in entries {
        let mut entry = entry.map_err(|_| BridgeError::artifact_corrupt("download"))?;
        let path = entry.path().map_err(|_| BridgeError::artifact_corrupt("download"))?.to_path_buf();
        let name = path.to_string_lossy().into_owned();
        // Only regular files are unpacked: symlinks/devices in an archive
        // must never materialise inside the artifact cache.
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let dest = safe_join(staging, &name)?;
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(fbuploadpro_desktop::errors::io_to_bridge_error)?;
        }
        entry.unpack(&dest).map_err(|_| BridgeError::artifact_corrupt("download"))?;
    }
    flatten_single_dir(staging);
    Ok(())
}

fn flatten_single_dir(staging: &Path) {
    if let Ok(mut read) = std::fs::read_dir(staging) {
        let items: Vec<_> = read.by_ref().filter_map(|e| e.ok()).collect();
        if items.len() == 1 && items[0].path().is_dir() {
            let inner = items[0].path();
            if let Ok(inner_read) = std::fs::read_dir(&inner) {
                for item in inner_read.flatten() {
                    let dest = staging.join(item.file_name());
                    let _ = std::fs::rename(item.path(), dest);
                }
            }
            let _ = std::fs::remove_dir(&inner);
        }
    }
}

// --- binary commands ---
fn binary_entry(binary_id: &str) -> BridgeResult<ArtifactManifestEntry> {
    manifest_entry(binary_id)
        .filter(|e| e.kind == "binary")
        .ok_or_else(|| BridgeError::validation("unknown binaryId"))
}
fn model_entry(model_id: &str) -> BridgeResult<ArtifactManifestEntry> {
    manifest_entry(model_id)
        .filter(|e| e.kind == "model")
        .ok_or_else(|| BridgeError::validation("unknown modelId"))
}

fn ensure_impl(app: AppHandle, state: &AppState, entry: ArtifactManifestEntry, version: Option<String>) -> BridgeResult<ArtifactStatusResponse> {
    if let Some(v) = version {
        if v != entry.version {
            return Err(BridgeError::validation("version must equal the pinned manifest version"));
        }
    }
    let status = status_for(state, &entry);
    if status.state == "ready" {
        return Ok(ArtifactStatusResponse { artifact: status });
    }
    if status.state == "downloading" {
        return Ok(ArtifactStatusResponse { artifact: status });
    }
    if status.state == "error" || status.state == "corrupt" || status.state == "missing" {
        // Clear a previous failure so a fresh ensure retries.
        state.artifact_downloads.lock().unwrap().remove(&entry.artifact_id);
    }
    start_download(app, state, entry.clone());
    Ok(ArtifactStatusResponse { artifact: status_for(state, &entry) })
}

#[tauri::command]
pub fn binary_list(state: State<'_, AppState>) -> ArtifactListResponse {
    ArtifactListResponse {
        artifacts: manifest_entries().into_iter().filter(|e| e.kind == "binary").map(|e| status_for(&state, &e)).collect(),
    }
}
#[tauri::command]
pub fn binary_status(state: State<'_, AppState>, payload: BinaryIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = binary_entry(&payload.binary_id)?;
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}
#[tauri::command]
pub fn binary_ensure(app: AppHandle, state: State<'_, AppState>, payload: BinaryEnsurePayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = binary_entry(&payload.binary_id)?;
    ensure_impl(app, &state, entry, payload.version)
}
#[tauri::command]
pub fn binary_verify(state: State<'_, AppState>, payload: BinaryIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = binary_entry(&payload.binary_id)?;
    let cache = state.artifact_cache_dir();
    let asset = asset_for_platform(&entry, current_platform())
        .ok_or_else(|| BridgeError::new("ARTIFACT_UNSUPPORTED_PLATFORM", "No build of that tool exists for this platform.", false))?;
    let mut status = status_for(&state, &entry);
    if status.state == "ready" {
        // Re-hash single-file artifacts; for archives, check expected files.
        let ok = if asset.archive_kind == "none" {
            let path = artifact_binary_path(&cache, &entry, &entry.artifact_id).ok();
            path.map(|p| sha256_file(&p).map(|h| h.eq_ignore_ascii_case(&asset.sha256)).unwrap_or(false)).unwrap_or(false)
        } else {
            expected_files_present(&cache, &entry)
        };
        if !ok {
            // Flip to corrupt persistently: a `.corrupt` sidecar makes
            // status_for report corrupt on every later read until a fresh
            // ensure replaces the install.
            let _ = std::fs::write(corrupt_marker(&cache, &entry.artifact_id, &entry.version), b"corrupt\n");
            status = ArtifactStatusWire {
                artifact_id: entry.artifact_id.clone(),
                kind: entry.kind.clone(),
                state: "corrupt".to_string(),
                version: None,
                error: Some(BridgeError::artifact_corrupt(&entry.artifact_id)),
            };
        }
    }
    Ok(ArtifactStatusResponse { artifact: status })
}
#[tauri::command]
pub fn binary_remove(state: State<'_, AppState>, payload: BinaryIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = binary_entry(&payload.binary_id)?;
    assert_not_in_use(&state, &entry)?;
    remove_artifact(&state.artifact_cache_dir(), &entry.artifact_id, &entry.version)?;
    state.artifact_downloads.lock().unwrap().remove(&entry.artifact_id);
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}
#[tauri::command]
pub fn binary_cancel_download(state: State<'_, AppState>, payload: BinaryIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = binary_entry(&payload.binary_id)?;
    let downloads = state.artifact_downloads.lock().unwrap();
    if let Some(dl) = downloads.get(&entry.artifact_id) {
        dl.cancel.store(true, Ordering::SeqCst);
    }
    drop(downloads);
    // Cancelling when not downloading returns the current status, not an error.
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}

// --- sidecar model commands (same semantics, kind = model) ---
#[tauri::command]
pub fn sidecar_model_list(state: State<'_, AppState>) -> ArtifactListResponse {
    ArtifactListResponse {
        artifacts: manifest_entries().into_iter().filter(|e| e.kind == "model").map(|e| status_for(&state, &e)).collect(),
    }
}
#[tauri::command]
pub fn sidecar_model_status(state: State<'_, AppState>, payload: ModelIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = model_entry(&payload.model_id)?;
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}
#[tauri::command]
pub fn sidecar_model_ensure(app: AppHandle, state: State<'_, AppState>, payload: ModelEnsurePayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = model_entry(&payload.model_id)?;
    ensure_impl(app, &state, entry, payload.version)
}
#[tauri::command]
pub fn sidecar_model_remove(state: State<'_, AppState>, payload: ModelIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = model_entry(&payload.model_id)?;
    assert_not_in_use(&state, &entry)?;
    remove_artifact(&state.artifact_cache_dir(), &entry.artifact_id, &entry.version)?;
    state.artifact_downloads.lock().unwrap().remove(&entry.artifact_id);
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}
#[tauri::command]
pub fn sidecar_model_cancel_download(state: State<'_, AppState>, payload: ModelIdPayload) -> BridgeResult<ArtifactStatusResponse> {
    let entry = model_entry(&payload.model_id)?;
    let downloads = state.artifact_downloads.lock().unwrap();
    if let Some(dl) = downloads.get(&entry.artifact_id) {
        dl.cancel.store(true, Ordering::SeqCst);
    }
    drop(downloads);
    Ok(ArtifactStatusResponse { artifact: status_for(&state, &entry) })
}

fn assert_not_in_use(state: &AppState, entry: &ArtifactManifestEntry) -> BridgeResult<()> {
    let live: Vec<String> = state
        .processes
        .list()
        .into_iter()
        .filter(|r| r.state == fbuploadpro_desktop::processes::RunState::Running)
        .map(|r| r.binary_id)
        .collect();
    let in_use = live.iter().any(|b| {
        b == &entry.artifact_id || (entry.artifact_id == "ffmpeg" && b == "ffprobe")
    });
    if in_use {
        return Err(BridgeError::artifact_in_use(&entry.artifact_id));
    }
    // A download in progress also blocks removal.
    if let Some(dl) = state.artifact_downloads.lock().unwrap().get(&entry.artifact_id) {
        if matches!(dl.phase, DownloadPhase::Downloading) {
            return Err(BridgeError::artifact_in_use(&entry.artifact_id));
        }
    }
    Ok(())
}
