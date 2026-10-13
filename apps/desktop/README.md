# @fbuploadpro/desktop

Desktop client shell for FBUploadPro powered by Tauri v2 (Rust + React).

## Architecture & IP Protection
- **Native Backend**: `src-tauri/` (compiled Rust machine code binary for IP protection).
- **Frontend**: Lightweight client window consuming `@fbuploadpro/contracts`.
- **Release Profile**: Compiled with symbol stripping (`strip = true`) and optimization level 3 (`opt-level = 3`).
