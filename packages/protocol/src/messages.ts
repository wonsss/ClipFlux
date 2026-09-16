import { z } from 'zod';
import { BrowserStartDownloadPayloadSchema, DownloadKindSchema, StartDownloadPayloadSchema } from './download';
import { HelperSettingsSchema } from './settings';

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('health_check') }).strict(),
  z.object({ type: z.literal('get_settings') }).strict(),
  z.object({ type: z.literal('update_settings'), settings: HelperSettingsSchema }).strict(),
  z.object({ type: z.literal('choose_download_directory') }).strict(),
  z.object({ type: z.literal('start_download'), payload: StartDownloadPayloadSchema }).strict(),
  z.object({ type: z.literal('cancel_download'), taskId: z.uuid() }).strict(),
  z.object({ type: z.literal('open_file'), path: z.string().min(1).max(4096).startsWith('/') }).strict(),
  z.object({ type: z.literal('check_for_updates') }).strict(),
  z.object({ type: z.literal('update_ytdlp') }).strict(),
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

const component = z.object({ installed: z.boolean(), version: z.string().optional() }).strict();
export const RuntimeStatusSchema = z.object({
  helper: component,
  ytDlp: component,
  ffmpeg: component,
  ffprobe: component,
  deno: component,
  ready: z.boolean(),
}).strict();
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;

export const HelperMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('health_result'), status: RuntimeStatusSchema }).strict(),
  z.object({ type: z.literal('settings_result'), settings: HelperSettingsSchema }).strict(),
  z.object({ type: z.literal('download_queued'), taskId: z.uuid(), kind: DownloadKindSchema, videoId: z.string(), position: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('download_started'), taskId: z.uuid(), kind: DownloadKindSchema, videoId: z.string() }).strict(),
  z.object({ type: z.literal('download_progress'), taskId: z.uuid(), percent: z.number().min(0).max(100).nullable(), downloadedBytes: z.number().nullable(), totalBytes: z.number().nullable(), speedBytesPerSecond: z.number().nullable(), etaSeconds: z.number().nullable() }).strict(),
  z.object({ type: z.literal('download_processing'), taskId: z.uuid() }).strict(),
  z.object({ type: z.literal('download_completed'), taskId: z.uuid(), kind: DownloadKindSchema, videoId: z.string(), finalFilePath: z.string(), fileName: z.string() }).strict(),
  z.object({ type: z.literal('download_failed'), taskId: z.uuid(), reason: z.string() }).strict(),
  z.object({ type: z.literal('update_status'), currentVersion: z.string().optional(), latestVersion: z.string().optional(), updateAvailable: z.boolean(), updated: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string(), requestType: z.string().optional() }).strict(),
]);
export type HelperMessage = z.infer<typeof HelperMessageSchema>;

export const BrowserMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start_download'), payload: BrowserStartDownloadPayloadSchema }).strict(),
  z.object({ type: z.literal('cancel_download'), taskId: z.uuid() }).strict(),
  z.object({ type: z.literal('open_download'), taskId: z.uuid() }).strict(),
  z.object({ type: z.literal('get_download_queue') }).strict(),
  z.object({ type: z.literal('get_download_history') }).strict(),
  z.object({ type: z.literal('get_extension_settings') }).strict(),
  z.object({ type: z.literal('native_event'), event: HelperMessageSchema }).strict(),
]);
export type BrowserMessage = z.infer<typeof BrowserMessageSchema>;
