import { z } from 'zod';

export const DownloadKindSchema = z.enum(['video', 'audio']);
export type DownloadKind = z.infer<typeof DownloadKindSchema>;

export const DownloadStatusSchema = z.enum([
  'idle', 'queued', 'downloading', 'processing', 'completed', 'failed',
]);
export type DownloadStatus = z.infer<typeof DownloadStatusSchema>;

export const DownloadTaskSchema = z.object({
  taskId: z.uuid(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  kind: DownloadKindSchema,
  status: DownloadStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
}).strict();
export type DownloadTask = z.infer<typeof DownloadTaskSchema>;

export const DownloadQueueTaskSchema = DownloadTaskSchema.extend({
  title: z.string().max(240).optional(),
  queuePosition: z.number().int().positive().optional(),
  createdAt: z.number().int().nonnegative(),
  progress: z.number().min(0).max(100).nullable().optional(),
  finalFilePath: z.string().optional(),
  fileName: z.string().optional(),
}).strict();
export type DownloadQueueTask = z.infer<typeof DownloadQueueTaskSchema>;

export const DownloadHistoryEntrySchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  kind: DownloadKindSchema,
  completedAt: z.number().int().nonnegative(),
}).strict();
export type DownloadHistoryEntry = z.infer<typeof DownloadHistoryEntrySchema>;

export const StartDownloadPayloadSchema = z.object({
  taskId: z.uuid(),
  url: z.url(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  kind: DownloadKindSchema,
}).strict();
export type StartDownloadPayload = z.infer<typeof StartDownloadPayloadSchema>;

export const BrowserStartDownloadPayloadSchema = StartDownloadPayloadSchema.extend({
  displayTitle: z.string().trim().min(1).max(240).optional(),
}).strict();
export type BrowserStartDownloadPayload = z.infer<typeof BrowserStartDownloadPayloadSchema>;
