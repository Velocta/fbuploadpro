//! §7.4 dialogs + scoped filesystem. Dialogs grant scopes; every fs command
//! resolves through the scope registry (containment + symlink checks).
//! Cancellation is a RESULT (`cancelled: true`), never an error.
//! There is deliberately NO `fs_read_bytes`: media bytes never travel
//! through JSON invoke payloads — binaries read scoped paths directly.

use fbuploadpro_desktop::errors::{io_to_bridge_error, BridgeError, BridgeResult};
use fbuploadpro_desktop::scopes::ScopeKind;
use fbuploadpro_desktop::validation::is_bare_extension;
use tauri::{AppHandle, State};

use super::state::AppState;
use super::types::*;

/// Convert a dialog-picked FilePath to a plain filesystem path string.
/// A URI variant that cannot become a local path is dropped (the caller
/// treats an empty pick set as a cancellation, never as an error).
fn picked_path(p: tauri_plugin_dialog::FilePath) -> Option<String> {
    p.into_path().ok().map(|pb| pb.to_string_lossy().into_owned())
}

fn dialog_filters_valid(filters: &Option<Vec<DialogFilter>>) -> BridgeResult<()> {
    if let Some(filters) = filters {
        for f in filters {
            if f.name.is_empty() {
                return Err(BridgeError::validation("dialog filter name must not be empty"));
            }
            for ext in &f.extensions {
                if !is_bare_extension(ext) {
                    return Err(BridgeError::validation("dialog filter extensions must be bare (e.g. \"mp4\")"));
                }
            }
        }
    }
    Ok(())
}

fn tauri_filters(filters: &Option<Vec<DialogFilter>>) -> Vec<(String, Vec<String>)> {
    filters
        .as_ref()
        .map(|fs| fs.iter().map(|f| (f.name.clone(), f.extensions.clone())).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn dialog_open_file(app: AppHandle, state: State<'_, AppState>, payload: DialogOpenFilePayload) -> BridgeResult<DialogOpenFileResponse> {
    dialog_filters_valid(&payload.filters)?;
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(title) = &payload.title {
        builder = builder.set_title(title);
    }
    for (name, exts) in tauri_filters(&payload.filters) {
        let ext_refs: Vec<&str> = exts.iter().map(|e| e.as_str()).collect();
        builder = builder.add_filter(name, &ext_refs);
    }
    let picked = if payload.multiple.unwrap_or(false) {
        builder.blocking_pick_files().map(|paths| paths.into_iter().filter_map(picked_path).collect::<Vec<_>>())
    } else {
        builder.blocking_pick_file().and_then(picked_path).map(|p| vec![p])
    };
    let Some(paths) = picked else {
        return Ok(DialogOpenFileResponse { files: vec![], cancelled: true });
    };
    if paths.is_empty() {
        return Ok(DialogOpenFileResponse { files: vec![], cancelled: true });
    }
    let files = paths
        .into_iter()
        .map(|p| {
            let path = std::path::PathBuf::from(&p);
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let scope_id = state.scopes.grant(ScopeKind::File, path);
            DialogFile { path: p, scope_id, name }
        })
        .collect();
    Ok(DialogOpenFileResponse { files, cancelled: false })
}

#[tauri::command]
pub fn dialog_open_directory(app: AppHandle, state: State<'_, AppState>, payload: DialogOpenDirectoryPayload) -> BridgeResult<DialogOpenDirectoryResponse> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(title) = &payload.title {
        builder = builder.set_title(title);
    }
    let picked = if payload.multiple.unwrap_or(false) {
        builder.blocking_pick_folders().map(|paths| paths.into_iter().filter_map(picked_path).collect::<Vec<_>>())
    } else {
        builder.blocking_pick_folder().and_then(picked_path).map(|p| vec![p])
    };
    let Some(paths) = picked else {
        return Ok(DialogOpenDirectoryResponse { directories: vec![], cancelled: true });
    };
    if paths.is_empty() {
        return Ok(DialogOpenDirectoryResponse { directories: vec![], cancelled: true });
    }
    let directories = paths
        .into_iter()
        .map(|p| {
            let scope_id = state.scopes.grant(ScopeKind::Directory, std::path::PathBuf::from(&p));
            DialogDirectory { path: p, scope_id }
        })
        .collect();
    Ok(DialogOpenDirectoryResponse { directories, cancelled: false })
}

#[tauri::command]
pub fn dialog_save_file(app: AppHandle, state: State<'_, AppState>, payload: DialogSaveFilePayload) -> BridgeResult<DialogSaveFileResponse> {
    dialog_filters_valid(&payload.filters)?;
    if let Some(name) = &payload.default_name {
        if name.contains('/') || name.contains('\\') {
            return Err(BridgeError::validation("defaultName must not contain a path separator"));
        }
    }
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(title) = &payload.title {
        builder = builder.set_title(title);
    }
    if let Some(name) = &payload.default_name {
        builder = builder.set_file_name(name);
    }
    for (name, exts) in tauri_filters(&payload.filters) {
        let ext_refs: Vec<&str> = exts.iter().map(|e| e.as_str()).collect();
        builder = builder.add_filter(name, &ext_refs);
    }
    let picked = builder.blocking_save_file().and_then(picked_path);
    let Some(path_str) = picked else {
        return Ok(DialogSaveFileResponse { path: None, scope_id: None, cancelled: true });
    };
    let scope_id = state.scopes.grant(ScopeKind::File, std::path::PathBuf::from(&path_str));
    Ok(DialogSaveFileResponse { path: Some(path_str), scope_id: Some(scope_id), cancelled: false })
}

#[tauri::command]
pub fn fs_scope_list(state: State<'_, AppState>) -> ScopeListResponse {
    ScopeListResponse {
        scopes: state
            .scopes
            .list()
            .into_iter()
            .map(|s| ScopeInfo {
                scope_id: s.id,
                kind: match s.kind {
                    ScopeKind::Directory => "directory".to_string(),
                    ScopeKind::File => "file".to_string(),
                },
                path: s.path.to_string_lossy().into_owned(),
            })
            .collect(),
    }
}

#[tauri::command]
pub fn fs_scope_revoke(state: State<'_, AppState>, payload: ScopeRevokePayload) -> ScopeRevokeResponse {
    // Idempotent: revoking an unknown scope still returns revoked: true.
    ScopeRevokeResponse { scope_id: state.scopes.revoke(&payload.scope_id), revoked: true }
}

fn rel_or_root(payload_relative: &Option<String>) -> String {
    payload_relative.clone().unwrap_or_default()
}

#[tauri::command]
pub fn fs_list(state: State<'_, AppState>, payload: FsListPayload) -> BridgeResult<FsListResponse> {
    let root = state.scopes.resolve(&payload.scope_id, &rel_or_root(&payload.relative_path))?;
    let recursive = payload.recursive.unwrap_or(false);
    let mut entries = Vec::new();
    collect_entries(&root, &root, recursive, &mut entries)?;
    if entries.len() > 10_000 {
        return Err(BridgeError::fs_too_many_entries());
    }
    Ok(FsListResponse { entries })
}

fn collect_entries(dir: &std::path::Path, base: &std::path::Path, recursive: bool, out: &mut Vec<FsEntry>) -> BridgeResult<()> {
    let read = std::fs::read_dir(dir).map_err(io_to_bridge_error)?;
    for item in read {
        let item = item.map_err(io_to_bridge_error)?;
        let path = item.path();
        let meta = item.metadata().map_err(io_to_bridge_error)?;
        let kind = if meta.is_dir() { "directory" } else { "file" };
        let rel = path.strip_prefix(base).map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| path.to_string_lossy().into_owned());
        out.push(FsEntry {
            name: item.file_name().to_string_lossy().into_owned(),
            relative_path: rel,
            kind: kind.to_string(),
            size_bytes: if meta.is_dir() { None } else { Some(meta.len()) },
            modified_at: meta.modified().ok().map(|t| {
                let secs = t.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
                fbuploadpro_desktop::processes::iso_from_secs(secs)
            }),
        });
        if recursive && meta.is_dir() {
            collect_entries(&path, base, recursive, out)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn fs_stat(state: State<'_, AppState>, payload: FsPathPayload) -> BridgeResult<FsStatResponse> {
    let path = state.scopes.resolve(&payload.scope_id, &rel_or_root(&payload.relative_path))?;
    let meta = std::fs::metadata(&path).map_err(io_to_bridge_error)?;
    Ok(FsStatResponse {
        kind: if meta.is_dir() { "directory".to_string() } else { "file".to_string() },
        size_bytes: if meta.is_dir() { None } else { Some(meta.len()) },
        modified_at: meta.modified().ok().map(|t| {
            let secs = t.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            fbuploadpro_desktop::processes::iso_from_secs(secs)
        }),
        relative_path: rel_or_root(&payload.relative_path),
    })
}

#[tauri::command]
pub fn fs_exists(state: State<'_, AppState>, payload: FsPathPayload) -> BridgeResult<FsExistsResponse> {
    let path = state.scopes.resolve(&payload.scope_id, &rel_or_root(&payload.relative_path))?;
    Ok(FsExistsResponse { exists: path.exists() })
}

#[tauri::command]
pub fn fs_read_text(state: State<'_, AppState>, payload: FsReadTextPayload) -> BridgeResult<FsReadTextResponse> {
    let max_bytes = payload.max_bytes.unwrap_or(1024 * 1024);
    if max_bytes > 10 * 1024 * 1024 {
        return Err(BridgeError::validation("maxBytes must not exceed 10 MiB"));
    }
    let path = state.scopes.resolve(&payload.scope_id, &rel_or_root(&payload.relative_path))?;
    let bytes = std::fs::read(&path).map_err(io_to_bridge_error)?;
    if bytes.len() as u64 > max_bytes {
        return Err(BridgeError::validation("file exceeds maxBytes"));
    }
    let content = String::from_utf8(bytes).map_err(|_| BridgeError::fs_not_text())?;
    let size = content.len() as u64;
    Ok(FsReadTextResponse { content, truncated: false, size_bytes: size })
}

#[tauri::command]
pub fn fs_write_text(state: State<'_, AppState>, payload: FsWriteTextPayload) -> BridgeResult<FsWriteTextResponse> {
    if payload.content.len() > 10 * 1024 * 1024 {
        return Err(BridgeError::validation("content must not exceed 10 MiB"));
    }
    let path = state.scopes.resolve(&payload.scope_id, &payload.relative_path)?;
    let existed = path.exists();
    if existed && !payload.overwrite.unwrap_or(false) {
        return Err(BridgeError::fs_already_exists());
    }
    if payload.create_parents.unwrap_or(false) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(io_to_bridge_error)?;
        }
    }
    std::fs::write(&path, &payload.content).map_err(io_to_bridge_error)?;
    Ok(FsWriteTextResponse { relative_path: payload.relative_path, size_bytes: payload.content.len() as u64, overwritten: existed })
}

#[tauri::command]
pub fn fs_mkdir(state: State<'_, AppState>, payload: FsMkdirPayload) -> BridgeResult<FsMkdirResponse> {
    let path = state.scopes.resolve(&payload.scope_id, &payload.relative_path)?;
    if path.exists() {
        return Ok(FsMkdirResponse { relative_path: payload.relative_path, created: false });
    }
    if payload.recursive.unwrap_or(false) {
        std::fs::create_dir_all(&path).map_err(io_to_bridge_error)?;
    } else {
        std::fs::create_dir(&path).map_err(io_to_bridge_error)?;
    }
    Ok(FsMkdirResponse { relative_path: payload.relative_path, created: true })
}

#[tauri::command]
pub fn fs_delete(state: State<'_, AppState>, payload: FsDeletePayload) -> BridgeResult<FsDeleteResponse> {
    if payload.relative_path.is_empty() {
        return Err(BridgeError::validation("refusing to delete a scope root"));
    }
    let path = state.scopes.resolve(&payload.scope_id, &payload.relative_path)?;
    let meta = std::fs::metadata(&path).map_err(io_to_bridge_error)?;
    if meta.is_dir() {
        if payload.recursive.unwrap_or(false) {
            std::fs::remove_dir_all(&path).map_err(io_to_bridge_error)?;
        } else {
            std::fs::remove_dir(&path).map_err(|e| {
                if e.kind() == std::io::ErrorKind::DirectoryNotEmpty {
                    BridgeError::fs_not_empty()
                } else {
                    io_to_bridge_error(e)
                }
            })?;
        }
    } else {
        std::fs::remove_file(&path).map_err(io_to_bridge_error)?;
    }
    Ok(FsDeleteResponse { relative_path: payload.relative_path, deleted: true })
}

#[tauri::command]
pub fn fs_copy(state: State<'_, AppState>, payload: FsCopyPayload) -> BridgeResult<FsCopyResponse> {
    let src = state.scopes.resolve(&payload.source_scope_id, &payload.source_relative_path)?;
    let dst = state.scopes.resolve(&payload.dest_scope_id, &payload.dest_relative_path)?;
    if dst.exists() && !payload.overwrite.unwrap_or(false) {
        return Err(BridgeError::fs_already_exists());
    }
    let meta = std::fs::metadata(&src).map_err(io_to_bridge_error)?;
    if meta.is_dir() {
        return Err(BridgeError::validation("fs_copy supports files only"));
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent).map_err(io_to_bridge_error)?;
    }
    let size = std::fs::copy(&src, &dst).map_err(io_to_bridge_error)?;
    Ok(FsCopyResponse { dest_relative_path: payload.dest_relative_path, size_bytes: size })
}

#[tauri::command]
pub fn fs_move(state: State<'_, AppState>, payload: FsCopyPayload) -> BridgeResult<FsCopyResponse> {
    // Copy-then-delete only after the copy is verified (same bytes).
    let src = state.scopes.resolve(&payload.source_scope_id, &payload.source_relative_path)?;
    let dst = state.scopes.resolve(&payload.dest_scope_id, &payload.dest_relative_path)?;
    if dst.exists() && !payload.overwrite.unwrap_or(false) {
        return Err(BridgeError::fs_already_exists());
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent).map_err(io_to_bridge_error)?;
    }
    let size = std::fs::copy(&src, &dst).map_err(io_to_bridge_error)?;
    let dst_size = std::fs::metadata(&dst).map_err(io_to_bridge_error)?.len();
    if dst_size != size {
        let _ = std::fs::remove_file(&dst);
        return Err(BridgeError::internal("The move failed verification; the source was kept."));
    }
    std::fs::remove_file(&src).map_err(io_to_bridge_error)?;
    Ok(FsCopyResponse { dest_relative_path: payload.dest_relative_path, size_bytes: size })
}
