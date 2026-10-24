//! Path containment (§7.4 scope model). Every filesystem/media path is
//! resolved through this module — handlers never join a user path themselves.
//!
//! Rules: `relativePath` must pass `is_safe_relative_path`; the resolved path
//! must stay inside the scope root after canonicalisation, so a symlink
//! inside the scope pointing outside is rejected (PATH_TRAVERSAL), while a
//! symlink pointing inside is allowed. Non-existent targets are resolved
//! against the nearest existing ancestor so writes to new files are checked
//! too. File scopes permit only the single file (empty relativePath = the
//! file itself, or its own name).

use std::path::{Path, PathBuf};

use crate::errors::{BridgeError, BridgeResult};
use crate::validation::is_safe_relative_path;

/// Canonicalise `path` if it exists; otherwise canonicalise the nearest
/// existing ancestor and append the remaining components.
pub fn canonicalize_best_effort(path: &Path) -> PathBuf {
    if let Ok(c) = path.canonicalize() {
        return c;
    }
    let mut current = path.to_path_buf();
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match current.canonicalize() {
            Ok(c) => {
                let mut out = c;
                for part in suffix.iter().rev() {
                    out.push(part);
                }
                return out;
            }
            Err(_) => {
                if let Some(file) = current.file_name().map(|f| f.to_os_string()) {
                    suffix.push(file);
                    if !current.pop() {
                        return path.to_path_buf();
                    }
                } else {
                    return path.to_path_buf();
                }
            }
        }
    }
}

/// Resolve `relative` inside `root` (both as given, not yet canonicalised).
/// Returns the canonicalised root + the resolved absolute path.
pub fn resolve_in_scope(root: &Path, relative: &str) -> BridgeResult<PathBuf> {
    if !is_safe_relative_path(relative) {
        return Err(BridgeError::validation("relativePath must not be absolute or contain \"..\""));
    }
    let joined = if relative.is_empty() { root.to_path_buf() } else { root.join(relative) };
    let canonical_root = canonicalize_best_effort(root);
    let resolved = canonicalize_best_effort(&joined);
    if resolved == canonical_root || resolved.starts_with(&canonical_root) {
        Ok(resolved)
    } else {
        Err(BridgeError::path_traversal())
    }
}

/// Check a single-file scope: only the file itself is addressable.
pub fn check_file_scope(file_path: &Path, relative: &str) -> BridgeResult<PathBuf> {
    let file_name = file_path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
    if relative.is_empty() || relative == file_name {
        Ok(file_path.to_path_buf())
    } else {
        Err(BridgeError::path_traversal())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmpdir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fbup-paths-{tag}-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn containment_matrix() {
        let root = tmpdir("matrix");
        std::fs::create_dir_all(root.join("clips")).unwrap();
        std::fs::write(root.join("clips/a.mp4"), b"x").unwrap();
        assert!(resolve_in_scope(&root, "clips/a.mp4").is_ok());
        assert!(resolve_in_scope(&root, "").is_ok());
        assert!(resolve_in_scope(&root, "../escape").is_err());
        assert!(resolve_in_scope(&root, "clips/../../escape").is_err());
        assert!(resolve_in_scope(&root, "/etc/passwd").is_err());
        assert!(resolve_in_scope(&root, "new/nested/file.txt").is_ok()); // write target, ancestor-checked
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    #[cfg(unix)]
    fn symlink_escape_rejected_and_internal_allowed() {
        use std::os::unix::fs::symlink;
        let root = tmpdir("symlink");
        let outside = tmpdir("symlink-out");
        std::fs::write(outside.join("secret.txt"), b"secret").unwrap();
        std::fs::create_dir_all(root.join("inner")).unwrap();
        std::fs::write(root.join("inner/ok.txt"), b"ok").unwrap();
        let _ = symlink(outside.join("secret.txt"), root.join("escape.txt"));
        let _ = symlink(root.join("inner/ok.txt"), root.join("inside.txt"));
        assert_eq!(resolve_in_scope(&root, "escape.txt").unwrap_err().code, "PATH_TRAVERSAL");
        assert!(resolve_in_scope(&root, "inside.txt").is_ok());
        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&outside);
    }

    #[test]
    fn file_scope_restriction() {
        let root = tmpdir("file");
        let file = root.join("only.mp4");
        std::fs::write(&file, b"x").unwrap();
        assert!(check_file_scope(&file, "").is_ok());
        assert!(check_file_scope(&file, "only.mp4").is_ok());
        assert_eq!(check_file_scope(&file, "other.mp4").unwrap_err().code, "PATH_TRAVERSAL");
        let _ = std::fs::remove_dir_all(&root);
    }
}
