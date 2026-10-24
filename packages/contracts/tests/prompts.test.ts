import { describe, expect, it } from 'vitest';
import {
  CURATED_PROMPTS,
  CuratedPromptSchema,
  PROMPT_CATEGORY_VALUES,
  PROMPT_PERSONAL_CAP,
  PromptCategorySchema,
} from '../src/domain/prompts';

describe('Prompt Library contracts (spec 144)', () => {
  it('ships exactly 42 curated prompts, 7 per category', () => {
    expect(CURATED_PROMPTS).toHaveLength(42);
    for (const category of PROMPT_CATEGORY_VALUES) {
      expect(CURATED_PROMPTS.filter((p) => p.category === category)).toHaveLength(7);
    }
  });

  it('every curated prompt parses against its schema', () => {
    for (const prompt of CURATED_PROMPTS) {
      expect(CuratedPromptSchema.safeParse(prompt).success).toBe(true);
    }
  });

  it('curated ids are unique and slug-shaped per category', () => {
    const ids = CURATED_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prompt of CURATED_PROMPTS) {
      expect(prompt.id).toMatch(new RegExp(`^${prompt.category}-\\d{2}$`));
    }
  });

  it('curated bodies are real content, not placeholders', () => {
    for (const prompt of CURATED_PROMPTS) {
      expect(prompt.title.trim().length).toBeGreaterThan(0);
      expect(prompt.body.trim().length).toBeGreaterThan(20);
      expect(prompt.body).not.toMatch(/TODO|Lorem ipsum|coming soon/i);
    }
  });

  it('the personal cap is 200', () => {
    expect(PROMPT_PERSONAL_CAP).toBe(200);
  });

  it('the category enum has exactly the six spec categories', () => {
    expect([...PROMPT_CATEGORY_VALUES].sort()).toEqual(
      ['captions', 'engagement', 'hashtags', 'hooks', 'repurposing', 'video-ideas'].sort()
    );
    expect(PromptCategorySchema.safeParse('other').success).toBe(false);
  });
});
