//! Shared application state for Tauri command handlers.
//! Handlers are thin: validate -> pure logic -> typed result/error.
//! No handler stores a session, token, or cookie, and none injects auth.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// One in-flight AI stream: (cancel flag, done flag).
pub type AiStreamFlags = (Arc<std::sync::atomic::AtomicBool>, Arc<std::sync::atomic::AtomicBool>);

use fbuploadpro_desktop::processes::ProcessRegistry;
use fbuploadpro_desktop::scopes::ScopeRegistry;
use fbuploadpro_desktop::secrets::{KeyringSecretStore, SecretStore};

use super::media_jobs::MediaJobInfo;

pub struct AppState {
    /// App config directory (remembered tenant, scopes, secret names).
    pub config_dir: PathBuf,
    /// App local-data directory; artifacts live under `<data>/artifacts/`.
    pub data_dir: PathBuf,
    pub scopes: ScopeRegistry,
    pub processes: Arc<ProcessRegistry>,
    /// Media jobs by runId, for progress/done event enrichment.
    pub media_jobs: Arc<Mutex<HashMap<String, MediaJobInfo>>>,
    /// Secret store (OS keychain in production).
    pub secrets: Arc<dyn SecretStore>,
    /// Names-only registry for `secrets_list` (keyring has no enumeration).
    pub secret_names: Mutex<HashMap<String, Vec<String>>>,
    /// In-flight AI streams by requestId: (cancel flag, done flag).
    pub ai_cancelled: Mutex<HashMap<String, AiStreamFlags>>,
    /// Artifact download status by artifactId (see commands_artifact).
    pub artifact_downloads: Arc<Mutex<HashMap<String, super::commands_artifact::DownloadState>>>,
    /// Launch-resolved start URL (url, source, tenantSubdomain). Remember/
    /// forget handlers update this so `shell_get_start_url` reports the
    /// URL the shell actually launched with (including a debug env override).
    pub start_url: Mutex<(String, String, Option<String>)>,
}

impl AppState {
    pub fn new(
        config_dir: PathBuf,
        data_dir: PathBuf,
        processes: Arc<ProcessRegistry>,
        media_jobs: Arc<Mutex<HashMap<String, MediaJobInfo>>>,
    ) -> Self {
        let secret_names = load_secret_names(&config_dir);
        Self {
            config_dir,
            data_dir,
            scopes: ScopeRegistry::new(),
            processes,
            media_jobs,
            secrets: Arc::new(KeyringSecretStore),
            secret_names: Mutex::new(secret_names),
            ai_cancelled: Mutex::new(HashMap::new()),
            artifact_downloads: Arc::new(Mutex::new(HashMap::new())),
            start_url: Mutex::new(("https://app.fbuploadpro.com/".to_string(), "default".to_string(), None)),
        }
    }

    pub fn set_start_url(&self, url: String, source: String, tenant_subdomain: Option<String>) {
        *self.start_url.lock().unwrap() = (url, source, tenant_subdomain);
    }

    pub fn tenant_config_path(&self) -> PathBuf {
        self.config_dir.join("tenant.json")
    }
    pub fn scopes_path(&self) -> PathBuf {
        self.config_dir.join("scopes.json")
    }
    pub fn secret_names_path(&self) -> PathBuf {
        self.config_dir.join("secret-names.json")
    }
    pub fn artifact_cache_dir(&self) -> PathBuf {
        self.data_dir.clone()
    }

    pub fn persist_secret_names(&self) {
        let names = self.secret_names.lock().unwrap().clone();
        if let Some(parent) = self.secret_names_path().parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string(&names) {
            let _ = std::fs::write(self.secret_names_path(), text);
        }
    }
}

fn load_secret_names(config_dir: &Path) -> HashMap<String, Vec<String>> {
    let path = config_dir.join("secret-names.json");
    let Ok(text) = std::fs::read_to_string(&path) else {
        return HashMap::new();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

/// Platform string normalised to the §7.3 values.
pub fn platform_name() -> String {
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return std::env::consts::OS.to_string();
}
