import { z } from 'zod';

/**
 * Workspace resources.
 *
 * Sources: `GET/POST/PATCH /api/workspaces` and
 * `POST /api/workspaces/switch` — the handlers construct the workspace
 * view inline (`{id, ownerId, name, subdomain, createdAt, updatedAt}`,
 * dates passed through as strings or omitted when undefined),
 * cross-checked against `tests/api/workspaces-api.test.ts`.
 *
 * Passthrough choices: none — the payloads are flat.
 */

export const WorkspaceItemSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1),
  subdomain: z.string().min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>;

export const ListWorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceItemSchema),
});
export type ListWorkspacesResponse = z.infer<typeof ListWorkspacesResponseSchema>;

export const WorkspaceMutationResponseSchema = z.object({
  success: z.boolean(),
  workspace: WorkspaceItemSchema,
});
export type WorkspaceMutationResponse = z.infer<typeof WorkspaceMutationResponseSchema>;

export const SwitchWorkspaceResponseSchema = z.object({
  success: z.boolean(),
  targetSubdomain: z.string(),
  redirectUrl: z.string(),
});
export type SwitchWorkspaceResponse = z.infer<typeof SwitchWorkspaceResponseSchema>;
