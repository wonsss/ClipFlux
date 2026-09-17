import { z } from 'zod';

export const VideoQualitySchema = z.enum([
  'best-up-to-1080p', 'best', '2160p', '1440p', '1080p', '720p', '480p',
]);
export type VideoQuality = z.infer<typeof VideoQualitySchema>;

export const VideoContainerSchema = z.enum(['mp4']);
export const AudioFormatSchema = z.enum(['original', 'm4a', 'mp3']);
export const Mp3BitrateSchema = z.union([z.literal(320), z.literal(256), z.literal(192)]);

export const HelperSettingsSchema = z.object({
  video: z.object({ quality: VideoQualitySchema, container: VideoContainerSchema }),
  audio: z.object({ format: AudioFormatSchema, mp3Bitrate: Mp3BitrateSchema }),
  output: z.object({ baseDirectory: z.string().min(1), separateFolders: z.boolean() }),
  updates: z.object({ automaticYtDlp: z.boolean() }),
}).strict();
export type HelperSettings = z.infer<typeof HelperSettingsSchema>;

export const DEFAULT_HELPER_SETTINGS: HelperSettings = {
  video: { quality: 'best-up-to-1080p', container: 'mp4' },
  audio: { format: 'original', mp3Bitrate: 320 },
  output: { baseDirectory: '~/Downloads/YouTube', separateFolders: true },
  updates: { automaticYtDlp: true },
};

export const ExtensionSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  showVideoButton: z.boolean(),
  showAudioButton: z.boolean(),
}).strict();
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;
export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  showVideoButton: true,
  showAudioButton: true,
};
