//! Scope registry (§7.4). A scope is created only by a dialog pick; every
//! fs/media command addresses content as { scopeId, relativePath }.
//! Directory-scope roots are persisted (paths only) so a relaunch can
//! restore them; restoration re-validates that each root still exists and
//! is a directory, dropping any that does not.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::errors::{BridgeError, BridgeResult};
use crate::paths::{check_file_scope, resolve_in_scope};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScopeKind {
    Directory,
    File,
}

#[derive(Debug, Clone)]
pub struct Scope {
    pub id: String,
    pub kind: ScopeKind,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedScope {
    scope_id: String,
    kind: ScopeKind,
    path: String,
}

pub struct ScopeRegistry {
    scopes: Mutex<HashMap<String, Scope>>,
}

impl ScopeRegistry {
    pub fn new() -> Self {
        Self { scopes: Mutex::new(HashMap::new()) }
    }

    /// Grant a scope (dialog pick). Returns the server-generated scope id.
    pub fn grant(&self, kind: ScopeKind, path: PathBuf) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.scopes.lock().unwrap().insert(id.clone(), Scope { id: id.clone(), kind, path });
        id
    }

    pub fn list(&self) -> Vec<Scope> {
        self.scopes.lock().unwrap().values().cloned().collect()
    }

    /// Idempotent revoke: unknown ids still succeed (already gone).
    pub fn revoke(&self, scope_id: &str) -> String {
        self.scopes.lock().unwrap().remove(scope_id);
        scope_id.to_string()
    }

    pub fn get(&self, scope_id: &str) -> BridgeResult<Scope> {
        self.scopes.lock().unwrap().get(scope_id).cloned().ok_or_else(BridgeError::scope_not_found)
    }

    /// Resolve a scoped path, applying file-scope restrictions.
    pub fn resolve(&self, scope_id: &str, relative: &str) -> BridgeResult<PathBuf> {
        let scope = self.get(scope_id)?;
        match scope.kind {
            ScopeKind::Directory => resolve_in_scope(&scope.path, relative),
            ScopeKind::File => check_file_scope(&scope.path, relative),
        }
    }

    /// Persist directory scopes (paths only, no content) for relaunch restore.
    pub fn persist(&self, file: &std::path::Path) -> BridgeResult<()> {
        let scopes: Vec<PersistedScope> = self
            .list()
            .into_iter()
            .filter(|s| s.kind == ScopeKind::Directory)
            .map(|s| PersistedScope { scope_id: s.id, kind: s.kind, path: s.path.to_string_lossy().into_owned() })
            .collect();
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent).map_err(crate::errors::io_to_bridge_error)?;
        }
        let text = serde_json::to_string(&scopes).map_err(|_| BridgeError::internal("Failed to encode scopes"))?;
        std::fs::write(file, text).map_err(crate::errors::io_to_bridge_error)?;
        Ok(())
    }

    /// Restore persisted directory scopes, re-validating each root.
    pub fn restore(&self, file: &std::path::Path) {
        let Ok(text) = std::fs::read_to_string(file) else { return };
        let Ok(scopes) = serde_json::from_str::<Vec<PersistedScope>>(&text) else { return };
        for s in scopes {
            let path = PathBuf::from(&s.path);
            if s.kind == ScopeKind::Directory && path.is_dir() {
                self.scopes.lock().unwrap().insert(s.scope_id.clone(), Scope { id: s.scope_id, kind: s.kind, path });
            }
        }
    }
}

impl Default for ScopeRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_lifecycle_and_use_after_revoke() {
        let reg = ScopeRegistry::new();
        let dir = std::env::temp_dir().join(format!("fbup-scope-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let id = reg.grant(ScopeKind::Directory, dir.clone());
        assert!(reg.resolve(&id, "").is_ok());
        assert_eq!(reg.revoke(&id), id);
        assert_eq!(reg.resolve(&id, "").unwrap_err().code, "SCOPE_NOT_FOUND");
        // Revoking an unknown scope is idempotent success.
        assert_eq!(reg.revoke("nope"), "nope");
        // Restore drops roots that no longer exist.
        let file = dir.join("scopes.json");
        let id2 = reg.grant(ScopeKind::Directory, dir.clone());
        reg.persist(&file).unwrap();
        let reg2 = ScopeRegistry::new();
        reg2.restore(&file);
        assert!(reg2.get(&id2).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
        let reg3 = ScopeRegistry::new();
        reg3.restore(&file); // file is gone with the dir; restore is a no-op
        assert!(reg3.list().is_empty());
    }
}
