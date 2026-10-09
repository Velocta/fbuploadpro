# Database Migrations

All platform database migrations are managed in `/supabase/migrations` following the **Supabase GitHub Integration** standard:
- **Location**: [`/supabase/migrations/`](../../../supabase/migrations/)
- **Naming Pattern**: `YYYYMMDDHHmmss_<descriptive_name>.sql`
- **Deployment**: Automatically deployed by Supabase GitHub Integration on push or merge to `main`.

Files in this directory are symbolic links pointing to `/supabase/migrations` for package-level reference and local test compatibility.
