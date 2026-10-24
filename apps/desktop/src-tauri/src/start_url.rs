//! §5.2 tenant URL resolution + §5.3 remembered-tenant config.
//! Pure: no window, no network. The config file holds only a subdomain and a
//! timestamp — no secret, no identity beyond the workspace subdomain.

use serde::{Deserialize, Serialize};

use crate::errors::BridgeResult;
use crate::validation::{is_valid_subdomain, url_host};

pub const DEFAULT_START_URL: &str = "https://app.fbuploadpro.com/";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartUrlSource {
    EnvOverride,
    RememberedTenant,
    Default,
}

impl StartUrlSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            StartUrlSource::EnvOverride => "env-override",
            StartUrlSource::RememberedTenant => "remembered-tenant",
            StartUrlSource::Default => "default",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TenantConfig {
    #[serde(default)]
    pub last_tenant_subdomain: Option<String>,
    #[serde(default)]
    pub last_seen_at: Option<String>,
}

/// Load a tenant config file. A corrupt file, an invalid stored subdomain, or
/// a missing file all yield an empty config — never a crash, never a
/// navigation to a stored value that fails validation.
pub fn load_tenant_config(path: &std::path::Path) -> TenantConfig {
    let Ok(text) = std::fs::read_to_string(path) else {
        return TenantConfig::default();
    };
    let Ok(mut cfg) = serde_json::from_str::<TenantConfig>(&text) else {
        return TenantConfig::default();
    };
    if let Some(sub) = &cfg.last_tenant_subdomain {
        if !is_valid_subdomain(sub) {
            cfg.last_tenant_subdomain = None;
        }
    }
    cfg
}

pub fn save_tenant_config(path: &std::path::Path, cfg: &TenantConfig) -> BridgeResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(crate::errors::io_to_bridge_error)?;
    }
    let text = serde_json::to_string_pretty(cfg).map_err(|_| crate::errors::BridgeError::internal("Failed to encode tenant config"))?;
    std::fs::write(path, text).map_err(crate::errors::io_to_bridge_error)?;
    Ok(())
}

/// Debug-only env override rule (§5.2 step 1): honoured only when `debug` is
/// true; the value must be `https://*.fbuploadpro.com` or a localhost http
/// origin. Anything else falls through (never navigated to, never echoed
/// beyond its host in logs — callers log only the host).
pub fn env_override_allowed(value: &str) -> bool {
    let Ok(host) = url_host(value).ok_or(()) else {
        return false;
    };
    if value.starts_with("https://") {
        return host == "fbuploadpro.com" || host.ends_with(".fbuploadpro.com");
    }
    if value.starts_with("http://") {
        return host == "localhost" || host == "127.0.0.1";
    }
    false
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedStartUrl {
    pub url: String,
    pub source: StartUrlSource,
    pub tenant_subdomain: Option<String>,
}

/// Resolution order: debug env override -> remembered tenant -> default.
pub fn resolve_start_url(env_value: Option<&str>, debug: bool, remembered: Option<&str>) -> ResolvedStartUrl {
    if debug {
        if let Some(value) = env_value {
            if env_override_allowed(value) {
                return ResolvedStartUrl {
                    url: ensure_trailing_slash(value),
                    source: StartUrlSource::EnvOverride,
                    tenant_subdomain: None,
                };
            }
        }
    }
    if let Some(sub) = remembered {
        if is_valid_subdomain(sub) {
            return ResolvedStartUrl {
                url: format!("https://{sub}.fbuploadpro.com/"),
                source: StartUrlSource::RememberedTenant,
                tenant_subdomain: Some(sub.to_string()),
            };
        }
    }
    ResolvedStartUrl { url: DEFAULT_START_URL.to_string(), source: StartUrlSource::Default, tenant_subdomain: None }
}

fn ensure_trailing_slash(value: &str) -> String {
    if value.ends_with('/') {
        value.to_string()
    } else {
        format!("{value}/")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolution_order() {
        assert_eq!(
            resolve_start_url(Some("https://tenant.fbuploadpro.com"), true, Some("other")),
            ResolvedStartUrl { url: "https://tenant.fbuploadpro.com/".into(), source: StartUrlSource::EnvOverride, tenant_subdomain: None }
        );
        // Release builds ignore the env override entirely.
        assert_eq!(
            resolve_start_url(Some("https://tenant.fbuploadpro.com"), false, Some("acme")),
            ResolvedStartUrl { url: "https://acme.fbuploadpro.com/".into(), source: StartUrlSource::RememberedTenant, tenant_subdomain: Some("acme".into()) }
        );
        // Foreign origin falls through to the remembered tenant.
        assert_eq!(
            resolve_start_url(Some("https://evil.example.com"), true, Some("acme")).source,
            StartUrlSource::RememberedTenant
        );
        // Invalid stored subdomain is discarded, never navigated to.
        assert_eq!(
            resolve_start_url(None, true, Some("Bad_Sub!")),
            ResolvedStartUrl { url: DEFAULT_START_URL.into(), source: StartUrlSource::Default, tenant_subdomain: None }
        );
        assert_eq!(resolve_start_url(None, true, None).url, DEFAULT_START_URL);
        // Local dev override is allowed in debug only.
        assert!(env_override_allowed("http://localhost:3000"));
        assert!(env_override_allowed("http://127.0.0.1:3000"));
        assert!(!env_override_allowed("https://evil.example.com"));
        assert!(!env_override_allowed("http://example.com"));
    }

    #[test]
    fn corrupt_config_is_tolerated() {
        let dir = std::env::temp_dir().join(format!("fbup-starturl-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("tenant.json");
        std::fs::write(&path, "{not json").unwrap();
        assert_eq!(load_tenant_config(&path).last_tenant_subdomain, None);
        std::fs::write(&path, r#"{"lastTenantSubdomain":"Bad!"}"#).unwrap();
        assert_eq!(load_tenant_config(&path).last_tenant_subdomain, None);
        std::fs::write(&path, r#"{"lastTenantSubdomain":"acme"}"#).unwrap();
        assert_eq!(load_tenant_config(&path).last_tenant_subdomain.as_deref(), Some("acme"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
