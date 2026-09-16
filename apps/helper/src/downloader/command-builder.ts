import { basename, join } from 'node:path';
import type { DownloadKind, HelperSettings, StartDownloadPayload, VideoQuality } from '@local-downloader/protocol';
import type { RuntimePaths } from '../runtime/paths';
import { expandHomePath } from '../runtime/paths';
import { validateYouTubeUrl } from '../security/youtube-url';

export type DownloadCommand = { executable: string; args: string[]; outputDirectory: string };

const HEIGHTS: Partial<Record<VideoQuality, number>> = {
  '2160p': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480,
};

export function videoFormat(quality: VideoQuality): string {
  if (quality === 'best') return 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b';
  const height = quality === 'best-up-to-1080p' ? 1080 : HEIGHTS[quality];
  if (height === undefined) throw new Error('Unsupported video quality');
  return `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/bv*[height<=${height}]+ba/b[height<=${height}]`;
}

function audioArgs(settings: HelperSettings): string[] {
  if (settings.audio.format === 'original') return ['-f', 'ba'];
  if (settings.audio.format === 'm4a') return ['-f', 'ba', '-x', '--audio-format', 'm4a'];
  return ['-f', 'ba', '-x', '--audio-format', 'mp3', '--audio-quality', `${settings.audio.mp3Bitrate}K`];
}

export function outputDirectory(settings: HelperSettings, kind: DownloadKind): string {
  const base = expandHomePath(settings.output.baseDirectory);
  return settings.output.separateFolders ? join(base, kind === 'video' ? 'Video' : 'Audio') : base;
}

export function buildDownloadCommand(
  request: StartDownloadPayload,
  settings: HelperSettings,
  paths: RuntimePaths,
): DownloadCommand {
  const validated = validateYouTubeUrl(request.url, request.videoId);
  const directory = outputDirectory(settings, request.kind);
  const args = [
    '--no-playlist', '--newline', '--no-warnings',
    '--progress-template', 'download:LOCAL_DOWNLOADER_PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '--progress-template', 'postprocess:LOCAL_DOWNLOADER_PROCESSING|%(info.id)s',
    '--print', 'after_move:LOCAL_DOWNLOADER_COMPLETE|%(filepath)s',
    '--ffmpeg-location', paths.ffmpeg,
    '--js-runtimes', `deno:${paths.deno}`,
    '-o', join(directory, '%(title)s [%(id)s].%(ext)s'),
  ];
  if (request.kind === 'video') {
    args.push('-f', videoFormat(settings.video.quality), '--merge-output-format', settings.video.container);
  } else {
    args.push(...audioArgs(settings));
  }
  args.push(validated.url);
  if (basename(paths.ytDlp) !== 'yt-dlp') throw new Error('Invalid yt-dlp runtime path');
  return { executable: paths.ytDlp, args, outputDirectory: directory };
}
