import { z } from 'zod';

/**
 * Prompt Library (spec 144) — contracts for curated and personal prompts.
 *
 * Ownership (OD-144-1): personal prompts are per-USER, global across
 * workspaces, following the Media Library precedent (migration
 * 20261014180000 moved media from per-workspace to global per-user).
 * The curated set is identical for everyone and ships as validated
 * in-code data (OD-144-2) — no table, no seed migration.
 */

export const PromptCategorySchema = z.enum([
  'hooks',
  'captions',
  'video-ideas',
  'repurposing',
  'engagement',
  'hashtags',
]);

export type PromptCategory = z.infer<typeof PromptCategorySchema>;

export const PROMPT_CATEGORY_VALUES = PromptCategorySchema.options;

/** Maximum personal prompts per user (OD-144-7). */
export const PROMPT_PERSONAL_CAP = 200;

export const CuratedPromptSchema = z.object({
  /** Stable slug id, e.g. `hooks-01` — not a uuid (OD-144-2). */
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(4000),
  category: PromptCategorySchema,
});

export type CuratedPrompt = z.infer<typeof CuratedPromptSchema>;

export const PromptResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(4000),
  category: PromptCategorySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PromptResponse = z.infer<typeof PromptResponseSchema>;

export const PromptListResponseSchema = z.object({
  curated: z.array(CuratedPromptSchema),
  personal: z.array(PromptResponseSchema),
});

export type PromptListResponse = z.infer<typeof PromptListResponseSchema>;

export const CreatePromptRequestSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(4000),
  category: PromptCategorySchema,
});

export type CreatePromptRequest = z.infer<typeof CreatePromptRequestSchema>;

export const UpdatePromptRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    body: z.string().trim().min(1).max(4000).optional(),
    category: PromptCategorySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one of title, body or category must be provided',
  });

export type UpdatePromptRequest = z.infer<typeof UpdatePromptRequestSchema>;

export const DeletePromptResponseSchema = z.object({
  success: z.literal(true),
  deletedPromptId: z.string().uuid(),
});

export type DeletePromptResponse = z.infer<typeof DeletePromptResponseSchema>;

/**
 * The curated starter set (OD-144-2): 42 prompts, 7 per category,
 * written in plain language for use with ChatGPT/Gemini/etc. Placeholders
 * use square brackets, e.g. `[your topic]`. Nothing here mentions
 * FBUploadPro internals, pricing, or platform-policy workarounds.
 */
export const CURATED_PROMPTS: CuratedPrompt[] = [
  // ── Hooks ──────────────────────────────────────────────────────────
  {
    id: 'hooks-01',
    title: 'Scroll-stopping video openers',
    body: 'Write 10 opening lines for a short video about [topic] that stop the scroll in the first 3 seconds. Each line must create curiosity, name a specific pain or promise, and be under 15 words. No clickbait that the video does not deliver on.',
    category: 'hooks',
  },
  {
    id: 'hooks-02',
    title: 'Belief-challenging hooks',
    body: 'Give me 10 hooks for a post about [topic] written as bold statements that challenge a common belief in [niche]. Keep each one under 12 words and make them sound like something a real person would say, not a slogan.',
    category: 'hooks',
  },
  {
    id: 'hooks-03',
    title: 'Result-first video hook',
    body: 'Write a 3-second video hook for [product/service] that starts with the result, not the feature. Format: the outcome first, then one line of proof, then the promise of the video.',
    category: 'hooks',
  },
  {
    id: 'hooks-04',
    title: 'Rewrite a weak opening five ways',
    body: 'Turn this boring opening into 5 stronger ones: [paste your opening]. Each version must use a different technique: a question, a surprising number, a mistake to avoid, a bold claim, and a short story opener.',
    category: 'hooks',
  },
  {
    id: 'hooks-05',
    title: 'Carousel hooks that demand slide 2',
    body: 'Write 10 hooks for a carousel post about [topic]. Each hook must make the reader need slide 2. Vary the style: questions, lists, confessions, and before/after statements.',
    category: 'hooks',
  },
  {
    id: 'hooks-06',
    title: 'Speak to a tired audience',
    body: 'Write a hook for a video aimed at [audience] who are tired of [problem]. Speak directly to them in second person, name their frustration in the first line, and promise one concrete takeaway.',
    category: 'hooks',
  },
  {
    id: 'hooks-07',
    title: 'Two-sentence Reel hooks',
    body: 'Give me 10 two-sentence hooks for Reels about [topic]. Sentence one creates tension, sentence two promises the payoff. Keep the whole hook under 25 words.',
    category: 'hooks',
  },
  // ── Captions ───────────────────────────────────────────────────────
  {
    id: 'captions-01',
    title: 'Story caption for a photo',
    body: 'Write a caption for a photo of [describe the photo] for [platform]. Start with a relatable line, tell the short story behind the photo in 3 sentences, and end with a question that invites replies. Keep it warm and human, no hashtags in the caption body.',
    category: 'captions',
  },
  {
    id: 'captions-02',
    title: 'Short announcement captions',
    body: 'Write 5 caption options for a post announcing [news/offer]. Each must be under 40 words, sound excited without sounding like an ad, and end with a clear next step for the reader.',
    category: 'captions',
  },
  {
    id: 'captions-03',
    title: 'Notes to polished caption',
    body: 'Turn these rough notes into a polished caption: [paste notes]. Keep my voice and the facts, cut the filler, and structure it as hook, story, lesson, question.',
    category: 'captions',
  },
  {
    id: 'captions-04',
    title: 'Behind-the-scenes caption',
    body: 'Write a caption for a behind-the-scenes video of [what you do]. Make the reader feel like an insider: share one small detail most people never see, and why it matters.',
    category: 'captions',
  },
  {
    id: 'captions-05',
    title: 'Sell without sounding salesy',
    body: 'Write a caption that sells [product/service] without sounding salesy. Lead with the problem it solves, give one honest benefit, and invite the reader to ask questions instead of pushing a buy link.',
    category: 'captions',
  },
  {
    id: 'captions-06',
    title: 'Motivational caption without clichés',
    body: 'Write a caption for a motivational post about [theme]. Avoid clichés and generic advice. Use one concrete example, keep it under 80 words, and end with a line the reader will want to save.',
    category: 'captions',
  },
  {
    id: 'captions-07',
    title: 'Three tones, one video',
    body: 'Write 3 captions for the same video about [topic]: one funny, one serious, one short and punchy (under 20 words). Each must work on its own.',
    category: 'captions',
  },
  // ── Video ideas ────────────────────────────────────────────────────
  {
    id: 'video-ideas-01',
    title: '20 short-video ideas for a niche',
    body: 'Give me 20 short-video ideas for a [niche] page aimed at [audience]. Each idea needs a title, the hook in one line, and the one thing the viewer learns. Mix tutorials, mistakes, myths, and behind-the-scenes.',
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-02',
    title: '7-day video series plan',
    body: 'Plan a 7-day video series about [topic]. For each day give the topic, the hook, and the format (talking head, demo, screen recording, or story). Day 7 must tie the series together.',
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-03',
    title: 'Videos from real beginner questions',
    body: 'Give me 10 video ideas that answer the questions people actually ask about [topic]. Base each idea on a real beginner question, and write the title as the question itself.',
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-04',
    title: 'Blog post to 5 videos',
    body: 'Turn this blog post into 5 short-video ideas: [paste post or a summary]. Each video must cover one point only, and each needs its own hook.',
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-05',
    title: 'Honest day-in-the-life ideas',
    body: 'Give me 10 "day in the life" style video ideas for [profession/creator type] that show the real work, not just the highlights. Include one honest struggle per idea.',
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-06',
    title: 'Faceless video ideas',
    body: "Give me 10 video ideas for [niche] that don't need me on camera: screen recordings, hands-only demos, text-on-screen, and voiceover formats. Each idea must say what the viewer sees and hears.",
    category: 'video-ideas',
  },
  {
    id: 'video-ideas-07',
    title: 'Monthly video calendar',
    body: 'Plan a monthly video calendar for [niche]: 12 ideas, one per week for a month, balancing educational, entertaining, and personal content. Each idea gets a working title and a one-line reason it will perform.',
    category: 'video-ideas',
  },
  // ── Repurposing ────────────────────────────────────────────────────
  {
    id: 'repurposing-01',
    title: 'Long video to 5 short clips',
    body: 'Turn this long video transcript into 5 short clips: [paste transcript]. For each clip give the timestamp range, the hook, and the caption. Each clip must stand alone.',
    category: 'repurposing',
  },
  {
    id: 'repurposing-02',
    title: 'One post, three formats',
    body: 'Repurpose this post into 3 formats: a short video script, a carousel outline (5 slides), and an email. Keep the core message identical, but adapt the structure to each format.',
    category: 'repurposing',
  },
  {
    id: 'repurposing-03',
    title: 'Best posts, new formats',
    body: "Take my 10 best-performing posts and turn each one into a new format it hasn't been in yet. List the original, the new format, and the one change that makes it fresh instead of a repeat.",
    category: 'repurposing',
  },
  {
    id: 'repurposing-04',
    title: 'Article to step-by-step carousel',
    body: 'Turn this how-to article into a step-by-step carousel: [paste article]. One step per slide, each slide under 20 words, first slide is the promise, last slide is the call to action.',
    category: 'repurposing',
  },
  {
    id: 'repurposing-05',
    title: 'One FAQ answer, three formats',
    body: 'Turn a customer question I get asked all the time — [question] — into a video script, a caption, and a story poll. Same answer, three formats, each native to its format.',
    category: 'repurposing',
  },
  {
    id: 'repurposing-06',
    title: 'A talk into a week of content',
    body: "Break this 30-minute talk into a week's worth of content: [paste outline]. Give me one clip, one quote graphic, and one text post per day, with no day repeating the same point.",
    category: 'repurposing',
  },
  {
    id: 'repurposing-07',
    title: 'Refresh an old post',
    body: 'Update this old post for today: [paste post]. Keep what still works, replace anything dated, add one new example, and rewrite the hook for a current audience.',
    category: 'repurposing',
  },
  // ── Engagement ─────────────────────────────────────────────────────
  {
    id: 'engagement-01',
    title: 'Questions people actually answer',
    body: 'Write 10 questions I can ask my audience about [topic] that people will actually want to answer. Avoid yes/no questions. Each question must invite a story or an opinion.',
    category: 'engagement',
  },
  {
    id: 'engagement-02',
    title: 'A respectful debate post',
    body: 'Write a post that starts a debate in [niche] without being controversial for its own sake. Present two honest viewpoints, pick a side with reasons, and invite respectful disagreement.',
    category: 'engagement',
  },
  {
    id: 'engagement-03',
    title: 'Story polls with real choices',
    body: 'Write 5 poll questions for stories about [topic]. Each poll needs two options that are both appealing, so the vote feels like a real choice, not a test.',
    category: 'engagement',
  },
  {
    id: 'engagement-04',
    title: 'This-or-that post',
    body: 'Write a "this or that" post for [niche]: 8 pairs of choices my audience will have strong opinions about. Keep each pair short and visual.',
    category: 'engagement',
  },
  {
    id: 'engagement-05',
    title: 'Ask for their story',
    body: 'Write a post that asks my audience to share their own experience with [topic]. Open with my own short story first, then ask one specific question. Make it feel safe to reply.',
    category: 'engagement',
  },
  {
    id: 'engagement-06',
    title: 'Replies to common comments',
    body: 'Write 10 comment replies for common comments on my posts: a compliment, a question, a criticism, a joke, and a spammy comment (and 5 more of your choice). Each reply must sound like me, not like customer service.',
    category: 'engagement',
  },
  {
    id: 'engagement-07',
    title: 'Weekly engagement ritual',
    body: 'Design a simple weekly engagement ritual for my page about [topic]: one recurring post format per weekday that gives followers a reason to come back and reply. Each format needs a name, a template, and an example.',
    category: 'engagement',
  },
  // ── Hashtags ───────────────────────────────────────────────────────
  {
    id: 'hashtags-01',
    title: 'Broad, niche, community hashtag mix',
    body: 'Give me 30 hashtags for a post about [topic] in [niche]: 10 broad, 10 niche, 10 small community tags. No banned or generic tags like #love or #instagood. Explain why each group works.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-02',
    title: 'Audit my hashtag list',
    body: 'Audit these hashtags for my post about [topic]: [paste hashtags]. Remove the ones that are too broad, spammy, or irrelevant, and replace them with better niche alternatives.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-03',
    title: 'Hashtag bank by content type',
    body: 'Build a hashtag bank for my [niche] page: 5 sets of 10 hashtags, one set per content type (tutorials, behind-the-scenes, product posts, personal posts, trending). Each set must be ready to paste.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-04',
    title: 'Reel hashtags for a local audience',
    body: 'Give me hashtags for a Reel about [topic] aimed at [audience] in [city/country if relevant]. Prioritise tags people in that audience actually follow, and keep the total under 15.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-05',
    title: 'Hashtag strategy for a new page',
    body: 'Write a hashtag strategy for a new page about [topic]: which tags to use while small, which to add as the page grows, and which to avoid entirely. Keep it to one page of plain advice.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-06',
    title: 'Seasonal hashtag set',
    body: 'Give me 20 hashtags for a seasonal post about [topic] for [season/holiday]. Mix evergreen tags with seasonal ones, and mark which ones to drop after the season ends.',
    category: 'hashtags',
  },
  {
    id: 'hashtags-07',
    title: 'Hashtags from a caption',
    body: 'Turn this caption into a hashtag set: [paste caption]. Extract the real topics from the caption, add matching niche tags, and return exactly 15 hashtags with no duplicates.',
    category: 'hashtags',
  },
];
