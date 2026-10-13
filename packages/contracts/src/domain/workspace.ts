import { z } from 'zod';
import { SubdomainSchema } from './user.js';

export const WorkspaceItemSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  subdomain: SubdomainSchema,
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>;

export const CreateWorkspaceRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100, 'Workspace name cannot exceed 100 characters'),
  subdomain: SubdomainSchema,
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;

export const SwitchWorkspaceRequestSchema = z.object({
  subdomain: SubdomainSchema,
});
export type SwitchWorkspaceRequest = z.infer<typeof SwitchWorkspaceRequestSchema>;

export const BYOCStatusSchema = z.enum(['unverified', 'valid', 'invalid']);
export type BYOCStatus = z.infer<typeof BYOCStatusSchema>;

export const BYOCCredentialsViewSchema = z.object({
  workspaceId: z.string().uuid(),
  subdomain: z.string(),
  fbAppId: z.string().default(''),
  hasSecret: z.boolean().default(false),
  webhookVerifyToken: z.string().nullable().optional(),
  status: BYOCStatusSchema.default('unverified'),
  lastTestedAt: z.string().nullable().optional(),
});
export type BYOCCredentialsView = z.infer<typeof BYOCCredentialsViewSchema>;

export const SaveBYOCCredentialsRequestSchema = z.object({
  fbAppId: z
    .string()
    .trim()
    .min(5, 'Facebook App ID must be at least 5 digits')
    .max(50, 'Facebook App ID is too long')
    .regex(/^\d+$/, 'Facebook App ID must contain only digits'),
  fbAppSecret: z
    .string()
    .trim()
    .min(10, 'Facebook App Secret must be at least 10 characters')
    .max(128, 'Facebook App Secret is too long')
    .optional()
    .or(z.literal('')),
  webhookVerifyToken: z
    .string()
    .trim()
    .max(255, 'Webhook verify token cannot exceed 255 characters')
    .optional()
    .or(z.literal('')),
});
export type SaveBYOCCredentialsRequest = z.infer<typeof SaveBYOCCredentialsRequestSchema>;

export const TestBYOCResponseSchema = z.object({
  success: z.boolean(),
  status: BYOCStatusSchema,
  message: z.string(),
  testedAt: z.string(),
  appName: z.string().optional(),
});
export type TestBYOCResponse = z.infer<typeof TestBYOCResponseSchema>;
