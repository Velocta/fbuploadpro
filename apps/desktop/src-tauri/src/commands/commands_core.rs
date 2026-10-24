//! §7.3 core commands: shell info, start URL, tenant memory, retry.
//! The shell never reads cookies and never navigates the webview to a URL
//! supplied by web content without the §5.2 origin check (see main.rs).

use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::preflight::preflight;
use fbuploadpro_desktop::start_url::{load_tenant_config, save_tenant_config};
use tauri::{AppHandle, Manager, State};

use super::state::{platform_name, AppState};
use super::types::*;

#[tauri::command]
pub fn get_shell_info() -> ShellInfoResponse {
    ShellInfoResponse {
        app_name: "FBUploadPro Desktop".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        bridge_version: "1.0.0".to_string(),
        platform: platform_name(),
        arch: std::env::consts::ARCH.to_string(),
        frameless: true,
        window: WindowGeometry { default_width: 1240, default_height: 740, min_width: 960, min_height: 580 },
        capabilities: Capabilities { filesystem: true, process: true, dialogs: true, secrets: true, artifacts: true, media: true, ai: true },
    }
}

fn current_start_url(state: &AppState) -> StartUrlResponse {
    let (url, source, tenant_subdomain) = state.start_url.lock().unwrap().clone();
    StartUrlResponse { url, source, tenant_subdomain }
}

#[tauri::command]
pub fn shell_get_start_url(state: State<'_, AppState>) -> StartUrlResponse {
    current_start_url(&state)
}

#[tauri::command]
pub fn shell_remember_tenant(state: State<'_, AppState>, payload: RememberTenantPayload) -> BridgeResult<RememberTenantResponse> {
    if !fbuploadpro_desktop::validation::is_valid_subdomain(&payload.subdomain) {
        return Err(BridgeError::validation("subdomain must match ^[a-z0-9][a-z0-9-]{1,62}$"));
    }
    let mut cfg = load_tenant_config(&state.tenant_config_path());
    cfg.last_tenant_subdomain = Some(payload.subdomain.clone());
    cfg.last_seen_at = Some(fbuploadpro_desktop::processes::iso_now());
    save_tenant_config(&state.tenant_config_path(), &cfg)?;
    state.set_start_url(
        format!("https://{}.fbuploadpro.com/", payload.subdomain),
        "remembered-tenant".to_string(),
        Some(payload.subdomain.clone()),
    );
    Ok(RememberTenantResponse { subdomain: payload.subdomain, stored: true })
}

#[tauri::command]
pub fn shell_forget_tenant(state: State<'_, AppState>) -> BridgeResult<ForgetTenantResponse> {
    // Idempotent: forgetting when nothing is stored still succeeds.
    let mut cfg = load_tenant_config(&state.tenant_config_path());
    cfg.last_tenant_subdomain = None;
    save_tenant_config(&state.tenant_config_path(), &cfg)?;
    state.set_start_url("https://app.fbuploadpro.com/".to_string(), "default".to_string(), None);
    Ok(ForgetTenantResponse { forgotten: true })
}

#[tauri::command]
pub fn shell_retry_connection(app: AppHandle, state: State<'_, AppState>) -> RetryConnectionResponse {
    let start = current_start_url(&state);
    let reachable = preflight(&start.url);
    if reachable {
        // Navigate the main window if it exists; otherwise create it and
        // close the fallback window. The response alone does not navigate —
        // this handler performs the navigation (§7.3).
        if let Some(win) = app.get_webview_window("main") {
            if let Ok(url) = start.url.parse() {
                let _ = win.navigate(url);
            }
        } else {
            let url = start.url.clone();
            if let Ok(parsed) = url.parse() {
                if let Ok(win) = super::commands_window::build_shell_window(&app, "main", tauri::WebviewUrl::External(parsed)) {
                    let _ = win.show();
                }
            }
            if let Some(fallback) = app.get_webview_window("fallback") {
                let _ = fallback.close();
            }
        }
    }
    RetryConnectionResponse { reachable, url: start.url }
}

/// The §7.3 core commands, in contract order. The contract⊆registered
/// assertion (see registered_commands.rs) fails if this list drifts from
/// DESKTOP_BRIDGE_COMMANDS in the TS contract.
#[allow(dead_code)] // Conformance surface: asserted by the cfg(test) fixture test in registered_commands.rs.
pub const CORE_COMMANDS: [&str; 5] = [
    "get_shell_info",
    "shell_get_start_url",
    "shell_remember_tenant",
    "shell_forget_tenant",
    "shell_retry_connection",
];
