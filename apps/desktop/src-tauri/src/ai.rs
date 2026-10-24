//! §10 bridge-mediated AI: provider request/response translation in Rust.
//! The key is read from the OS keychain inside the shell and attached to the
//! request inside Rust; it NEVER appears in a constructed body (only in the
//! Authorization header), in a log line, or in an error. Request schemas are
//! strict (deny-unknown-fields) so a renderer-supplied key is a
//! VALIDATION_ERROR, not silently stripped.

use serde::{Deserialize, Serialize};

use crate::errors::{BridgeError, BridgeResult};

pub const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub role: String, // system | user | assistant
    pub content: String,
}

/// AI request shape — mirrors the TS schema field-for-field. Unknown fields
/// (including apiKey/key/token/secret) are rejected by serde.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiRequest {
    pub service: String,
    pub provider: String, // openai | anthropic | openai-compatible
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub model: String,
    pub messages: Vec<AiMessage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
}

pub fn validate_ai_request(req: &AiRequest) -> BridgeResult<()> {
    if !crate::validation::is_valid_name(&req.service) {
        return Err(BridgeError::validation("service name is invalid"));
    }
    if !matches!(req.provider.as_str(), "openai" | "anthropic" | "openai-compatible") {
        return Err(BridgeError::validation("provider is invalid"));
    }
    if !crate::validation::is_valid_model(&req.model) {
        return Err(BridgeError::validation("model name is invalid"));
    }
    if req.messages.is_empty() || req.messages.len() > 100 {
        return Err(BridgeError::validation("messages must contain 1-100 entries"));
    }
    for m in &req.messages {
        if !matches!(m.role.as_str(), "system" | "user" | "assistant") || m.content.is_empty() || m.content.chars().count() > 100_000 {
            return Err(BridgeError::validation("message role or content is invalid"));
        }
    }
    if let Some(t) = req.temperature {
        if !(0.0..=2.0).contains(&t) {
            return Err(BridgeError::validation("temperature must be 0-2"));
        }
    }
    if let Some(t) = req.timeout_ms {
        if !(10_000..=600_000).contains(&t) {
            return Err(BridgeError::validation("timeoutMs must be 10000-600000"));
        }
    }
    match req.provider.as_str() {
        "openai-compatible" => {
            let Some(base) = &req.base_url else {
                return Err(BridgeError::validation("baseUrl is required for openai-compatible"));
            };
            if !crate::validation::is_clean_http_url(base) || !base.starts_with("https://") {
                return Err(BridgeError::validation("baseUrl must be https without embedded credentials"));
            }
            if let Some(host) = crate::validation::url_host(base) {
                if crate::validation::is_private_ip_literal(&host) {
                    return Err(BridgeError::validation("baseUrl must not point at a private or loopback host"));
                }
            }
        }
        _ => {
            if req.base_url.is_some() {
                return Err(BridgeError::validation("baseUrl is forbidden for named providers"));
            }
        }
    }
    Ok(())
}

/// Provider endpoint URL (never includes the key).
pub fn provider_url(req: &AiRequest) -> BridgeResult<String> {
    match req.provider.as_str() {
        "openai" => Ok("https://api.openai.com/v1/chat/completions".to_string()),
        "anthropic" => Ok("https://api.anthropic.com/v1/messages".to_string()),
        "openai-compatible" => {
            let base = req.base_url.clone().unwrap_or_default();
            Ok(format!("{}/chat/completions", base.trim_end_matches('/')))
        }
        _ => Err(BridgeError::validation("provider is invalid")),
    }
}

/// Build the provider request body. The returned JSON contains NO key — the
/// caller attaches the key only as an Authorization header.
pub fn build_request_body(req: &AiRequest) -> BridgeResult<serde_json::Value> {
    match req.provider.as_str() {
        "openai" | "openai-compatible" => {
            let mut body = serde_json::json!({
                "model": req.model,
                "messages": req.messages.iter().map(|m| serde_json::json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
            });
            if let Some(t) = req.max_tokens {
                body["max_tokens"] = serde_json::json!(t);
            }
            if let Some(t) = req.temperature {
                body["temperature"] = serde_json::json!(t);
            }
            Ok(body)
        }
        "anthropic" => {
            // Anthropic takes `system` separately; non-system messages stay.
            let system: Vec<&str> = req.messages.iter().filter(|m| m.role == "system").map(|m| m.content.as_str()).collect();
            let messages: Vec<serde_json::Value> = req.messages.iter().filter(|m| m.role != "system").map(|m| serde_json::json!({"role": m.role, "content": m.content})).collect();
            let mut body = serde_json::json!({
                "model": req.model,
                "max_tokens": req.max_tokens.unwrap_or(1024),
                "messages": messages,
            });
            if !system.is_empty() {
                body["system"] = serde_json::json!(system.join("\n"));
            }
            if let Some(t) = req.temperature {
                body["temperature"] = serde_json::json!(t);
            }
            Ok(body)
        }
        _ => Err(BridgeError::validation("provider is invalid")),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AiOutput {
    pub output: String,
    pub model: String,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub finish_reason: Option<String>,
}

/// Parse a provider response body into the bridge output shape.
pub fn parse_response(provider: &str, body: &serde_json::Value) -> BridgeResult<AiOutput> {
    match provider {
        "openai" | "openai-compatible" => {
            let choice = body.get("choices").and_then(|c| c.as_array()).and_then(|a| a.first()).ok_or_else(|| BridgeError::new("AI_PROVIDER_ERROR", "The AI provider returned an unexpected response.", true))?;
            let content = choice.get("message").and_then(|m| m.get("content"));
            let output = match content {
                Some(serde_json::Value::String(s)) => s.clone(),
                Some(serde_json::Value::Array(parts)) => parts.iter().filter_map(|p| p.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())).collect::<Vec<_>>().join(""),
                _ => String::new(),
            };
            let usage = body.get("usage");
            Ok(AiOutput {
                output,
                model: body.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                input_tokens: usage.and_then(|u| u.get("prompt_tokens")).and_then(|v| v.as_u64()),
                output_tokens: usage.and_then(|u| u.get("completion_tokens")).and_then(|v| v.as_u64()),
                finish_reason: choice.get("finish_reason").and_then(|v| v.as_str()).map(|s| s.to_string()),
            })
        }
        "anthropic" => {
            let text: String = body
                .get("content")
                .and_then(|c| c.as_array())
                .map(|arr| arr.iter().filter_map(|b| if b.get("type").and_then(|t| t.as_str()) == Some("text") { b.get("text").and_then(|t| t.as_str()) } else { None }).collect::<Vec<_>>().join(""))
                .unwrap_or_default();
            let usage = body.get("usage");
            Ok(AiOutput {
                output: text,
                model: body.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                input_tokens: usage.and_then(|u| u.get("input_tokens")).and_then(|v| v.as_u64()),
                output_tokens: usage.and_then(|u| u.get("output_tokens")).and_then(|v| v.as_u64()),
                finish_reason: body.get("stop_reason").and_then(|v| v.as_str()).map(|s| s.to_string()),
            })
        }
        _ => Err(BridgeError::validation("provider is invalid")),
    }
}

/// Map an HTTP status (+ optional Retry-After seconds) to a §11 error.
/// 429 -> AI_RATE_LIMITED (retryable, retryAfterMs); 5xx/network -> provider
/// error retryable; other 4xx -> provider error not retryable.
pub fn map_http_error(status: u16, retry_after_secs: Option<u64>) -> BridgeError {
    if status == 429 {
        let mut d = crate::errors::ErrorDetails::new();
        d.retry_after_ms = retry_after_secs.map(|s| s * 1000);
        return BridgeError::new("AI_RATE_LIMITED", "The AI provider is rate-limiting requests. Try again shortly.", true).with_details(d);
    }
    if status >= 500 {
        return BridgeError::new("AI_PROVIDER_ERROR", "The AI provider returned an error. Try again.", true);
    }
    BridgeError::new("AI_PROVIDER_ERROR", "The AI provider rejected the request.", false)
}

/// Log line for an AI call: provider/model/status/token counts ONLY.
/// Prompt content, message content, and model output are never logged.
pub fn sanitized_log_line(provider: &str, model: &str, status: &str, input_tokens: Option<u64>, output_tokens: Option<u64>) -> String {
    format!("ai_call provider={provider} model={model} status={status} input_tokens={} output_tokens={}",
        input_tokens.map(|v| v.to_string()).unwrap_or_else(|| "-".to_string()),
        output_tokens.map(|v| v.to_string()).unwrap_or_else(|| "-".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(provider: &str) -> AiRequest {
        AiRequest {
            service: "nicheforge".into(),
            provider: provider.into(),
            base_url: None,
            model: "gpt-4o-mini".into(),
            messages: vec![AiMessage { role: "user".into(), content: "hi".into() }],
            max_tokens: None,
            temperature: None,
            timeout_ms: None,
            namespace: None,
            job_id: None,
        }
    }

    #[test]
    fn key_field_is_a_validation_error_not_stripped() {
        let json = serde_json::json!({
            "service": "nicheforge", "provider": "openai", "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hi"}], "apiKey": "sk-secret"
        });
        assert!(serde_json::from_value::<AiRequest>(json).is_err());
        let json2 = serde_json::json!({
            "service": "nicheforge", "provider": "openai", "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hi"}], "token": "x"
        });
        assert!(serde_json::from_value::<AiRequest>(json2).is_err());
        assert!(serde_json::from_value::<AiRequest>(serde_json::json!({
            "service": "nicheforge", "provider": "openai", "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hi"}]
        }))
        .is_ok());
    }

    #[test]
    fn body_construction_never_contains_the_key() {
        // The key is never an input to body construction at all; assert the
        // body has no key-like field and the endpoint is the named provider's.
        let body = build_request_body(&req("openai")).unwrap();
        let text = serde_json::to_string(&body).unwrap();
        assert!(!text.to_lowercase().contains("apikey") && !text.contains("sk-"));
        assert_eq!(provider_url(&req("openai")).unwrap(), "https://api.openai.com/v1/chat/completions");
        assert_eq!(provider_url(&req("anthropic")).unwrap(), "https://api.anthropic.com/v1/messages");
        let mut compat = req("openai-compatible");
        compat.base_url = Some("https://api.example.com/v1/".into());
        assert_eq!(provider_url(&compat).unwrap(), "https://api.example.com/v1/chat/completions");
        // baseUrl forbidden for named providers, required for compatible.
        assert!(validate_ai_request(&req("openai")).is_ok());
        let mut bad = req("openai");
        bad.base_url = Some("https://evil.example".into());
        assert!(validate_ai_request(&bad).is_err());
        assert!(validate_ai_request(&req("openai-compatible")).is_err());
    }

    #[test]
    fn anthropic_system_split_and_response_parsing() {
        let mut r = req("anthropic");
        r.messages = vec![
            AiMessage { role: "system".into(), content: "Be brief.".into() },
            AiMessage { role: "user".into(), content: "Hello".into() },
        ];
        let body = build_request_body(&r).unwrap();
        assert_eq!(body["system"], "Be brief.");
        assert_eq!(body["messages"][0]["role"], "user");
        let parsed = parse_response("anthropic", &serde_json::json!({
            "model": "claude-x", "stop_reason": "end_turn",
            "content": [{"type": "text", "text": "Hi there"}],
            "usage": {"input_tokens": 10, "output_tokens": 4}
        }))
        .unwrap();
        assert_eq!(parsed.output, "Hi there");
        assert_eq!(parsed.input_tokens, Some(10));
        let openai = parse_response("openai", &serde_json::json!({
            "model": "gpt-4o-mini", "choices": [{"message": {"content": "hello"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3}
        }))
        .unwrap();
        assert_eq!(openai.output, "hello");
        assert_eq!(openai.output_tokens, Some(3));
    }

    #[test]
    fn error_mapping_and_log_sanitisation() {
        let e = map_http_error(429, Some(30));
        assert_eq!(e.code, "AI_RATE_LIMITED");
        assert!(e.retryable);
        assert_eq!(e.details.as_ref().unwrap().retry_after_ms, Some(30000));
        assert!(map_http_error(500, None).retryable);
        assert!(!map_http_error(400, None).retryable);
        let line = sanitized_log_line("openai", "gpt-4o-mini", "succeeded", Some(5), Some(3));
        assert!(line.contains("gpt-4o-mini") && !line.contains("hello") && !line.contains("prompt"));
    }
}
