//! Pinned artifact manifest values (§8.1).
//! This Rust copy mirrors `DESKTOP_ARTIFACT_MANIFEST` in the TS contract.
//! PR-145-A shipped the TS shape with an empty value manifest; PR-145-E
//! fills BOTH copies with the same pinned versions/URLs/SHA-256 hashes, and
//! PR review verifies each hash against the publisher's published checksum
//! and that the two copies agree. Never `latest`, never a floating tag.

use fbuploadpro_desktop::artifacts::ArtifactManifestEntry;

/// All manifest entries (binaries + models). Filled in PR-145-E.
pub fn manifest_entries() -> Vec<ArtifactManifestEntry> {
    vec![]
}

pub fn manifest_entry(artifact_id: &str) -> Option<ArtifactManifestEntry> {
    manifest_entries().into_iter().find(|e| e.artifact_id == artifact_id)
}
