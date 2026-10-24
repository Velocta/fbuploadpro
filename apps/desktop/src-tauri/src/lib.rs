//! Pure bridge logic for the FBUploadPro desktop shell (spec 145).
//!
//! Everything in this library is decoupled from the Tauri runtime so
//! `cargo test --lib` exercises it without launching a window. Tauri command
//! handlers live in the binary crate (`main.rs` + `commands/`) and are thin:
//! validate -> call pure logic -> return a typed result or BridgeError.

pub mod ai;
pub mod artifacts;
pub mod errors;
pub mod media;
pub mod paths;
pub mod preflight;
pub mod processes;
pub mod scopes;
pub mod secrets;
pub mod start_url;
pub mod validation;
