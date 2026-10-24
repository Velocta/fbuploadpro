// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! FBUploadPro Desktop shell entry point (spec 145).
//!
//! The original `println!` stub is superseded: this is a real Tauri v2 app.
//! The original pure functions survive in the library — URL validation in
//! `validation.rs` (tests kept there), shell info in `commands_core.rs`,
//! window/external validation in `commands_window.rs` — now actually
//! driving a window and the OS opener via registered `#[tauri::command]`s.
//! The shell stores no session, token, or cookie and injects no auth (§5.3);
//! auth is the web app's own flow inside the webview.

mod commands;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use fbuploadpro_desktop::preflight::preflight;
use fbuploadpro_desktop::processes::{iso_now, ProcessEvent, ProcessRegistry};
use fbuploadpro_desktop::start_url::{load_tenant_config, resolve_start_url};
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewUrl};

use commands::media_jobs::{media_events_for_process_event, MediaJobInfo};
use commands::state::AppState;
use commands::types::{MediaDoneEvent, MediaProgressEvent, ProcessExitEvent, ProcessStdoutEvent};

/// Event router: turns registry process events into `desktop:*` Tauri
/// events, enriching media jobs with progress/done events (§7.6).
struct Router {
    handle: AppHandle,
    media_jobs: Arc<Mutex<HashMap<String, MediaJobInfo>>>,
    registry: Mutex<Option<Arc<ProcessRegistry>>>,
    media_seq: Mutex<HashMap<String, u64>>,
}

impl Router {
    fn tracing_for(&self, run_id: &str) -> (Option<String>, Option<String>) {
        if let Some(job) = self.media_jobs.lock().unwrap().get(run_id) {
            return (job.namespace.clone(), job.job_id.clone());
        }
        if let Some(reg) = self.registry.lock().unwrap().as_ref() {
            if let Ok(rec) = reg.status(run_id) {
                return (rec.namespace, rec.job_id);
            }
        }
        (None, None)
    }

    fn handle_event(&self, event: ProcessEvent) {
        let (run_id, seq) = match &event {
            ProcessEvent::Stdout { run_id, seq, .. } | ProcessEvent::Stderr { run_id, seq, .. } | ProcessEvent::Exit { run_id, seq, .. } => {
                (run_id.clone(), *seq)
            }
        };
        let (namespace, job_id) = self.tracing_for(&run_id);
        match &event {
            ProcessEvent::Stdout { chunk, .. } => {
                let _ = self.handle.emit(
                    "desktop:process:stdout",
                    ProcessStdoutEvent { run_id: run_id.clone(), seq, emitted_at: iso_now(), chunk: chunk.clone(), namespace: namespace.clone(), job_id: job_id.clone() },
                );
            }
            ProcessEvent::Stderr { chunk, .. } => {
                let _ = self.handle.emit(
                    "desktop:process:stderr",
                    ProcessStdoutEvent { run_id: run_id.clone(), seq, emitted_at: iso_now(), chunk: chunk.clone(), namespace: namespace.clone(), job_id: job_id.clone() },
                );
            }
            ProcessEvent::Exit { exit_code, signal, reason, .. } => {
                let _ = self.handle.emit(
                    "desktop:process:exit",
                    ProcessExitEvent {
                        run_id: run_id.clone(),
                        seq,
                        emitted_at: iso_now(),
                        exit_code: *exit_code,
                        signal: signal.clone(),
                        reason: reason.as_str().to_string(),
                        namespace: namespace.clone(),
                        job_id: job_id.clone(),
                    },
                );
            }
        }
        // Media enrichment (only for runs registered as media jobs).
        let mut jobs = self.media_jobs.lock().unwrap();
        if let Some(job) = jobs.get_mut(&run_id) {
            let (progress, done) = media_events_for_process_event(&event, job);
            if let Some((phase, percent, detail)) = progress {
                let mut seqs = self.media_seq.lock().unwrap();
                let s = seqs.entry(run_id.clone()).or_insert(0);
                let media_seq = *s;
                *s += 1;
                drop(seqs);
                let _ = self.handle.emit(
                    "desktop:media:progress",
                    MediaProgressEvent {
                        run_id: run_id.clone(),
                        seq: media_seq,
                        emitted_at: iso_now(),
                        phase,
                        percent,
                        detail,
                        namespace: namespace.clone(),
                        job_id: job_id.clone(),
                    },
                );
            }
            if let Some((status, outputs, error)) = done {
                let mut seqs = self.media_seq.lock().unwrap();
                let s = seqs.entry(run_id.clone()).or_insert(0);
                let media_seq = *s;
                *s += 1;
                drop(seqs);
                let _ = self.handle.emit(
                    "desktop:media:done",
                    MediaDoneEvent {
                        run_id: run_id.clone(),
                        seq: media_seq,
                        emitted_at: iso_now(),
                        status,
                        outputs,
                        error,
                        namespace,
                        job_id,
                    },
                );
                jobs.remove(&run_id);
            }
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::commands_core::get_shell_info,
            commands::commands_core::shell_get_start_url,
            commands::commands_core::shell_remember_tenant,
            commands::commands_core::shell_forget_tenant,
            commands::commands_core::shell_retry_connection,
            commands::commands_window::handle_window_action,
            commands::commands_window::open_external_url,
            commands::commands_fs::dialog_open_file,
            commands::commands_fs::dialog_open_directory,
            commands::commands_fs::dialog_save_file,
            commands::commands_fs::fs_scope_list,
            commands::commands_fs::fs_scope_revoke,
            commands::commands_fs::fs_list,
            commands::commands_fs::fs_stat,
            commands::commands_fs::fs_exists,
            commands::commands_fs::fs_read_text,
            commands::commands_fs::fs_write_text,
            commands::commands_fs::fs_mkdir,
            commands::commands_fs::fs_delete,
            commands::commands_fs::fs_copy,
            commands::commands_fs::fs_move,
            commands::commands_process::process_spawn,
            commands::commands_process::process_write_stdin,
            commands::commands_process::process_cancel,
            commands::commands_process::process_status,
            commands::commands_process::process_list,
            commands::commands_artifact::binary_list,
            commands::commands_artifact::binary_status,
            commands::commands_artifact::binary_ensure,
            commands::commands_artifact::binary_verify,
            commands::commands_artifact::binary_remove,
            commands::commands_artifact::binary_cancel_download,
            commands::commands_artifact::sidecar_model_list,
            commands::commands_artifact::sidecar_model_status,
            commands::commands_artifact::sidecar_model_ensure,
            commands::commands_artifact::sidecar_model_remove,
            commands::commands_artifact::sidecar_model_cancel_download,
            commands::commands_secrets::secrets_set,
            commands::commands_secrets::secrets_get,
            commands::commands_secrets::secrets_has,
            commands::commands_secrets::secrets_list,
            commands::commands_secrets::secrets_delete,
            commands::commands_media::media_yt_dlp_metadata,
            commands::commands_media::media_yt_dlp_subtitles,
            commands::commands_media::media_yt_dlp_download,
            commands::commands_media::media_probe,
            commands::commands_media::media_convert,
            commands::commands_media::media_transcribe,
            commands::commands_ai::ai_complete,
            commands::commands_ai::ai_complete_stream,
            commands::commands_ai::ai_cancel,
            commands::commands_ai::ai_status,
        ])
        .setup(|app| {
            let config_dir = app.path().app_config_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let data_dir = app.path().app_local_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            // §5.2 resolution: debug-only env override -> remembered tenant -> default.
            let env_override = if cfg!(debug_assertions) {
                std::env::var("FBUP_DESKTOP_WEB_URL").ok()
            } else {
                None
            };
            let remembered = load_tenant_config(&config_dir.join("tenant.json")).last_tenant_subdomain;
            let resolved = resolve_start_url(env_override.as_deref(), cfg!(debug_assertions), remembered.as_deref());
            let reachable = preflight(&resolved.url);
            // Event router + process registry (created before AppState so
            // the registry callback can emit through the AppHandle).
            let media_jobs: Arc<Mutex<HashMap<String, MediaJobInfo>>> = Arc::new(Mutex::new(HashMap::new()));
            let router = Arc::new(Router {
                handle: app.handle().clone(),
                media_jobs: Arc::clone(&media_jobs),
                registry: Mutex::new(None),
                media_seq: Mutex::new(HashMap::new()),
            });
            let router_cb = Arc::clone(&router);
            let processes = Arc::new(ProcessRegistry::new(Arc::new(move |event| {
                router_cb.handle_event(event);
            })));
            *router.registry.lock().unwrap() = Some(Arc::clone(&processes));
            let state = AppState::new(config_dir.clone(), data_dir, Arc::clone(&processes), media_jobs);
            state.set_start_url(resolved.url.clone(), resolved.source.as_str().to_string(), resolved.tenant_subdomain.clone());
            state.scopes.restore(&state.scopes_path());
            app.manage(state);
            // Window: reachable -> main window at the start URL; unreachable
            // -> fallback window loading the local public/index.html (§5.4).
            // Both go through the shared builder so settings + allowlist
            // cannot drift between launch and retry paths.
            if reachable {
                let url: tauri::Url = resolved.url.parse().unwrap_or_else(|_| "https://app.fbuploadpro.com/".parse().unwrap());
                commands::commands_window::build_shell_window(app, "main", WebviewUrl::External(url))?;
            } else {
                commands::commands_window::build_shell_window(app, "fallback", WebviewUrl::App("index.html".into()))?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Tauri application");
    app.run(|app: &tauri::AppHandle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app.try_state::<AppState>() {
                state.processes.shutdown_cleanup();
            }
        }
    });
}
