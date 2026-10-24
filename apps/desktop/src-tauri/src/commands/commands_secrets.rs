//! §8.3 secret commands. Values go to the OS keychain only (never a file,
//! never localStorage, never a FBUploadPro server, never a log or error).
//! `secrets_list` answers from a names-only registry because the keyring
//! API has no enumeration; the registry holds names, never values.

use fbuploadpro_desktop::errors::BridgeResult;
use tauri::State;

use super::state::AppState;
use super::types::*;

#[tauri::command]
pub fn secrets_set(state: State<'_, AppState>, payload: SecretsSetPayload) -> BridgeResult<SecretsSetResponse> {
    state.secrets.set(&payload.service, &payload.key_name, &payload.value)?;
    let mut names = state.secret_names.lock().unwrap();
    let entry = names.entry(payload.service.clone()).or_default();
    if !entry.contains(&payload.key_name) {
        entry.push(payload.key_name.clone());
        entry.sort();
    }
    drop(names);
    state.persist_secret_names();
    Ok(SecretsSetResponse { service: payload.service, key_name: payload.key_name, stored: true })
}

#[tauri::command]
pub fn secrets_get(state: State<'_, AppState>, payload: SecretsKeyPayload) -> BridgeResult<SecretsGetResponse> {
    // Returned ONLY to the local webview (the app itself). Callers must hold
    // it in memory only for the duration of a call.
    let value = state.secrets.get(&payload.service, &payload.key_name)?;
    Ok(SecretsGetResponse { service: payload.service, key_name: payload.key_name, value })
}

#[tauri::command]
pub fn secrets_has(state: State<'_, AppState>, payload: SecretsKeyPayload) -> BridgeResult<SecretsHasResponse> {
    let present = state.secrets.has(&payload.service, &payload.key_name)?;
    Ok(SecretsHasResponse { service: payload.service, key_name: payload.key_name, present })
}

#[tauri::command]
pub fn secrets_list(state: State<'_, AppState>, payload: SecretsListPayload) -> BridgeResult<SecretsListResponse> {
    let names = state.secret_names.lock().unwrap().get(&payload.service).cloned().unwrap_or_default();
    Ok(SecretsListResponse { service: payload.service, key_names: names })
}

#[tauri::command]
pub fn secrets_delete(state: State<'_, AppState>, payload: SecretsKeyPayload) -> BridgeResult<SecretsDeleteResponse> {
    // Idempotent: deleting a missing key still returns deleted: true.
    state.secrets.delete(&payload.service, &payload.key_name)?;
    let mut names = state.secret_names.lock().unwrap();
    if let Some(entry) = names.get_mut(&payload.service) {
        entry.retain(|n| n != &payload.key_name);
    }
    drop(names);
    state.persist_secret_names();
    Ok(SecretsDeleteResponse { service: payload.service, key_name: payload.key_name, deleted: true })
}
