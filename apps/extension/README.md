# @fbuploadpro/extension

Browser Companion Shell for FBUploadPro (Manifest V3 / WXT).

## Architectural Role & Boundary
- **Client Surface**: Chrome & Firefox Extension (Manifest V3)
- **Thin Client Security**: Adheres to Constitution Principle 26 (Thin Client / Fat Server IP Isolation). Does not store raw long-lived OAuth tokens or execute private publishing algorithms locally.
- **Contract Adherence**: Consumes types and schemas strictly from `@fbuploadpro/contracts`.
- **Target Features**: Seamless content capture and multi-account publishing workflow assistance.
