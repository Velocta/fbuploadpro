//! §8.3 secret storage: OS keychain via the `keyring` crate, service
//! `com.fbuploadpro.desktop`, account `<service>:<keyName>`.
//! Linux without a Secret Service yields SECRETS_UNAVAILABLE — NEVER a
//! plaintext file. This module contains no file fallback anywhere.
//! A trait seam lets unit tests use an in-memory store; production handlers
//! use the keyring store.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::errors::{BridgeError, BridgeResult};
use crate::validation::is_valid_name;

pub const KEYCHAIN_SERVICE: &str = "com.fbuploadpro.desktop";

pub fn account_name(service: &str, key_name: &str) -> String {
    format!("{service}:{key_name}")
}

pub fn validate_secret_key(service: &str, key_name: &str) -> BridgeResult<()> {
    if !is_valid_name(service) || !is_valid_name(key_name) {
        return Err(BridgeError::validation("service and keyName must match ^[a-z][a-z0-9-]{1,31}$"));
    }
    Ok(())
}

pub fn validate_secret_value(value: &str) -> BridgeResult<()> {
    if value.is_empty() || value.chars().count() > 8192 {
        return Err(BridgeError::validation("secret value must be 1-8192 chars"));
    }
    Ok(())
}

pub trait SecretStore: Send + Sync {
    fn set(&self, service: &str, key_name: &str, value: &str) -> BridgeResult<()>;
    fn get(&self, service: &str, key_name: &str) -> BridgeResult<String>;
    fn has(&self, service: &str, key_name: &str) -> BridgeResult<bool>;
    fn list(&self, service: &str) -> BridgeResult<Vec<String>>;
    fn delete(&self, service: &str, key_name: &str) -> BridgeResult<()>;
}

/// In-memory store for tests only (never used in production handlers).
pub struct MemorySecretStore {
    map: Mutex<HashMap<String, String>>,
}

impl MemorySecretStore {
    pub fn new() -> Self {
        Self { map: Mutex::new(HashMap::new()) }
    }
}

impl Default for MemorySecretStore {
    fn default() -> Self { Self::new() }
}

impl SecretStore for MemorySecretStore {
    fn set(&self, service: &str, key_name: &str, value: &str) -> BridgeResult<()> {
        validate_secret_key(service, key_name)?;
        validate_secret_value(value)?;
        self.map.lock().unwrap().insert(account_name(service, key_name), value.to_string());
        Ok(())
    }
    fn get(&self, service: &str, key_name: &str) -> BridgeResult<String> {
        validate_secret_key(service, key_name)?;
        self.map.lock().unwrap().get(&account_name(service, key_name)).cloned().ok_or_else(BridgeError::secrets_not_found)
    }
    fn has(&self, service: &str, key_name: &str) -> BridgeResult<bool> {
        validate_secret_key(service, key_name)?;
        Ok(self.map.lock().unwrap().contains_key(&account_name(service, key_name)))
    }
    fn list(&self, service: &str) -> BridgeResult<Vec<String>> {
        if !is_valid_name(service) {
            return Err(BridgeError::validation("service name is invalid"));
        }
        let prefix = format!("{service}:");
        let mut names: Vec<String> = self
            .map
            .lock()
            .unwrap()
            .keys()
            .filter_map(|k| k.strip_prefix(&prefix).map(|s| s.to_string()))
            .collect();
        names.sort();
        Ok(names)
    }
    fn delete(&self, service: &str, key_name: &str) -> BridgeResult<()> {
        validate_secret_key(service, key_name)?;
        self.map.lock().unwrap().remove(&account_name(service, key_name));
        Ok(())
    }
}

/// Production store: OS keychain. `list` is not supported by the keyring
/// API (it has no enumeration); the handler layer tracks names separately
/// in the app config file (names only, never values) — see commands_secrets.
pub struct KeyringSecretStore;

impl SecretStore for KeyringSecretStore {
    fn set(&self, service: &str, key_name: &str, value: &str) -> BridgeResult<()> {
        validate_secret_key(service, key_name)?;
        validate_secret_value(value)?;
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account_name(service, key_name))
            .map_err(|_| BridgeError::secrets_unavailable())?;
        entry.set_password(value).map_err(|e| map_keyring_error(e, false))?;
        Ok(())
    }
    fn get(&self, service: &str, key_name: &str) -> BridgeResult<String> {
        validate_secret_key(service, key_name)?;
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account_name(service, key_name))
            .map_err(|_| BridgeError::secrets_unavailable())?;
        entry.get_password().map_err(|e| map_keyring_error(e, true))
    }
    fn has(&self, service: &str, key_name: &str) -> BridgeResult<bool> {
        match self.get(service, key_name) {
            Ok(_) => Ok(true),
            Err(e) if e.code == "SECRETS_NOT_FOUND" => Ok(false),
            Err(e) => Err(e),
        }
    }
    fn list(&self, _service: &str) -> BridgeResult<Vec<String>> {
        // Keyring has no enumeration API; the handler layer answers `list`
        // from its names-only registry. Returning an error here would be a
        // lie about the store, so this method is intentionally unreachable
        // from handlers (they never call store.list on the keyring store).
        Err(BridgeError::internal("secret listing is served from the names registry, not the keychain"))
    }
    fn delete(&self, service: &str, key_name: &str) -> BridgeResult<()> {
        validate_secret_key(service, key_name)?;
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account_name(service, key_name))
            .map_err(|_| BridgeError::secrets_unavailable())?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // idempotent delete
            Err(e) => Err(map_keyring_error(e, false)),
        }
    }
}

fn map_keyring_error(err: keyring::Error, is_read: bool) -> BridgeError {
    use keyring::Error;
    match err {
        Error::NoEntry if is_read => BridgeError::secrets_not_found(),
        Error::NoEntry => BridgeError::secrets_not_found(),
        // No Secret Service / no platform store: fail loud, never a file.
        Error::PlatformFailure(_) | Error::NoStorageAccess(_) => BridgeError::secrets_unavailable(),
        _ => BridgeError::internal("The secure credential store reported an error."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_round_trip_and_idempotent_delete() {
        let store = MemorySecretStore::new();
        assert!(!store.has("nicheforge", "ai").unwrap());
        assert_eq!(store.get("nicheforge", "ai").unwrap_err().code, "SECRETS_NOT_FOUND");
        store.set("nicheforge", "ai", "sk-test").unwrap();
        assert!(store.has("nicheforge", "ai").unwrap());
        assert_eq!(store.get("nicheforge", "ai").unwrap(), "sk-test");
        assert_eq!(store.list("nicheforge").unwrap(), vec!["ai".to_string()]);
        store.delete("nicheforge", "ai").unwrap();
        store.delete("nicheforge", "ai").unwrap(); // idempotent
        assert!(!store.has("nicheforge", "ai").unwrap());
        // Invalid names/values are validation errors, and no value is ever
        // returned in an error string.
        assert!(store.set("Bad!", "ai", "x").is_err());
        assert!(store.set("nicheforge", "ai", "").is_err());
        assert_eq!(account_name("nicheforge", "ai"), "nicheforge:ai");
        assert_eq!(KEYCHAIN_SERVICE, "com.fbuploadpro.desktop");
    }
}
