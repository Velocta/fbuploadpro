//! §10 bridge-mediated AI calls. The key is read from the keychain inside
//! Rust and attached to the HTTPS request inside Rust; it never crosses
//! the invoke boundary in either direction, never appears in a log line,
//! and never appears in an error. Logs carry provider/model/status/token
//! counts only (see `sanitized_log_line`).

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use fbuploadpro_desktop::ai::{
    build_request_body, map_http_error, parse_response, provider_url, sanitized_log_line, validate_ai_request, AiMessage, AiRequest,
    ANTHROPIC_VERSION,
};
use fbuploadpro_desktop::errors::{BridgeError, BridgeResult};
use fbuploadpro_desktop::processes::iso_now;
use tauri::{AppHandle, Emitter, State};

use super::state::AppState;
use super::types::*;

fn to_lib_request(p: &AiCompletePayload) -> AiRequest {
    AiRequest {
        service: p.service.clone(),
        provider: p.provider.clone(),
        base_url: p.base_url.clone(),
        model: p.model.clone(),
        messages: p.messages.iter().map(|m| AiMessage { role: m.role.clone(), content: m.content.clone() }).collect(),
        max_tokens: p.max_tokens,
        temperature: p.temperature,
        timeout_ms: p.timeout_ms,
        namespace: p.namespace.clone(),
        job_id: p.job_id.clone(),
    }
}

fn ai_key(state: &AppState, service: &str) -> BridgeResult<String> {
    match state.secrets.get(service, "ai") {
        Ok(v) => Ok(v),
        Err(e) if e.code == "SECRETS_NOT_FOUND" => Err(BridgeError::ai_key_missing()),
        Err(e) => Err(e),
    }
}

fn build_client(timeout_ms: u64) -> BridgeResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|_| BridgeError::internal("Failed to build the AI HTTP client"))
}

fn send_request(req: &AiRequest, key: &str, timeout_ms: u64) -> BridgeResult<(u16, Option<u64>, serde_json::Value)> {
    let client = build_client(timeout_ms)?;
    let url = provider_url(req)?;
    let body = build_request_body(req)?;
    let mut builder = client.post(&url).json(&body);
    match req.provider.as_str() {
        "anthropic" => {
            builder = builder.header("x-api-key", key).header("anthropic-version", ANTHROPIC_VERSION);
        }
        _ => {
            builder = builder.header("Authorization", format!("Bearer {key}"));
        }
    }
    // The key exists ONLY in the header above. It is never put in the body
    // (build_request_body has no key input), never logged, never in errors.
    let resp = builder.send().map_err(|e| {
        if e.is_timeout() {
            BridgeError::new("AI_TIMEOUT", "The AI provider call timed out.", true)
        } else {
            BridgeError::new("AI_PROVIDER_ERROR", "The AI provider could not be reached.", true)
        }
    })?;
    let status = resp.status().as_u16();
    let retry_after = resp
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());
    let json: serde_json::Value = resp.json().unwrap_or(serde_json::Value::Null);
    Ok((status, retry_after, json))
}

#[tauri::command]
pub fn ai_complete(state: State<'_, AppState>, payload: AiCompletePayload) -> BridgeResult<AiCompleteResponse> {
    let req = to_lib_request(&payload);
    validate_ai_request(&req)?;
    let key = ai_key(&state, &req.service)?;
    let timeout = req.timeout_ms.unwrap_or(120_000);
    let (status, retry_after, json) = send_request(&req, &key, timeout)?;
    if status != 200 {
        eprintln!("{}", sanitized_log_line(&req.provider, &req.model, "failed", None, None));
        return Err(map_http_error(status, retry_after));
    }
    let out = parse_response(&req.provider, &json)?;
    eprintln!(
        "{}",
        sanitized_log_line(&req.provider, &req.model, "succeeded", out.input_tokens, out.output_tokens)
    );
    Ok(AiCompleteResponse {
        output: out.output,
        model: if out.model.is_empty() { req.model.clone() } else { out.model },
        usage: match (out.input_tokens, out.output_tokens) {
            (None, None) => None,
            (i, o) => Some(AiUsageWire { input_tokens: i, output_tokens: o }),
        },
        finish_reason: out.finish_reason,
    })
}

#[tauri::command]
pub fn ai_complete_stream(app: AppHandle, state: State<'_, AppState>, payload: AiCompleteStreamPayload) -> BridgeResult<AiStreamResponse> {
    let base = AiCompletePayload {
        service: payload.service.clone(),
        provider: payload.provider.clone(),
        base_url: payload.base_url.clone(),
        model: payload.model.clone(),
        messages: payload.messages.clone(),
        max_tokens: payload.max_tokens,
        temperature: payload.temperature,
        timeout_ms: payload.timeout_ms,
        namespace: payload.namespace.clone(),
        job_id: payload.job_id.clone(),
    };
    let req = to_lib_request(&base);
    validate_ai_request(&req)?;
    let request_id = payload.request_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let cancel = Arc::new(AtomicBool::new(false));
    let done = Arc::new(AtomicBool::new(false));
    state.ai_cancelled.lock().unwrap().insert(request_id.clone(), (cancel.clone(), done.clone()));
    let key = ai_key(&state, &req.service)?;
    let timeout = req.timeout_ms.unwrap_or(120_000);
    let handle = app.clone();
    let namespace = req.namespace.clone();
    let job_id = req.job_id.clone();
    let response_id = request_id.clone();
    std::thread::spawn(move || {
        // Atomic counter (not a mutating closure): the streaming closure
        // stays Fn, and seq stays usable after it returns.
        let seq = Arc::new(AtomicU64::new(0));
        let next_seq = || seq.fetch_add(1, Ordering::SeqCst);
        let emit_delta = |handle: &AppHandle, delta: String, seq: u64| {
            let _ = handle.emit(
                "desktop:ai:delta",
                AiDeltaEvent { request_id: request_id.clone(), seq, emitted_at: iso_now(), delta, namespace: namespace.clone(), job_id: job_id.clone() },
            );
        };
        let emit_done = |handle: &AppHandle, status: &str, output: Option<String>, usage: Option<AiUsageWire>, error: Option<BridgeError>, seq: u64| {
            let _ = handle.emit(
                "desktop:ai:done",
                AiDoneEvent {
                    request_id: request_id.clone(),
                    seq,
                    emitted_at: iso_now(),
                    status: status.to_string(),
                    output,
                    usage,
                    error,
                    namespace: namespace.clone(),
                    job_id: job_id.clone(),
                },
            );
        };
        // Real SSE streaming: the response body is read chunk by chunk and
        // each provider delta is emitted as it arrives. Dropping the
        // response on cancel aborts the in-flight HTTP request.
        let run = || -> Result<(String, Option<AiUsageWire>), BridgeError> {
            let client = build_client(timeout)?;
            let url = provider_url(&req)?;
            let mut body = build_request_body(&req)?;
            body["stream"] = serde_json::json!(true);
            let mut builder = client.post(&url).json(&body);
            match req.provider.as_str() {
                "anthropic" => {
                    builder = builder.header("x-api-key", &key).header("anthropic-version", ANTHROPIC_VERSION);
                }
                _ => {
                    builder = builder.header("Authorization", format!("Bearer {key}"));
                }
            }
            let mut resp = builder.send().map_err(|e| {
                if e.is_timeout() {
                    BridgeError::new("AI_TIMEOUT", "The AI provider call timed out.", true)
                } else {
                    BridgeError::new("AI_PROVIDER_ERROR", "The AI provider could not be reached.", true)
                }
            })?;
            let status = resp.status().as_u16();
            if status != 200 {
                let retry_after = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok());
                return Err(map_http_error(status, retry_after));
            }
            // The blocking response implements `Read`: stream it in small
            // reads (there is no `chunk()` on the blocking API) and split
            // SSE lines out of the accumulated buffer.
            use std::io::Read as _;
            let mut buffer = String::new();
            let mut output = String::new();
            let mut usage: Option<AiUsageWire> = None;
            let mut stream_done = false;
            let mut read_buf = [0u8; 8192];
            loop {
                if cancel.load(Ordering::SeqCst) {
                    return Err(BridgeError::new("AI_STREAM_CANCELLED", "cancelled", false));
                }
                if stream_done {
                    break;
                }
                match resp.read(&mut read_buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        buffer.push_str(&String::from_utf8_lossy(&read_buf[..n]));
                        // Process complete lines; keep a trailing partial line.
                        while let Some(pos) = buffer.find('\n') {
                            let line = buffer[..pos].trim().to_string();
                            buffer.drain(..=pos);
                            if let Some(data) = line.strip_prefix("data:") {
                                let data = data.trim();
                                if data == "[DONE]" {
                                    stream_done = true;
                                    break;
                                }
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if req.provider == "anthropic" {
                                        if json.get("type").and_then(|t| t.as_str()) == Some("content_block_delta") {
                                            if let Some(text) = json.get("delta").and_then(|d| d.get("text")).and_then(|t| t.as_str()) {
                                                if !text.is_empty() {
                                                    output.push_str(text);
                                                    emit_delta(&handle, text.to_string(), next_seq());
                                                }
                                            }
                                        }
                                        if json.get("type").and_then(|t| t.as_str()) == Some("message_stop") {
                                            if let Some(u) = json.get("usage") {
                                                usage = Some(AiUsageWire {
                                                    input_tokens: u.get("input_tokens").and_then(|v| v.as_u64()),
                                                    output_tokens: u.get("output_tokens").and_then(|v| v.as_u64()),
                                                });
                                            }
                                        }
                                    } else if let Some(delta) = json
                                        .get("choices")
                                        .and_then(|c| c.as_array())
                                        .and_then(|a| a.first())
                                        .and_then(|ch| ch.get("delta"))
                                    {
                                        if let Some(text) = delta.get("content").and_then(|t| t.as_str()) {
                                            if !text.is_empty() {
                                                output.push_str(text);
                                                emit_delta(&handle, text.to_string(), next_seq());
                                            }
                                        }
                                        if let Some(u) = json.get("usage") {
                                            usage = Some(AiUsageWire {
                                                input_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()),
                                                output_tokens: u.get("completion_tokens").and_then(|v| v.as_u64()),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => {
                        return Err(BridgeError::new("AI_PROVIDER_ERROR", "The AI provider stream ended unexpectedly.", true));
                    }
                }
            }
            Ok((output, usage))
        };
        match run() {
            Ok((output, usage)) => {
                eprintln!(
                    "{}",
                    sanitized_log_line(&req.provider, &req.model, "succeeded", usage.as_ref().and_then(|u| u.input_tokens), usage.as_ref().and_then(|u| u.output_tokens))
                );
                done.store(true, Ordering::SeqCst);
                emit_done(&handle, "succeeded", Some(output), usage, None, next_seq());
            }
            Err(e) if e.code == "AI_STREAM_CANCELLED" => {
                done.store(true, Ordering::SeqCst);
                emit_done(&handle, "cancelled", None, None, None, next_seq());
            }
            Err(e) => {
                done.store(true, Ordering::SeqCst);
                emit_done(&handle, "failed", None, None, Some(e), next_seq());
            }
        }
    });
    Ok(AiStreamResponse { request_id: response_id })
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, AppState>, payload: AiCancelPayload) -> BridgeResult<AiCancelResponse> {
    let map = state.ai_cancelled.lock().unwrap();
    let Some((cancel, done)) = map.get(&payload.request_id) else {
        return Err(BridgeError::ai_request_not_found());
    };
    if done.load(Ordering::SeqCst) {
        return Ok(AiCancelResponse { request_id: payload.request_id, cancelled: false });
    }
    cancel.store(true, Ordering::SeqCst);
    Ok(AiCancelResponse { request_id: payload.request_id, cancelled: true })
}

#[tauri::command]
pub fn ai_status(state: State<'_, AppState>, payload: AiStatusPayload) -> BridgeResult<AiStatusResponse> {
    let has_key = state.secrets.has(&payload.service, "ai")?;
    Ok(AiStatusResponse { service: payload.service, has_key })
}
