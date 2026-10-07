import { z } from 'zod';

export const CaptionTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(50)),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CaptionTemplateResponse = z.infer<typeof CaptionTemplateResponseSchema>;

export const CaptionListResponseSchema = z.object({
  templates: z.array(CaptionTemplateResponseSchema),
});

export type CaptionListResponse = z.infer<typeof CaptionListResponseSchema>;

export const CreateCaptionTemplateRequestSchema = z.object({
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(5000),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
});

export type CreateCaptionTemplateRequest = z.infer<typeof CreateCaptionTemplateRequestSchema>;

export const UpdateCaptionTemplateRequestSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
});

export type UpdateCaptionTemplateRequest = z.infer<typeof UpdateCaptionTemplateRequestSchema>;

export const DeleteCaptionTemplateResponseSchema = z.object({
  success: z.literal(true),
  deletedCaptionId: z.string().uuid(),
});

export type DeleteCaptionTemplateResponse = z.infer<typeof DeleteCaptionTemplateResponseSchema>;
