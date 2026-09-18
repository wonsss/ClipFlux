import { basename, join } from 'node:path';
import type { DownloadKind, HelperSettings, StartDownloadPayload, VideoQuality } from '@local-downloader/protocol';
import type { RuntimePaths } from '../runtime/paths';
import { expandHomePath } from '../runtime/paths';
import { validateYouTubeUrl } from '../security/youtube-url';
import { AUDIO_BASE_NAME } from './audio-postprocess';
import { VIDEO_BASE_NAME } from './video-postprocess';

export type DownloadCommand = {
  executable: string;
  args: string[];
  outputDirectory: string;
  stagingDirectory: string;
};

const HEIGHTS: Partial<Record<VideoQuality, number>> = {
  '2160p': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480,
};

export function videoFormat(quality: VideoQuality): string {
  if (quality === 'best') return 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b';
  const height = quality === 'best-up-to-1080p' ? 1080 : HEIGHTS[quality];
  if (height === undefined) throw new Error('Unsupported video quality');
  return `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/bv*[height<=${height}]+ba/b[height<=${height}]`;
}

// Only mp3/m4a are produced; m4a sources are preferred so extraction avoids
// transcoding when YouTube already serves AAC audio.
function audioArgs(settings: HelperSettings): string[] {
  const args = ['-f', 'ba[ext=m4a]/ba', '-x', '--audio-format', settings.audio.format];
  if (settings.audio.format === 'mp3') args.push('--audio-quality', `${settings.audio.mp3Bitrate}K`);
  return args;
}

// Best-effort tags embedded by yt-dlp itself; the helper rewrites them
// deterministically afterwards, so these act as a fallback layer.
const METADATA_PARSE_ARGS = [
  '--embed-metadata',
  '--parse-metadata', '%(track,title|)s:%(meta_title)s',
  '--parse-metadata', '%(artist,creator,uploader,channel|)s:%(meta_artist)s',
  '--parse-metadata', '%(album,release_title,track,title|)s:%(meta_album)s',
  '--parse-metadata', '%(artist,creator,uploader|)s:%(meta_album_artist)s',
  '--parse-metadata', '%(release_year,upload_date>%Y|)s:%(meta_date)s',
  '--parse-metadata', '%(genre|)s:%(meta_genre)s',
];

const ARTWORK_AND_INFO_ARGS = [
  '--write-thumbnail',
  '--convert-thumbnails', 'jpg',
  '--embed-thumbnail',
  '--write-info-json',
];

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
  const isAudio = request.kind === 'audio';
  // Downloads are staged outside the (possibly watched) output folder so folder
  // actions and partial .part files never leak into it; the finished file is
  // moved there atomically after post-processing.
  const stagingDirectory = join(paths.applicationSupport, 'staging', request.taskId);
  const args = [
    '--no-playlist', '--newline', '--no-warnings',
    '--progress-template', 'download:LOCAL_DOWNLOADER_PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '--progress-template', 'postprocess:LOCAL_DOWNLOADER_PROCESSING|%(info.id)s',
    '--print', 'after_move:LOCAL_DOWNLOADER_COMPLETE|%(filepath)s',
    '--ffmpeg-location', paths.ffmpeg,
    '--js-runtimes', `deno:${paths.deno}`,
    '-o', join(stagingDirectory, `${isAudio ? AUDIO_BASE_NAME : VIDEO_BASE_NAME}.%(ext)s`),
  ];
  if (request.kind === 'video') {
    args.push('-f', videoFormat(settings.video.quality), '--merge-output-format', settings.video.container, '--embed-metadata', '--embed-chapters', '--write-info-json');
  } else {
    args.push(...audioArgs(settings), ...METADATA_PARSE_ARGS, ...ARTWORK_AND_INFO_ARGS);
  }
  args.push(validated.url);
  if (basename(paths.ytDlp) !== 'yt-dlp') throw new Error('Invalid yt-dlp runtime path');
  return { executable: paths.ytDlp, args, outputDirectory: directory, stagingDirectory };
}
