//! §9 generic media primitives — pure translation/parsing only.
//! Structured options -> binary argv happens here (never raw renderer args);
//! yt-dlp/ffprobe JSON is parsed bridge-side into whitelisted shapes; the raw
//! dumps are never returned to the renderer.

use serde::{Deserialize, Serialize};

use crate::errors::{BridgeError, BridgeResult};
use crate::validation::{is_language_code, validate_media_url};

// ---------------------------------------------------------------------------
// yt-dlp
// ---------------------------------------------------------------------------

const ALLOWED_TEMPLATE_FIELDS: [&str; 4] = ["title", "id", "ext", "upload_date"];

/// Validate the restricted output-template subset (§9): only the four allowed
/// `%(field)s` placeholders, no `..`, no other field.
pub fn validate_output_template(template: &str) -> BridgeResult<()> {
    if template.contains("..") {
        return Err(BridgeError::validation("outputTemplate must not contain \"..\""));
    }
    let mut rest = template;
    while let Some(start) = rest.find("%(") {
        let after = &rest[start + 2..];
        let Some(end) = after.find(")s") else {
            return Err(BridgeError::validation("outputTemplate has a malformed placeholder"));
        };
        let field = &after[..end];
        if !ALLOWED_TEMPLATE_FIELDS.contains(&field) {
            return Err(BridgeError::validation("outputTemplate uses a field outside the allowed subset"));
        }
        rest = &after[end + 2..];
    }
    Ok(())
}

/// yt-dlp format-selector charset (§9): no shell metacharacters.
pub fn validate_format_selector(selector: &str) -> BridgeResult<()> {
    if selector.is_empty()
        || !selector.bytes().all(|b| b.is_ascii_alphanumeric() || b"+[]:<>=_".contains(&b))
    {
        return Err(BridgeError::validation("formatSelector contains characters outside the allowed set"));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpFormat {
    pub format_id: String,
    pub ext: Option<String>,
    pub resolution: Option<String>,
    pub filesize_bytes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpMetadata {
    pub title: Option<String>,
    pub uploader: Option<String>,
    pub duration_seconds: Option<f64>,
    pub thumbnail_url: Option<String>,
    pub formats: Vec<YtDlpFormat>,
}

/// Parse yt-dlp `--dump-json` into the whitelisted metadata shape.
pub fn parse_yt_dlp_metadata(json: &serde_json::Value) -> BridgeResult<YtDlpMetadata> {
    let formats = json
        .get("formats")
        .and_then(|f| f.as_array())
        .map(|arr| {
            arr.iter()
                .map(|f| YtDlpFormat {
                    format_id: f.get("format_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    ext: f.get("ext").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    resolution: f.get("resolution").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    filesize_bytes: f.get("filesize").and_then(|v| v.as_i64()),
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(YtDlpMetadata {
        title: json.get("title").and_then(|v| v.as_str()).map(|s| s.to_string()),
        uploader: json.get("uploader").and_then(|v| v.as_str()).map(|s| s.to_string()),
        duration_seconds: json.get("duration").and_then(|v| v.as_f64()),
        thumbnail_url: json.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string()),
        formats,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubtitleEntry {
    pub language: String,
    pub formats: Vec<String>,
}

/// Parse yt-dlp `--list-subs --dump-json`-style subtitle maps.
pub fn parse_subtitles(json: &serde_json::Value, languages: Option<&[String]>) -> BridgeResult<(Vec<SubtitleEntry>, Vec<SubtitleEntry>)> {
    let parse_map = |key: &str| -> Vec<SubtitleEntry> {
        let Some(map) = json.get(key).and_then(|v| v.as_object()) else { return Vec::new() };
        let mut out: Vec<SubtitleEntry> = map
            .iter()
            .filter(|(lang, _)| languages.is_none_or(|langs| langs.iter().any(|l| l == *lang)))
            .map(|(lang, v)| SubtitleEntry {
                language: lang.clone(),
                formats: v
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|f| f.get("ext").and_then(|e| e.as_str()).map(|s| s.to_string())).collect())
                    .unwrap_or_default(),
            })
            .collect();
        out.sort_by(|a, b| a.language.cmp(&b.language));
        out
    };
    Ok((parse_map("subtitles"), parse_map("automatic_captions")))
}

/// Download argv (bridge-side construction; the renderer never supplies raw
/// yt-dlp args). `output_path` is already scope-resolved by the handler.
pub fn yt_dlp_download_argv(url: &str, output_path: &std::path::Path, format_selector: Option<&str>, subtitles: Option<(&[String], Option<&str>)>) -> BridgeResult<Vec<String>> {
    validate_media_url(url)?;
    if let Some(sel) = format_selector {
        validate_format_selector(sel)?;
    }
    let mut argv = vec!["-o".to_string(), output_path.to_string_lossy().into_owned()];
    if let Some(sel) = format_selector {
        argv.push("-f".to_string());
        argv.push(sel.to_string());
    }
    if let Some((langs, fmt)) = subtitles {
        for lang in langs {
            if !is_language_code(lang) {
                return Err(BridgeError::validation("subtitle language code is invalid"));
            }
        }
        argv.push("--write-subs".to_string());
        argv.push("--sub-langs".to_string());
        argv.push(langs.join(","));
        if let Some(f) = fmt {
            argv.push("--sub-format".to_string());
            argv.push(f.to_string());
        }
    }
    argv.push(url.to_string());
    Ok(argv)
}

// ---------------------------------------------------------------------------
// ffprobe / ffmpeg
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeStream {
    pub index: i64,
    pub codec_type: String, // video | audio | subtitle | other
    pub codec_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channels: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub duration_seconds: Option<f64>,
    pub format_name: Option<String>,
    pub size_bytes: Option<i64>,
    pub streams: Vec<ProbeStream>,
}

fn parse_f64_str(v: Option<&serde_json::Value>) -> Option<f64> {
    match v {
        Some(serde_json::Value::Number(n)) => n.as_f64(),
        Some(serde_json::Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

/// Parse `ffprobe -show_format -show_streams -of json` into the whitelist.
pub fn parse_probe(json: &serde_json::Value) -> BridgeResult<ProbeResult> {
    let format = json.get("format");
    let streams = json
        .get("streams")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .map(|s| {
                    let raw_type = s.get("codec_type").and_then(|v| v.as_str()).unwrap_or("other");
                    let codec_type = match raw_type {
                        "video" | "audio" | "subtitle" => raw_type.to_string(),
                        _ => "other".to_string(),
                    };
                    ProbeStream {
                        index: s.get("index").and_then(|v| v.as_i64()).unwrap_or(0),
                        codec_type,
                        codec_name: s.get("codec_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        width: s.get("width").and_then(|v| v.as_i64()),
                        height: s.get("height").and_then(|v| v.as_i64()),
                        sample_rate: s.get("sample_rate").and_then(|v| v.as_str()).and_then(|x| x.parse().ok()),
                        channels: s.get("channels").and_then(|v| v.as_i64()),
                        duration_seconds: parse_f64_str(s.get("duration")),
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(ProbeResult {
        duration_seconds: format.and_then(|f| parse_f64_str(f.get("duration"))),
        format_name: format.and_then(|f| f.get("format_name")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        size_bytes: format.and_then(|f| f.get("size")).and_then(|v| v.as_str()).and_then(|x| x.parse().ok()),
        streams,
    })
}

#[derive(Debug, Clone, Default)]
pub struct ConvertVideoOptions {
    pub codec: Option<String>, // h264 | vp9 | copy
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub bitrate_kbps: Option<u32>,
}
#[derive(Debug, Clone, Default)]
pub struct ConvertAudioOptions {
    pub codec: Option<String>, // aac | opus | copy
    pub bitrate_kbps: Option<u32>,
}
#[derive(Debug, Clone, Default)]
pub struct ConvertOptions {
    pub video: Option<ConvertVideoOptions>,
    pub audio: Option<ConvertAudioOptions>,
    pub trim_start: Option<f64>,
    pub trim_end: Option<f64>,
    pub overwrite: bool,
}

fn ext_of(path: &std::path::Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default()
}

/// Codec/extension consistency (§9): the output extension must be compatible
/// with the chosen codecs (intersection when both video and audio are set).
pub fn validate_convert_extension(video_codec: Option<&str>, audio_codec: Option<&str>, output: &std::path::Path) -> BridgeResult<()> {
    let ext = ext_of(output);
    if ext.is_empty() {
        return Err(BridgeError::validation("output file must have an extension"));
    }
    let video_exts: Option<&[&str]> = match video_codec {
        Some("h264") => Some(&["mp4", "mov", "mkv"]),
        Some("vp9") => Some(&["webm", "mkv"]),
        Some("copy") | None => None,
        Some(_) => return Err(BridgeError::validation("unknown video codec")),
    };
    let audio_exts: Option<&[&str]> = match audio_codec {
        Some("aac") => Some(&["mp4", "m4a", "mov", "mkv"]),
        Some("opus") => Some(&["webm", "opus", "mkv"]),
        Some("copy") | None => None,
        Some(_) => return Err(BridgeError::validation("unknown audio codec")),
    };
    match (video_exts, audio_exts) {
        (Some(v), Some(a)) => {
            if v.iter().any(|e| a.contains(e) && *e == ext) {
                Ok(())
            } else {
                Err(BridgeError::validation("output extension is inconsistent with the chosen codecs"))
            }
        }
        (Some(v), None) => {
            if v.contains(&ext.as_str()) { Ok(()) } else { Err(BridgeError::validation("output extension is inconsistent with the chosen video codec")) }
        }
        (None, Some(a)) => {
            if a.contains(&ext.as_str()) { Ok(()) } else { Err(BridgeError::validation("output extension is inconsistent with the chosen audio codec")) }
        }
        (None, None) => Ok(()),
    }
}

/// Structured options -> exact ffmpeg argv. Bounds + trim ordering enforced.
pub fn ffmpeg_convert_argv(input: &std::path::Path, output: &std::path::Path, opts: &ConvertOptions) -> BridgeResult<Vec<String>> {
    if let (Some(v), Some(a)) = (&opts.video, &opts.audio) {
        validate_convert_extension(v.codec.as_deref(), a.codec.as_deref(), output)?;
    } else if let Some(v) = &opts.video {
        validate_convert_extension(v.codec.as_deref(), None, output)?;
    } else if let Some(a) = &opts.audio {
        validate_convert_extension(None, a.codec.as_deref(), output)?;
    }
    if let Some(w) = opts.video.as_ref().and_then(|v| v.width) {
        if w == 0 || w > 7680 {
            return Err(BridgeError::validation("video width out of range"));
        }
    }
    if let Some(h) = opts.video.as_ref().and_then(|v| v.height) {
        if h == 0 || h > 4320 {
            return Err(BridgeError::validation("video height out of range"));
        }
    }
    for b in [opts.video.as_ref().and_then(|v| v.bitrate_kbps), opts.audio.as_ref().and_then(|a| a.bitrate_kbps)].into_iter().flatten() {
        if b == 0 || b > 100_000 {
            return Err(BridgeError::validation("bitrate out of range"));
        }
    }
    if let (Some(s), Some(e)) = (opts.trim_start, opts.trim_end) {
        // partial_cmp (not >=): preserves the NaN-rejection semantics of !(s < e).
        if s.partial_cmp(&e) != Some(std::cmp::Ordering::Less) {
            return Err(BridgeError::validation("trim.startSeconds must be < trim.endSeconds"));
        }
    }
    let mut argv: Vec<String> = vec!["-y".to_string()];
    if let Some(s) = opts.trim_start {
        argv.push("-ss".to_string());
        argv.push(s.to_string());
    }
    if let Some(e) = opts.trim_end {
        argv.push("-to".to_string());
        argv.push(e.to_string());
    }
    argv.push("-i".to_string());
    argv.push(input.to_string_lossy().into_owned());
    if let Some(v) = &opts.video {
        if let Some(codec) = &v.codec {
            argv.push("-c:v".to_string());
            argv.push(match codec.as_str() { "h264" => "libx264".into(), "vp9" => "libvpx-vp9".into(), "copy" => "copy".into(), _ => codec.clone() });
        }
        if let (Some(w), Some(h)) = (v.width, v.height) {
            argv.push("-vf".to_string());
            argv.push(format!("scale={w}:{h}"));
        } else if let Some(w) = v.width {
            argv.push("-vf".to_string());
            argv.push(format!("scale={w}:-2"));
        } else if let Some(h) = v.height {
            argv.push("-vf".to_string());
            argv.push(format!("scale=-2:{h}"));
        }
        if let Some(b) = v.bitrate_kbps {
            argv.push("-b:v".to_string());
            argv.push(format!("{b}k"));
        }
    }
    if let Some(a) = &opts.audio {
        if let Some(codec) = &a.codec {
            argv.push("-c:a".to_string());
            argv.push(match codec.as_str() { "aac" => "aac".into(), "opus" => "libopus".into(), "copy" => "copy".into(), _ => codec.clone() });
        }
        if let Some(b) = a.bitrate_kbps {
            argv.push("-b:a".to_string());
            argv.push(format!("{b}k"));
        }
    }
    argv.push(output.to_string_lossy().into_owned());
    Ok(argv)
}

/// Derive the transcribe output path when omitted: input stem + format ext.
pub fn transcribe_output_path(input: &std::path::Path, output_dir: &std::path::Path, format: &str) -> std::path::PathBuf {
    let stem = input.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "transcript".to_string());
    output_dir.join(format!("{stem}.{format}"))
}

/// Parse an ffmpeg progress `time=HH:MM:SS.xx` token into seconds. The token
/// may appear anywhere in the line (ffmpeg's default stderr progress lines
/// are `frame=... time=00:00:05.00 ...`, not bare `time=` lines).
pub fn parse_ffmpeg_time(line: &str) -> Option<f64> {
    let idx = line.find("time=")?;
    let rest = line[idx + 5..].trim();
    let parts: Vec<&str> = rest.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let s: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn template_and_selector_injection_matrix() {
        assert!(validate_output_template("%(title)s-%(id)s.%(ext)s").is_ok());
        assert!(validate_output_template("%(upload_date)s_%(title)s.%(ext)s").is_ok());
        assert!(validate_output_template("%(duration)s.%(ext)s").is_err());
        assert!(validate_output_template("%(title)s/%(id)s.%(ext)s").is_ok()); // directory part is scope-checked by the handler
        assert!(validate_output_template("../%(title)s.%(ext)s").is_err());
        assert!(validate_output_template("%(title.%(ext)s").is_err());
        assert!(validate_format_selector("bestvideo+bestaudio").is_ok());
        assert!(validate_format_selector("bv[height<=1080]+ba").is_ok());
        // The frozen contract charset (TS regex + this validator, identical)
        // excludes '*' and '/': wildcard selectors are rejected until a
        // §12 amendment widens the set — see the PR body.
        assert!(validate_format_selector("bv*[height<=1080]").is_err());
        assert!(validate_format_selector("best; rm -rf /").is_err());
        assert!(validate_format_selector("best$(id)").is_err());
        assert!(validate_format_selector("").is_err());
    }

    #[test]
    fn metadata_parser_whitelists_fields() {
        let json = serde_json::json!({
            "title": "T", "uploader": "U", "duration": 42.5, "thumbnail": "https://x/img.jpg",
            "secret_field": "must not leak",
            "formats": [{"format_id": "18", "ext": "mp4", "resolution": "640x360", "filesize": 123, "url": "https://x/f"}]
        });
        let m = parse_yt_dlp_metadata(&json).unwrap();
        assert_eq!(m.title.as_deref(), Some("T"));
        assert_eq!(m.duration_seconds, Some(42.5));
        assert_eq!(m.formats[0].format_id, "18");
        let ser = serde_json::to_string(&m).unwrap();
        assert!(!ser.contains("secret_field") && !ser.contains("https://x/f"));
    }

    #[test]
    fn probe_parser_and_convert_argv() {
        let json = serde_json::json!({
            "format": {"duration": "10.5", "format_name": "mp4", "size": "12345"},
            "streams": [
                {"index": 0, "codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080},
                {"index": 1, "codec_type": "audio", "codec_name": "aac", "sample_rate": "44100", "channels": 2},
                {"index": 2, "codec_type": "attachment", "codec_name": "mjpeg"}
            ]
        });
        let p = parse_probe(&json).unwrap();
        assert_eq!(p.duration_seconds, Some(10.5));
        assert_eq!(p.streams[2].codec_type, "other");
        let argv = ffmpeg_convert_argv(
            Path::new("/in/a.mov"),
            Path::new("/out/b.mp4"),
            &ConvertOptions {
                video: Some(ConvertVideoOptions { codec: Some("h264".into()), width: Some(1280), height: None, bitrate_kbps: Some(2000) }),
                audio: Some(ConvertAudioOptions { codec: Some("aac".into()), bitrate_kbps: None }),
                trim_start: Some(1.0),
                trim_end: Some(5.0),
                overwrite: false,
            },
        )
        .unwrap();
        assert!(argv.contains(&"libx264".to_string()));
        assert!(argv.contains(&"scale=1280:-2".to_string()));
        // Extension/codec mismatch is a validation error, not a bad ffmpeg call.
        assert!(ffmpeg_convert_argv(Path::new("/in/a.mov"), Path::new("/out/b.webm"), &ConvertOptions {
            video: Some(ConvertVideoOptions { codec: Some("h264".into()), ..Default::default() }),
            ..Default::default()
        })
        .is_err());
        // Trim ordering.
        assert!(ffmpeg_convert_argv(Path::new("/in/a.mov"), Path::new("/out/b.mp4"), &ConvertOptions {
            trim_start: Some(10.0), trim_end: Some(5.0), ..Default::default()
        })
        .is_err());
        assert_eq!(parse_ffmpeg_time("time=00:01:30.50"), Some(90.5));
        assert_eq!(transcribe_output_path(Path::new("/in/clip.mp4"), Path::new("/out"), "srt"), Path::new("/out/clip.srt"));
    }

    #[test]
    fn download_argv_never_takes_raw_args() {
        let argv = yt_dlp_download_argv("https://example.com/watch?v=abc", Path::new("/out/%(title)s.%(ext)s"), None, None).unwrap();
        assert_eq!(argv.last().unwrap(), "https://example.com/watch?v=abc");
        assert!(yt_dlp_download_argv("http://127.0.0.1/v", Path::new("/out/x"), None, None).is_err());
    }
}
