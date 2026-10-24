//! §7.5 process commands. The allowlist is the artifact manager: only
//! binaries resolved from the verified artifact cache may spawn (yt-dlp,
//! ffmpeg, ffprobe, whisper). No shell interpreter, no PATH lookup, no
//! renderer-supplied path. `ffprobe` resolves to the binary bundled with
//! the `ffmpeg` artifact.

use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::processes::{RunRecord, RunState};
use fbuploadpro_desktop::validation::is_valid_name;
use tauri::State;

use super::commands_artifact::artifact_binary_path;
use super::manifest_data::manifest_entry;
use super::state::AppState;
use super::types::*;

fn state_str(state: &RunState) -> &'static str {
    match state {
        RunState::Running => "running",
        RunState::Exited => "exited",
        RunState::Cancelled => "cancelled",
    }
}

fn to_status(rec: &RunRecord) -> ProcessStatusResponse {
    ProcessStatusResponse {
        run_id: rec.run_id.clone(),
        state: state_str(&rec.state).to_string(),
        exit_code: rec.exit_code,
        started_at: rec.started_at.clone(),
        ended_at: rec.ended_at.clone(),
    }
}

#[tauri::command]
pub fn process_spawn(state: State<'_, AppState>, payload: ProcessSpawnPayload) -> BridgeResult<ProcessSpawnResponse> {
    if payload.args.len() > 128 || payload.args.iter().any(|a| a.chars().count() > 4096) {
        return Err(BridgeError::validation("args exceed the allowed size"));
    }
    // The `--` option-terminator trick: an arg equal to `--` followed by a
    // value that looks like a URL/path is rejected unless a binary profile
    // explicitly allows it — no profile in v1 allows it, so reject always.
    if payload.args.windows(2).any(|w| w[0] == "--" && (w[1].contains("://") || w[1].starts_with('/'))) {
        return Err(BridgeError::validation("args must not use the -- option-terminator trick"));
    }
    let env = payload.env.clone().unwrap_or_default();
    fbuploadpro_desktop::validation::validate_env(&env)?;
    if let Some(ns) = &payload.namespace {
        if !is_valid_name(ns) {
            return Err(BridgeError::validation("namespace is invalid"));
        }
    }
    if let Some(job) = &payload.job_id {
        if uuid::Uuid::parse_str(job).is_err() {
            return Err(BridgeError::validation("jobId must be a UUID"));
        }
    }
    if let Some(ms) = payload.timeout_ms {
        if !(1000..=86_400_000).contains(&ms) {
            return Err(BridgeError::validation("timeoutMs must be 1000-86400000"));
        }
    }
    // Binary readiness gate: no hidden download inside spawn.
    let entry = manifest_entry(&payload.binary_id).ok_or_else(|| BridgeError::validation("unknown binaryId"))?;
    let binary_path = artifact_binary_path(&state.artifact_cache_dir(), &entry, &payload.binary_id)?;
    let cwd = match (&payload.cwd_scope_id, &payload.cwd_relative_path) {
        (Some(scope), rel) => Some(state.scopes.resolve(scope, rel.as_deref().unwrap_or(""))?),
        (None, _) => None,
    };
    let rec = state.processes.spawn(
        payload.run_id.clone(),
        &payload.binary_id,
        &binary_path,
        &payload.args,
        cwd.as_deref(),
        &env,
        payload.timeout_ms,
        payload.namespace.clone(),
        payload.job_id.clone(),
    )?;
    Ok(ProcessSpawnResponse { run_id: rec.run_id, pid: rec.pid, binary_id: rec.binary_id, started_at: rec.started_at })
}

#[tauri::command]
pub fn process_write_stdin(state: State<'_, AppState>, payload: ProcessWriteStdinPayload) -> BridgeResult<ProcessWriteStdinResponse> {
    if payload.data.len() > 1024 * 1024 {
        return Err(BridgeError::validation("stdin data exceeds 1 MiB per call"));
    }
    let closed = state.processes.write_stdin(&payload.run_id, &payload.data, payload.close.unwrap_or(false))?;
    Ok(ProcessWriteStdinResponse { run_id: payload.run_id, written: true, closed })
}

#[tauri::command]
pub fn process_cancel(state: State<'_, AppState>, payload: ProcessCancelPayload) -> BridgeResult<ProcessCancelResponse> {
    let kill = payload.mode.as_deref() == Some("kill");
    if let Some(mode) = &payload.mode {
        if mode != "terminate" && mode != "kill" {
            return Err(BridgeError::validation("mode must be terminate or kill"));
        }
    }
    let (run_state, already_exited) = state.processes.cancel(&payload.run_id, kill)?;
    Ok(ProcessCancelResponse {
        run_id: payload.run_id,
        state: state_str(&run_state).to_string(),
        already_exited,
    })
}

#[tauri::command]
pub fn process_status(state: State<'_, AppState>, payload: ProcessStatusPayload) -> BridgeResult<ProcessStatusResponse> {
    Ok(to_status(&state.processes.status(&payload.run_id)?))
}

#[tauri::command]
pub fn process_list(state: State<'_, AppState>) -> ProcessListResponse {
    ProcessListResponse {
        processes: state
            .processes
            .list()
            .into_iter()
            .map(|r| ProcessListEntry {
                run_id: r.run_id,
                binary_id: r.binary_id,
                state: state_str(&r.state).to_string(),
                namespace: r.namespace,
                job_id: r.job_id,
                started_at: r.started_at,
            })
            .collect(),
    }
}
