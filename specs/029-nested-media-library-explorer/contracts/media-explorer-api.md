# API & Domain Contracts: Spec 029 — Media Library Explorer

## 1. Folder Contracts (`packages/contracts/src/domain/folder.ts`)

- **`MediaFolderSchema`**:
  - `id`: `z.string().uuid()`
  - `userId`: `z.string().uuid()`
  - `parentId`: `z.string().uuid().nullable()`
  - `name`: `z.string().trim().min(1).max(100)`
  - `itemCount`: `z.number().int().min(0)`
  - `subfolderCount`: `z.number().int().min(0)`
  - `createdAt`: `z.coerce.date()`
  - `updatedAt`: `z.coerce.date()`

- **`CreateFolderRequestSchema`**:
  - `name`: `z.string().trim().min(1).max(100)`
  - `parentId`: `z.string().uuid().nullable().optional()`

- **`UpdateFolderRequestSchema`**:
  - `name`: `z.string().trim().min(1).max(100).optional()`
  - `parentId`: `z.string().uuid().nullable().optional()`

- **`DeleteFolderResponseSchema`**:
  - `success`: `z.literal(true)`
  - `deletedFolderId`: `z.string().uuid()`
  - `deletedSubfoldersCount`: `z.number().int().min(0)`
  - `deletedItemsCount`: `z.number().int().min(0)`

## 2. Media Listing & Batch Contracts (`packages/contracts/src/domain/media.ts`)

- **`MediaListQuerySchema`**:
  - `folderId`: `z.union([z.string().uuid(), z.literal('unorganized')]).optional()`
  - `mediaType`: `AllowedMediaTypes.optional()`
  - `search`: `z.string().trim().max(200).optional()`
  - `sortBy`: `z.enum(['created_at', 'name', 'file_size']).default('created_at')`
  - `sortOrder`: `z.enum(['asc', 'desc']).default('desc')`
  - `limit`: `z.coerce.number().int().min(1).max(100).default(50)`
  - `offset`: `z.coerce.number().int().min(0).default(0)`

- **`BatchMediaRequestSchema`** (`POST /api/tenant/[subdomain]/media/batch`):
  - Discriminated union on `action`:
    - `{ action: 'move', mediaIds: string[], folderId: string | null }`
    - `{ action: 'delete', mediaIds: string[] }`
    - `{ action: 'caption', mediaIds: string[], captionText: string | null }`

- **`BatchMediaResponseSchema`**:
  - `success`: `z.literal(true)`
  - `action`: `z.enum(['move', 'delete', 'caption'])`
  - `affectedCount`: `z.number().int().min(0)`
