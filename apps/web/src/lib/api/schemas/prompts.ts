import {
  CURATED_PROMPTS,
  CreatePromptRequestSchema,
  CuratedPromptSchema,
  DeletePromptResponseSchema,
  PROMPT_CATEGORY_VALUES,
  PROMPT_PERSONAL_CAP,
  PromptCategorySchema,
  PromptListResponseSchema,
  PromptResponseSchema,
  UpdatePromptRequestSchema,
} from '@fbuploadpro/contracts';
import type { PromptCategory } from '@fbuploadpro/contracts';

/**
 * Prompt Library resources (spec 144 §6).
 *
 * The contracts package remains the wire truth — these re-exports exist
 * so web call sites import from the web schema module, following the
 * downloader schema precedent (spec 140 §5).
 */
export {
  CURATED_PROMPTS,
  CreatePromptRequestSchema,
  CuratedPromptSchema,
  DeletePromptResponseSchema,
  PROMPT_CATEGORY_VALUES,
  PROMPT_PERSONAL_CAP,
  PromptCategorySchema,
  PromptListResponseSchema,
  PromptResponseSchema,
  UpdatePromptRequestSchema,
};
export type { PromptCategory };

/** Display labels for the prompt categories (labels live in web, enum in contracts). */
export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  hooks: 'Hooks',
  captions: 'Captions',
  'video-ideas': 'Video ideas',
  repurposing: 'Repurposing',
  engagement: 'Engagement',
  hashtags: 'Hashtags',
};
