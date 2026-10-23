import { z } from 'zod';
import { DownloaderSourcePlatformValues } from '@fbuploadpro/contracts';
import { MediaItemSchema } from './media';

/**
 * Downloader resources (spec 140 §5).
 *
 * Sources: `POST/GET …/downloader` (ingest + job polling + recent jobs)
 * and `GET …/media/[mediaId]` (saved-item hydration for completed jobs).
 * The contracts package remains the wire truth — the platform enum is
 * imported from it, and item payloads reuse the media resource's strict
 * `MediaItemSchema` rather than defining a second item shape.
 */

export const DownloaderPlatformSchema = z.enum(DownloaderSourcePlatformValues);
export type DownloaderPlatform = z.infer<typeof DownloaderPlatformSchema>;

/** Synchronous ingest success body (the route's 200/201 response). */
export const DownloaderIngestResponseSchema = z.object({
  sourceUrl: z.string(),
  platform: DownloaderPlatformSchema,
  items: z.array(MediaItemSchema),
});
export type DownloaderIngestResponseData = z.infer<
  typeof DownloaderIngestResponseSchema
>;

/**
 * A `media_download_jobs` row as the downloader GET returns it
 * (`SELECT *` — snake_case columns; only the fields the client reads are
 * declared, unknown columns are stripped by the parse).
 */
export const DownloaderJobSchema = z.object({
  id: z.string(),
  status: z.string(),
  source_url: z.string(),
  source_platform: DownloaderPlatformSchema,
  media_id: z.string().nullable().optional(),
  folder_id: z.string().nullable().optional(),
  progress_percent: z.number().nullable().optional(),
  error_message: z.string().nullable().optional(),
});
export type DownloaderJob = z.infer<typeof DownloaderJobSchema>;

/** `GET …/downloader?jobId=<id>` — single-job poll response. */
export const DownloaderJobPollResponseSchema = z.object({
  success: z.boolean().optional(),
  job: DownloaderJobSchema,
});
export type DownloaderJobPollResponse = z.infer<
  typeof DownloaderJobPollResponseSchema
>;

/** `GET …/downloader` — latest 50 stored jobs (recent-downloads hydration). */
export const DownloaderRecentJobsResponseSchema = z.object({
  success: z.boolean().optional(),
  jobs: z.array(DownloaderJobSchema),
});
export type DownloaderRecentJobsResponse = z.infer<
  typeof DownloaderRecentJobsResponseSchema
>;
