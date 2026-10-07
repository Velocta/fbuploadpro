# Contracts: Page Queue Slots

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](../spec.md)

This document defines the TypeScript types and Zod boundary validation schemas for configuring and managing Page-Specific Recurring Queue Slots.

---

## 1. Zod Validation Schemas

```typescript
import { z } from 'zod';

// Slot Time regex: HH:MM or HH:MM:SS (24-hour format)
export const SlotTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time format. Expected HH:MM or HH:MM:SS');

// IANA Timezone validation
export const TimezoneSchema = z.string().min(1).max(50).default('UTC');

// Create Slot Request
export const CreateQueueSlotRequestSchema = z.object({
  pageId: z.string().uuid(),
  slotTime: SlotTimeSchema,
  timezone: TimezoneSchema,
});

export type CreateQueueSlotRequest = z.infer<typeof CreateQueueSlotRequestSchema>;

// Update Slot Request
export const UpdateQueueSlotRequestSchema = z.object({
  slotTime: SlotTimeSchema.optional(),
  timezone: TimezoneSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateQueueSlotRequest = z.infer<typeof UpdateQueueSlotRequestSchema>;

// Queue Slot Domain Model
export const PageQueueSlotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pageId: z.string().uuid(),
  slotTime: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PageQueueSlot = z.infer<typeof PageQueueSlotSchema>;

// List Slots Response
export const ListQueueSlotsResponseSchema = z.object({
  slots: z.array(PageQueueSlotSchema),
  total: z.number().int().nonnegative(),
});

export type ListQueueSlotsResponse = z.infer<typeof ListQueueSlotsResponseSchema>;
```

---

## 2. API Endpoints

### 2.1 `GET /api/tenant/[subdomain]/pages/[pageId]/slots`
Returns all configured recurring slots for the specified page.
- **Request Headers**: `Authorization: Bearer <token>` or session cookie
- **Response**: `200 OK` with `ListQueueSlotsResponse`

### 2.2 `POST /api/tenant/[subdomain]/pages/[pageId]/slots`
Creates a new recurring publishing slot.
- **Request Body**: `CreateQueueSlotRequest`
- **Response**: `201 Created` with `PageQueueSlot`
- **Errors**: `400 Bad Request` (invalid format), `409 Conflict` (duplicate slot time for page)

### 2.3 `PATCH /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]`
Updates slot active state, time, or timezone.
- **Request Body**: `UpdateQueueSlotRequest`
- **Response**: `200 OK` with updated `PageQueueSlot`

### 2.4 `DELETE /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]`
Deletes the slot. Future queue items assigned to this slot have `slot_id` set to `NULL`.
- **Response**: `200 OK` with `{ success: true, slotId: string }`
