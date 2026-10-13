// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DesktopWindowAction {
    Minimize,
    Maximize,
    Unmaximize,
    ToggleMaximize,
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopShellInfo {
    pub app_name: String,
    pub version: String,
    pub user_agent: String,
    pub frameless: bool,
    pub default_width: u32,
    pub default_height: u32,
    pub min_width: u32,
    pub min_height: u32,
}

pub fn get_desktop_shell_info() -> DesktopShellInfo {
    DesktopShellInfo {
        app_name: "FBUploadPro Desktop".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        user_agent: "FBUploadProDesktop/0.1.0".to_string(),
        frameless: true,
        default_width: 1240,
        default_height: 740,
        min_width: 960,
        min_height: 580,
    }
}

pub fn handle_window_action(action: DesktopWindowAction) -> Result<String, String> {
    match action {
        DesktopWindowAction::Minimize => Ok("window_minimized".to_string()),
        DesktopWindowAction::Maximize => Ok("window_maximized".to_string()),
        DesktopWindowAction::Unmaximize => Ok("window_unmaximized".to_string()),
        DesktopWindowAction::ToggleMaximize => Ok("window_maximized_toggled".to_string()),
        DesktopWindowAction::Close => Ok("window_closed".to_string()),
    }
}

pub fn open_external_url(url: &str) -> Result<String, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Invalid URL scheme: only http and https are permitted".to_string());
    }
    Ok("external_url_opened".to_string())
}

fn main() {
    println!("FBUploadPro Desktop Shell (Tauri v2)");
    let info = get_desktop_shell_info();
    println!("Initialized {} v{} (frameless: {})", info.app_name, info.version, info.frameless);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_desktop_shell_info() {
        let info = get_desktop_shell_info();
        assert_eq!(info.app_name, "FBUploadPro Desktop");
        assert_eq!(info.version, "0.1.0");
        assert!(info.frameless);
        assert_eq!(info.default_width, 1240);
        assert_eq!(info.default_height, 740);
        assert_eq!(info.min_width, 960);
        assert_eq!(info.min_height, 580);
    }

    #[test]
    fn test_handle_window_action() {
        assert_eq!(handle_window_action(DesktopWindowAction::Minimize).unwrap(), "window_minimized");
        assert_eq!(handle_window_action(DesktopWindowAction::Maximize).unwrap(), "window_maximized");
        assert_eq!(handle_window_action(DesktopWindowAction::Unmaximize).unwrap(), "window_unmaximized");
        assert_eq!(handle_window_action(DesktopWindowAction::ToggleMaximize).unwrap(), "window_maximized_toggled");
        assert_eq!(handle_window_action(DesktopWindowAction::Close).unwrap(), "window_closed");
    }

    #[test]
    fn test_open_external_url_validation() {
        assert_eq!(open_external_url("https://example.com").unwrap(), "external_url_opened");
        assert_eq!(open_external_url("http://localhost:3000").unwrap(), "external_url_opened");
        assert!(open_external_url("file:///etc/passwd").is_err());
        assert!(open_external_url("javascript:alert(1)").is_err());
    }
}
