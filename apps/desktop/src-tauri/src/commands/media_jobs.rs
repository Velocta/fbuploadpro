//! Media-job tracking for event enrichment (§9 + §7.6).
//! The process-event router (built in main.rs setup) always emits the
//! `desktop:process:*` events; when a runId is a media job it ALSO emits
//! `desktop:media:progress` (parsed from stdout/stderr) and, on exit, exactly
//! one `desktop:media:done` — with outputs, and with a failed convert's
//! partial output deleted before the event fires.

use std::path::PathBuf;

use fbuploadpro_desktop::media::parse_ffmpeg_time;
use fbuploadpro_desktop::processes::ProcessEvent;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MediaJobKind {
    Download,
    Convert,
    Transcribe,
}

#[derive(Debug, Clone)]
pub struct MediaJobInfo {
    pub kind: MediaJobKind,
    pub namespace: Option<String>,
    pub job_id: Option<String>,
    /// For downloads: scope-relative output template (for display only).
    /// For convert/transcribe: the output scope + relative path.
    pub output_scope_id: String,
    pub output_relative_path: Option<String>,
    /// Download: the scope root, so printed file paths can be relativised.
    pub scope_root: Option<PathBuf>,
    /// Convert: probed input duration, for percent computation.
    pub input_duration_seconds: Option<f64>,
    /// Convert: delete this file on failure (partial output).
    pub partial_output_path: Option<PathBuf>,
    /// Download: file paths printed by yt-dlp (`--print after_move:filepath`).
    pub printed_outputs: Vec<PathBuf>,
}

impl MediaJobInfo {
    pub fn phase(&self) -> &'static str {
        match self.kind {
            MediaJobKind::Download => "downloading",
            MediaJobKind::Convert => "converting",
            MediaJobKind::Transcribe => "transcribing",
        }
    }
}

/// Parse a yt-dlp progress line like `[download]  45.2% of 12.34MiB at 1.2MiB/s`.
pub fn parse_yt_dlp_percent(chunk: &str) -> Option<f64> {
    for line in chunk.lines() {
        if line.contains("[download]") && line.contains('%') {
            let after = line.split("[download]").nth(1)?;
            let num: String = after.trim_start().chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
            if let Ok(p) = num.parse::<f64>() {
                return Some(p);
            }
        }
    }
    None
}

/// Progress percent for a media job chunk, if computable.
pub fn media_percent(job: &MediaJobInfo, chunk: &str) -> Option<f64> {
    match job.kind {
        MediaJobKind::Download => parse_yt_dlp_percent(chunk),
        MediaJobKind::Convert => {
            let mut pct = None;
            for line in chunk.lines() {
                if let Some(t) = parse_ffmpeg_time(line.trim()) {
                    if let Some(d) = job.input_duration_seconds {
                        if d > 0.0 {
                            pct = Some((t / d * 100.0).min(100.0));
                        }
                    }
                }
            }
            pct
        }
        MediaJobKind::Transcribe => None,
    }
}

/// Whether a stdout line from yt-dlp is a printed output filepath.
pub fn is_printed_filepath(line: &str, scope_root: &std::path::Path) -> Option<PathBuf> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() && path.starts_with(scope_root) && path.is_file() {
        Some(path)
    } else {
        None
    }
}

/// Progress event: (phase, percent, detail).
pub type MediaProgress = (String, Option<f64>, Option<String>);
/// Done event: (status, outputs, error).
pub type MediaDone = (String, Vec<super::types::MediaOutputRef>, Option<fbuploadpro_desktop::errors::BridgeError>);

/// Map a process event to the media events it implies (if any). The caller
/// emits process events itself; this returns (progress, done) to emit.
pub fn media_events_for_process_event(
    event: &ProcessEvent,
    job: &mut MediaJobInfo,
) -> (Option<MediaProgress>, Option<MediaDone>) {
    match event {
        ProcessEvent::Stdout { chunk, .. } | ProcessEvent::Stderr { chunk, .. } => {
            // Collect printed download outputs from stdout lines.
            if job.kind == MediaJobKind::Download {
                if let Some(root) = &job.scope_root {
                    for line in chunk.lines() {
                        if let Some(p) = is_printed_filepath(line, root) {
                            if !job.printed_outputs.contains(&p) {
                                job.printed_outputs.push(p);
                            }
                        }
                    }
                }
            }
            let pct = media_percent(job, chunk);
            let detail = if job.kind == MediaJobKind::Download {
                chunk.lines().find(|l| l.contains("[download]")).map(|l| l.trim().to_string())
            } else {
                None
            };
            (Some((job.phase().to_string(), pct, detail)), None)
        }
        ProcessEvent::Exit { exit_code, reason, .. } => {
            let succeeded = matches!(reason, fbuploadpro_desktop::processes::ExitReason::Completed) && *exit_code == Some(0);
            let status = match reason {
                fbuploadpro_desktop::processes::ExitReason::Cancelled => "cancelled",
                fbuploadpro_desktop::processes::ExitReason::Completed if *exit_code == Some(0) => "succeeded",
                _ => "failed",
            };
            let mut outputs = Vec::new();
            if succeeded {
                match job.kind {
                    MediaJobKind::Download => {
                        if let Some(root) = &job.scope_root {
                            for p in &job.printed_outputs {
                                if let Ok(rel) = p.strip_prefix(root) {
                                    outputs.push(super::types::MediaOutputRef {
                                        scope_id: job.output_scope_id.clone(),
                                        relative_path: rel.to_string_lossy().into_owned(),
                                    });
                                }
                            }
                        }
                    }
                    MediaJobKind::Convert | MediaJobKind::Transcribe => {
                        if let Some(rel) = &job.output_relative_path {
                            outputs.push(super::types::MediaOutputRef { scope_id: job.output_scope_id.clone(), relative_path: rel.clone() });
                        }
                    }
                }
            } else if job.kind == MediaJobKind::Convert {
                // A failed convert never leaves a half-file presented as success.
                if let Some(partial) = &job.partial_output_path {
                    let _ = std::fs::remove_file(partial);
                }
            }
            let error = if succeeded || status == "cancelled" {
                None
            } else {
                Some(match job.kind {
                    MediaJobKind::Download => fbuploadpro_desktop::errors::BridgeError::new("MEDIA_DOWNLOAD_FAILED", "The download failed.", true),
                    MediaJobKind::Convert => fbuploadpro_desktop::errors::BridgeError::new("MEDIA_CONVERT_FAILED", "The conversion failed.", true),
                    MediaJobKind::Transcribe => fbuploadpro_desktop::errors::BridgeError::new("TRANSCRIBE_FAILED", "The transcription failed.", true),
                })
            };
            (None, Some((status.to_string(), outputs, error)))
        }
    }
}
