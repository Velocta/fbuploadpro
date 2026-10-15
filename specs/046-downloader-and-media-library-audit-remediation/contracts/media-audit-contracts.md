# Interface Contracts: 046 Downloader and Media Library Audit Remediation

## 1. Duplicate Verification Contract

```ts
export const CheckDuplicatesEntrySchema = z.object({
  name: z.string().min(1),
  fileSize: z.number().int().positive(),
  folderId: z.string().uuid().nullable().optional(),
});

export const CheckDuplicatesRequestSchema = z.object({
  folderId: z.string().uuid().nullable().optional(),
  entries: z.array(CheckDuplicatesEntrySchema),
});

export const DuplicateItemMatchSchema = z.object({
  name: z.string(),
  fileSize: z.number(),
  folderId: z.string().uuid().nullable(),
  existingMediaId: z.string().uuid(),
});

export const CheckDuplicatesResponseSchema = z.object({
  duplicates: z.array(DuplicateItemMatchSchema),
  duplicateCount: z.number().int().nonnegative(),
});
```

## 2. Aspect Ratio Extension

```ts
export const AspectRatioSchema = z.enum([
  '9:16',
  '16:9',
  '1:1',
  '4:5',
  'unknown'
]);
```
