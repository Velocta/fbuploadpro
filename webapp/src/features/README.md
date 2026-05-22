# Feature Modules

Use feature slices for future additions:

- `ui/` for feature-specific UI components
- `api/` for client-facing API adapters
- `schemas/` for feature validation schemas
- `types/` for feature-local types

Route files under `app/` should compose feature modules and avoid embedding business logic.
