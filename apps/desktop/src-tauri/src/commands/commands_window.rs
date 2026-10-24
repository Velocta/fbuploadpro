//! §7.3 window + external commands (legacy bare shapes — frozen exception).
//! The validation behaviour of the original `main.rs` pure functions is
//! preserved verbatim: http(s) only, reject embedded userinfo. The original
//! string returns ("window_minimized", ...) are superseded by the §7.3
//! object shapes; the TS helpers were updated in the same PR-145-A change.

use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::validation::validate_clean_http_url;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window};

use super::types::{OpenExternalUrlResponse, WindowActionResponse};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DesktopWindowAction {
    Minimize,
    Maximize,
    Unmaximize,
    ToggleMaximize,
    Close,
}

/// Whether the post-action window state is reported for this action.
pub fn reports_maximized(action: DesktopWindowAction) -> bool {
    matches!(action, DesktopWindowAction::Maximize | DesktopWindowAction::Unmaximize | DesktopWindowAction::ToggleMaximize)
}

/// The ONE shell window construction (§5.2/§5.5): frameless 1240x740
/// (min 960x580), centred, custom UA carrying `FBUploadProDesktop`, and
/// the navigation allowlist. Used by launch (main.rs) AND by
/// `shell_retry_connection` — a retry-created window must not silently
/// downgrade to a decorated window with no allowlist.
pub fn shell_window_builder<'a, R: Runtime, M: Manager<R>>(manager: &'a M, label: &str, url: WebviewUrl) -> WebviewWindowBuilder<'a, R, M> {
    WebviewWindowBuilder::new(manager, label, url)
        .title("FBUploadPro")
        .inner_size(1240.0, 740.0)
        .min_inner_size(960.0, 580.0)
        .decorations(false)
        .center()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 FBUploadProDesktop/0.1.0")
        .on_navigation(|url| {
            // §5.5 navigation allowlist: FBUploadPro origins only.
            // Anything else is blocked here and routed through
            // open_external_url by the web layer instead. The local
            // fallback asset (tauri/asset schemes) is always allowed.
            if matches!(url.scheme(), "tauri" | "asset") {
                return true;
            }
            let host = url.host_str().unwrap_or("");
            url.scheme() == "https" && (host == "fbuploadpro.com" || host.ends_with(".fbuploadpro.com"))
        })
}

/// Build a shell window with the shared settings (see above).
pub fn build_shell_window<R: Runtime, M: Manager<R>>(manager: &M, label: &str, url: WebviewUrl) -> Result<WebviewWindow<R>, tauri::Error> {
    shell_window_builder(manager, label, url).build()
}

#[tauri::command]
pub fn handle_window_action(window: Window, action: DesktopWindowAction) -> BridgeResult<WindowActionResponse> {
    let action_name = match action {
        DesktopWindowAction::Minimize => "minimize",
        DesktopWindowAction::Maximize => "maximize",
        DesktopWindowAction::Unmaximize => "unmaximize",
        DesktopWindowAction::ToggleMaximize => "toggle_maximize",
        DesktopWindowAction::Close => "close",
    };
    let result: BridgeResult<()> = (|| {
        match action {
            DesktopWindowAction::Minimize => window.minimize().map_err(|_| BridgeError::internal("Failed to minimise the window"))?,
            DesktopWindowAction::Maximize => window.maximize().map_err(|_| BridgeError::internal("Failed to maximise the window"))?,
            DesktopWindowAction::Unmaximize => window.unmaximize().map_err(|_| BridgeError::internal("Failed to restore the window"))?,
            DesktopWindowAction::ToggleMaximize => {
                let maximized = window.is_maximized().unwrap_or(false);
                if maximized {
                    window.unmaximize().map_err(|_| BridgeError::internal("Failed to restore the window"))?;
                } else {
                    window.maximize().map_err(|_| BridgeError::internal("Failed to maximise the window"))?;
                }
            }
            DesktopWindowAction::Close => window.close().map_err(|_| BridgeError::internal("Failed to close the window"))?,
        }
        Ok(())
    })();
    result?;
    let maximized = if reports_maximized(action) {
        // After close/minimise the window may be gone; only the three
        // maximise-family actions report state, and the window still exists
        // for those (close reports null by construction).
        Some(window.is_maximized().unwrap_or(false))
    } else {
        None
    };
    Ok(WindowActionResponse { action: action_name.to_string(), applied: true, maximized })
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> BridgeResult<OpenExternalUrlResponse> {
    // Rust check is authoritative; the web-side pre-check is defence-in-depth.
    validate_clean_http_url(&url).map_err(|_| BridgeError::validation("Invalid URL: only http(s) URLs without embedded credentials are permitted"))?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|_| BridgeError::internal("Failed to open the URL in the system browser"))?;
    Ok(OpenExternalUrlResponse { opened: true, url })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_response_semantics() {
        assert!(reports_maximized(DesktopWindowAction::Maximize));
        assert!(reports_maximized(DesktopWindowAction::ToggleMaximize));
        assert!(!reports_maximized(DesktopWindowAction::Minimize));
        assert!(!reports_maximized(DesktopWindowAction::Close));
        // Serde keeps the frozen snake_case values the titlebar depends on.
        assert_eq!(serde_json::to_string(&DesktopWindowAction::ToggleMaximize).unwrap(), "\"toggle_maximize\"");
    }
}
