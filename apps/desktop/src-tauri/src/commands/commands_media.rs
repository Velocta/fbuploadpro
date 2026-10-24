//! §9 generic media primitives. Structured options are translated bridge-side
//! into binary argv; the renderer never supplies raw media args. Every
//! primitive gates on `ready` first — no hidden auto-downloads. Blocking
//! primitives run the binary inside the handler with a timeout (exceeding it
//! is MEDIA_TIMEOUT); job primitives return a runId immediately and report
//! via `desktop:media:progress` / `desktop:media:done` through the router.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::media::{
    ffmpeg_convert_argv, parse_probe, parse_subtitles, parse_yt_dlp_metadata, transcribe_output_path, validate_format_selector,
    validate_output_template, ConvertAudioOptions, ConvertOptions, ConvertVideoOptions,
};
use fbuploadpro_desktop::validation::{is_language_code, validate_media_url};
use tauri::State;

use super::commands_artifact::{artifact_binary_path, artifact_model_path};
use super::manifest_data::manifest_entry;
use super::media_jobs::{MediaJobInfo, MediaJobKind};
use super::state::AppState;
use super::types::*;

/// Run a short-lived binary to completion, reading both pipes concurrently.
/// Returns (stdout, stderr, exit_code). Timeout -> MEDIA_TIMEOUT.
fn run_blocking(binary: &Path, args: &[String], timeout_secs: u64) -> BridgeResult<(Vec<u8>, Vec<u8>, i32)> {
    let mut cmd = Command::new(binary);
    // Own process group (setsid, Unix) so the timeout kill below takes
    // the whole tree (yt-dlp spawns ffmpeg for merges) instead of
    // orphaning children that keep running after the timeout.
    #[cfg(unix)]
    unsafe {
        use std::os::unix::process::CommandExt;
        cmd.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
    let mut child: Child = cmd
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|_| BridgeError::new("PROCESS_SPAWN_FAILED", "The tool could not be started.", true))?;
    let pid = child.id();
    let exited = Arc::new(AtomicBool::new(false));
    let exited2 = exited.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(timeout_secs));
        if !exited2.load(Ordering::SeqCst) {
            #[cfg(unix)]
            unsafe {
                libc::kill(-(pid as i32), libc::SIGKILL);
            }
        }
    });
    // Read both pipes on dedicated threads (a helper fn, not a closure:
    // `impl Trait` is not allowed in closure parameters).
    let t_out = read_stream_to_end(child.stdout.take());
    let t_err = read_stream_to_end(child.stderr.take());
    let status = child.wait().map_err(|_| BridgeError::internal("Failed to wait for the tool"))?;
    exited.store(true, Ordering::SeqCst);
    let out = t_out.join().unwrap_or_default();
    let err = t_err.join().unwrap_or_default();
    let code = status.code().unwrap_or(-1);
    if code != 0 && status.code().is_none() {
        // Killed (likely by our timeout thread).
        return Err(BridgeError::new("MEDIA_TIMEOUT", "The media operation timed out.", true));
    }
    Ok((out, err, code))
}

fn read_stream_to_end<S: Read + Send + 'static>(stream: Option<S>) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut s) = stream {
            let _ = s.read_to_end(&mut buf);
        }
        buf
    })
}

fn ready_binary(state: &AppState, binary_id: &str) -> BridgeResult<PathBuf> {
    let entry = manifest_entry(binary_id).ok_or_else(|| BridgeError::validation("unknown binaryId"))?;
    artifact_binary_path(&state.artifact_cache_dir(), &entry, binary_id)
}

fn ffmpeg_path(state: &AppState) -> BridgeResult<PathBuf> {
    ready_binary(state, "ffmpeg")
}

#[tauri::command]
pub fn media_yt_dlp_metadata(state: State<'_, AppState>, payload: YtDlpMetadataPayload) -> BridgeResult<YtDlpMetadataResponse> {
    validate_media_url(&payload.url)?;
    let bin = ready_binary(&state, "yt-dlp")?;
    let (out, _err, code) = run_blocking(&bin, &["--dump-json".to_string(), "--no-playlist".to_string(), payload.url.clone()], 120)
        .map_err(|e| if e.code == "MEDIA_TIMEOUT" { e } else { BridgeError::media_not_found() })?;
    if code != 0 {
        return Err(BridgeError::media_not_found());
    }
    let json: serde_json::Value = serde_json::from_slice(&out).map_err(|_| BridgeError::media_not_found())?;
    Ok(YtDlpMetadataResponse { metadata: parse_yt_dlp_metadata(&json)? })
}

#[tauri::command]
pub fn media_yt_dlp_subtitles(state: State<'_, AppState>, payload: YtDlpSubtitlesPayload) -> BridgeResult<YtDlpSubtitlesResponse> {
    validate_media_url(&payload.url)?;
    if let Some(langs) = &payload.languages {
        for l in langs {
            if !is_language_code(l) {
                return Err(BridgeError::validation("subtitle language code is invalid"));
            }
        }
    }
    let bin = ready_binary(&state, "yt-dlp")?;
    let (out, _err, code) = run_blocking(&bin, &["--dump-json".to_string(), "--no-playlist".to_string(), payload.url.clone()], 120)
        .map_err(|e| if e.code == "MEDIA_TIMEOUT" { e } else { BridgeError::media_not_found() })?;
    if code != 0 {
        return Err(BridgeError::media_not_found());
    }
    let json: serde_json::Value = serde_json::from_slice(&out).map_err(|_| BridgeError::media_not_found())?;
    let (subtitles, automatic_captions) = parse_subtitles(&json, payload.languages.as_deref())?;
    Ok(YtDlpSubtitlesResponse { subtitles, automatic_captions })
}

#[tauri::command]
pub fn media_yt_dlp_download(state: State<'_, AppState>, payload: YtDlpDownloadPayload) -> BridgeResult<MediaJobDownloadResponse> {
    validate_media_url(&payload.url)?;
    validate_output_template(&payload.output_template)?;
    if let Some(sel) = &payload.format_selector {
        validate_format_selector(sel)?;
    }
    // Template directory part must itself be a safe scoped relative path.
    let dir_part = payload.output_template.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
    if !dir_part.is_empty() && !fbuploadpro_desktop::validation::is_safe_relative_path(dir_part) {
        return Err(BridgeError::validation("outputTemplate directory part must be a safe relative path"));
    }
    let scope_root = state.scopes.resolve(&payload.output_scope_id, "")?;
    let bin = ready_binary(&state, "yt-dlp")?;
    let output_path = scope_root.join(&payload.output_template);
    let mut argv = fbuploadpro_desktop::media::yt_dlp_download_argv(
        &payload.url,
        &output_path,
        payload.format_selector.as_deref(),
        payload.subtitles.as_ref().map(|s| (s.languages.as_slice(), s.format.as_deref())),
    )?;
    argv.push("--no-playlist".to_string());
    argv.push("--print".to_string());
    argv.push("after_move:filepath".to_string());
    let rec = state.processes.spawn(
        None,
        "yt-dlp",
        &bin,
        &argv,
        None,
        &HashMap::new(),
        None,
        payload.namespace.clone(),
        payload.job_id.clone(),
    )?;
    state.media_jobs.lock().unwrap().insert(
        rec.run_id.clone(),
        MediaJobInfo {
            kind: MediaJobKind::Download,
            namespace: payload.namespace.clone(),
            job_id: payload.job_id.clone(),
            output_scope_id: payload.output_scope_id.clone(),
            output_relative_path: None,
            scope_root: Some(scope_root),
            input_duration_seconds: None,
            partial_output_path: None,
            printed_outputs: Vec::new(),
        },
    );
    Ok(MediaJobDownloadResponse { run_id: rec.run_id, output_scope_id: payload.output_scope_id, output_template: payload.output_template })
}

#[tauri::command]
pub fn media_probe(state: State<'_, AppState>, payload: MediaProbePayload) -> BridgeResult<MediaProbeResponse> {
    let input = state.scopes.resolve(&payload.scope_id, &payload.relative_path)?;
    // ffprobe resolves from the ffmpeg artifact bundle.
    let entry = manifest_entry("ffmpeg").ok_or_else(|| BridgeError::validation("unknown binaryId"))?;
    let ffprobe = artifact_binary_path(&state.artifact_cache_dir(), &entry, "ffprobe")?;
    let (out, _err, code) = run_blocking(
        &ffprobe,
        &[
            "-v".to_string(),
            "quiet".to_string(),
            "-show_format".to_string(),
            "-show_streams".to_string(),
            "-of".to_string(),
            "json".to_string(),
            input.to_string_lossy().into_owned(),
        ],
        60,
    )
    .map_err(|e| if e.code == "MEDIA_TIMEOUT" { e } else { BridgeError::new("MEDIA_PROBE_FAILED", "That file could not be probed.", false) })?;
    if code != 0 {
        return Err(BridgeError::new("MEDIA_PROBE_FAILED", "That file could not be probed.", false));
    }
    let json: serde_json::Value = serde_json::from_slice(&out).map_err(|_| BridgeError::new("MEDIA_PROBE_FAILED", "That file could not be probed.", false))?;
    let probe = parse_probe(&json)?;
    Ok(MediaProbeResponse {
        duration_seconds: probe.duration_seconds,
        format_name: probe.format_name,
        size_bytes: probe.size_bytes,
        streams: probe.streams,
    })
}

#[tauri::command]
pub fn media_convert(state: State<'_, AppState>, payload: MediaConvertPayload) -> BridgeResult<MediaJobResponse> {
    let input = state.scopes.resolve(&payload.input_scope_id, &payload.input_relative_path)?;
    let output = state.scopes.resolve(&payload.output_scope_id, &payload.output_relative_path)?;
    if output.exists() && !payload.overwrite.unwrap_or(false) {
        return Err(BridgeError::fs_already_exists());
    }
    let opts = ConvertOptions {
        video: payload.video.as_ref().map(|v| ConvertVideoOptions {
            codec: v.codec.clone(),
            width: v.width,
            height: v.height,
            bitrate_kbps: v.bitrate_kbps,
        }),
        audio: payload.audio.as_ref().map(|a| ConvertAudioOptions { codec: a.codec.clone(), bitrate_kbps: a.bitrate_kbps }),
        trim_start: payload.trim.as_ref().and_then(|t| t.start_seconds),
        trim_end: payload.trim.as_ref().and_then(|t| t.end_seconds),
        overwrite: payload.overwrite.unwrap_or(false),
    };
    let ffmpeg = ffmpeg_path(&state)?;
    let argv = ffmpeg_convert_argv(&input, &output, &opts)?;
    // Probe the input duration for progress percent (best-effort: unknown
    // duration just means percent stays null, never a failure).
    let duration = media_probe_duration(&state, &input);
    let rec = state.processes.spawn(
        None,
        "ffmpeg",
        &ffmpeg,
        &argv,
        None,
        &HashMap::new(),
        None,
        payload.namespace.clone(),
        payload.job_id.clone(),
    )?;
    state.media_jobs.lock().unwrap().insert(
        rec.run_id.clone(),
        MediaJobInfo {
            kind: MediaJobKind::Convert,
            namespace: payload.namespace.clone(),
            job_id: payload.job_id.clone(),
            output_scope_id: payload.output_scope_id.clone(),
            output_relative_path: Some(payload.output_relative_path.clone()),
            scope_root: None,
            input_duration_seconds: duration,
            partial_output_path: Some(output),
            printed_outputs: Vec::new(),
        },
    );
    Ok(MediaJobResponse { run_id: rec.run_id, output_scope_id: payload.output_scope_id, output_relative_path: payload.output_relative_path })
}

fn media_probe_duration(state: &AppState, input: &Path) -> Option<f64> {
    let entry = manifest_entry("ffmpeg")?;
    let ffprobe = artifact_binary_path(&state.artifact_cache_dir(), &entry, "ffprobe").ok()?;
    let (out, _, code) = run_blocking(
        &ffprobe,
        &[
            "-v".to_string(),
            "quiet".to_string(),
            "-show_format".to_string(),
            "-of".to_string(),
            "json".to_string(),
            input.to_string_lossy().into_owned(),
        ],
        60,
    )
    .ok()?;
    if code != 0 {
        return None;
    }
    let json: serde_json::Value = serde_json::from_slice(&out).ok()?;
    parse_probe(&json).ok()?.duration_seconds
}

#[tauri::command]
pub fn media_transcribe(state: State<'_, AppState>, payload: MediaTranscribePayload) -> BridgeResult<MediaJobResponse> {
    let input = state.scopes.resolve(&payload.input_scope_id, &payload.input_relative_path)?;
    if let Some(lang) = &payload.language {
        if lang != "auto" && !(lang.len() == 2 && lang.bytes().all(|b| b.is_ascii_lowercase())) {
            return Err(BridgeError::validation("language must be ISO-639-1 or 'auto'"));
        }
    }
    let whisper = ready_binary(&state, "whisper")?;
    let model_entry = manifest_entry(&payload.model_id).filter(|e| e.kind == "model").ok_or_else(|| BridgeError::validation("unknown modelId"))?;
    let model_path = artifact_model_path(&state.artifact_cache_dir(), &model_entry)?;
    let format = payload.output_format.clone().unwrap_or_else(|| "text".to_string());
    let output_ext = match format.as_str() {
        "text" => "txt",
        "srt" => "srt",
        "vtt" => "vtt",
        "json" => "json",
        _ => return Err(BridgeError::validation("outputFormat must be text, srt, vtt, or json")),
    };
    let output_scope_root = state.scopes.resolve(&payload.output_scope_id, "")?;
    let output_path = match &payload.output_relative_path {
        Some(rel) => state.scopes.resolve(&payload.output_scope_id, rel)?,
        None => transcribe_output_path(&input, &output_scope_root, output_ext),
    };
    let output_relative = output_path
        .strip_prefix(&output_scope_root)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| output_path.to_string_lossy().into_owned());
    // whisper.cpp writes <base>.<ext>; pass the base without extension.
    let output_base = output_path.with_extension("");
    let flag = match format.as_str() {
        "text" => "--output-txt",
        "srt" => "--output-srt",
        "vtt" => "--output-vtt",
        _ => "--output-json",
    };
    let mut argv = vec![
        "-m".to_string(),
        model_path.to_string_lossy().into_owned(),
        "-f".to_string(),
        input.to_string_lossy().into_owned(),
        "-of".to_string(),
        output_base.to_string_lossy().into_owned(),
        flag.to_string(),
    ];
    if let Some(lang) = &payload.language {
        if lang != "auto" {
            argv.push("-l".to_string());
            argv.push(lang.clone());
        }
    }
    let rec = state.processes.spawn(
        None,
        "whisper",
        &whisper,
        &argv,
        None,
        &HashMap::new(),
        None,
        payload.namespace.clone(),
        payload.job_id.clone(),
    )?;
    state.media_jobs.lock().unwrap().insert(
        rec.run_id.clone(),
        MediaJobInfo {
            kind: MediaJobKind::Transcribe,
            namespace: payload.namespace.clone(),
            job_id: payload.job_id.clone(),
            output_scope_id: payload.output_scope_id.clone(),
            output_relative_path: Some(output_relative.clone()),
            scope_root: None,
            input_duration_seconds: None,
            partial_output_path: None,
            printed_outputs: Vec::new(),
        },
    );
    Ok(MediaJobResponse { run_id: rec.run_id, output_scope_id: payload.output_scope_id, output_relative_path: output_relative })
}
