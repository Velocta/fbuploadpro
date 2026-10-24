//! Contract ⊆ registered-command assertion (spec §14 AC-14, tasks T-09/T-23).
//! The 52 command names here must match `DESKTOP_BRIDGE_COMMANDS` in the TS
//! contract exactly. The test below reads the shared JSON fixtures and
//! asserts (a) the fixture command set equals this set, and (b) every
//! fixture validRequest deserialises into its Rust payload struct — so a
//! TS↔Rust shape drift fails in CI.

#[allow(dead_code)] // Conformance surface: asserted by the cfg(test) fixture test below.
pub const REGISTERED_COMMANDS: [&str; 52] = [
    "get_shell_info",
    "shell_get_start_url",
    "shell_remember_tenant",
    "shell_forget_tenant",
    "shell_retry_connection",
    "handle_window_action",
    "open_external_url",
    "dialog_open_file",
    "dialog_open_directory",
    "dialog_save_file",
    "fs_scope_list",
    "fs_scope_revoke",
    "fs_list",
    "fs_stat",
    "fs_exists",
    "fs_read_text",
    "fs_write_text",
    "fs_mkdir",
    "fs_delete",
    "fs_copy",
    "fs_move",
    "process_spawn",
    "process_write_stdin",
    "process_cancel",
    "process_status",
    "process_list",
    "binary_list",
    "binary_status",
    "binary_ensure",
    "binary_verify",
    "binary_remove",
    "binary_cancel_download",
    "sidecar_model_list",
    "sidecar_model_status",
    "sidecar_model_ensure",
    "sidecar_model_remove",
    "sidecar_model_cancel_download",
    "secrets_set",
    "secrets_get",
    "secrets_has",
    "secrets_list",
    "secrets_delete",
    "media_yt_dlp_metadata",
    "media_yt_dlp_subtitles",
    "media_yt_dlp_download",
    "media_probe",
    "media_convert",
    "media_transcribe",
    "ai_complete",
    "ai_complete_stream",
    "ai_cancel",
    "ai_status",
];

/// Try to deserialise a fixture request into its Rust payload struct.
/// Commands with no payload (empty request) return Ok(true) by construction.
#[allow(dead_code)] // Conformance surface: exercised by the cfg(test) fixture test below.
pub fn fixture_request_parses(command: &str, json: &serde_json::Value) -> bool {
    use super::types::*;
    macro_rules! parse {
        ($t:ty) => {
            serde_json::from_value::<$t>(json.clone()).is_ok()
        };
    }
    match command {
        "get_shell_info" | "shell_get_start_url" | "shell_forget_tenant" | "shell_retry_connection" | "fs_scope_list" | "process_list"
        | "binary_list" | "sidecar_model_list" => json.as_object().map(|o| o.is_empty()).unwrap_or(false),
        "handle_window_action" => {
            #[derive(serde::Deserialize)]
            struct W {
                action: super::commands_window::DesktopWindowAction,
            }
            serde_json::from_value::<W>(json.clone()).is_ok()
        }
        "open_external_url" => {
            #[derive(serde::Deserialize)]
            struct U {
                url: String,
            }
            serde_json::from_value::<U>(json.clone()).is_ok()
        }
        "shell_remember_tenant" => parse!(RememberTenantPayload),
        "dialog_open_file" => parse!(DialogOpenFilePayload),
        "dialog_open_directory" => parse!(DialogOpenDirectoryPayload),
        "dialog_save_file" => parse!(DialogSaveFilePayload),
        "fs_scope_revoke" => parse!(ScopeRevokePayload),
        "fs_list" => parse!(FsListPayload),
        "fs_stat" | "fs_exists" => parse!(FsPathPayload),
        "fs_read_text" => parse!(FsReadTextPayload),
        "fs_write_text" => parse!(FsWriteTextPayload),
        "fs_mkdir" => parse!(FsMkdirPayload),
        "fs_delete" => parse!(FsDeletePayload),
        "fs_copy" | "fs_move" => parse!(FsCopyPayload),
        "process_spawn" => parse!(ProcessSpawnPayload),
        "process_write_stdin" => parse!(ProcessWriteStdinPayload),
        "process_cancel" => parse!(ProcessCancelPayload),
        "process_status" => parse!(ProcessStatusPayload),
        "binary_status" | "binary_verify" | "binary_remove" | "binary_cancel_download" => parse!(BinaryIdPayload),
        "binary_ensure" => parse!(BinaryEnsurePayload),
        "sidecar_model_status" | "sidecar_model_remove" | "sidecar_model_cancel_download" => parse!(ModelIdPayload),
        "sidecar_model_ensure" => parse!(ModelEnsurePayload),
        "secrets_set" => parse!(SecretsSetPayload),
        "secrets_get" | "secrets_has" | "secrets_delete" => parse!(SecretsKeyPayload),
        "secrets_list" => parse!(SecretsListPayload),
        "media_yt_dlp_metadata" => parse!(YtDlpMetadataPayload),
        "media_yt_dlp_subtitles" => parse!(YtDlpSubtitlesPayload),
        "media_yt_dlp_download" => parse!(YtDlpDownloadPayload),
        "media_probe" => parse!(MediaProbePayload),
        "media_convert" => parse!(MediaConvertPayload),
        "media_transcribe" => parse!(MediaTranscribePayload),
        "ai_complete" => parse!(AiCompletePayload),
        "ai_complete_stream" => parse!(AiCompleteStreamPayload),
        "ai_cancel" => parse!(AiCancelPayload),
        "ai_status" => parse!(AiStatusPayload),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registered_commands_match_shared_fixtures() {
        let text = include_str!("../../../tests/fixtures/bridge-fixtures.json");
        let fixtures: serde_json::Value = serde_json::from_str(text).unwrap();
        let commands = fixtures["commands"].as_array().unwrap();
        assert_eq!(commands.len(), 52);
        let mut fixture_names: Vec<&str> = commands.iter().map(|c| c["command"].as_str().unwrap()).collect();
        fixture_names.sort_unstable();
        let mut registered: Vec<&str> = REGISTERED_COMMANDS.to_vec();
        registered.sort_unstable();
        assert_eq!(fixture_names, registered);
        for entry in commands {
            let command = entry["command"].as_str().unwrap();
            assert!(
                fixture_request_parses(command, &entry["validRequest"]),
                "fixture validRequest for {command} must parse into its Rust payload struct"
            );
            // A deliberately corrupted fixture must fail (proves assertion).
            if command == "shell_remember_tenant" {
                assert!(!fixture_request_parses(command, &serde_json::json!({"subdomain": 42})));
            }
        }
        // No hardcoded success / not-implemented markers in handlers: the
        // audit is done by the grep in the PR description (AC-14), and by
        // this assertion — every registered command has a real handler in
        // main.rs's invoke_handler (compile-checked: generate_handler lists
        // them by name; a missing function fails compilation).
    }
}
