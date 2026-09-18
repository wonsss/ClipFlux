import { readdir, readFile, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import type { DownloadRegistry } from './download-registry';
import { audioFileBaseName, normalizeAudioMetadata, parseInfoJson, type AudioMetadata } from './audio-metadata';
import { chooseTargetFileName, findStagedFile, moveAtomic, type Logger } from './file-utils';

export { pathExists } from './file-utils';
export type { Logger } from './file-utils';

export const AUDIO_BASE_NAME = 'audio';
const AUDIO_EXTENSIONS = ['mp3', 'm4a'];
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export type AudioPostprocessOptions = {
  inputPath: string;
  stagingDirectory: string;
  outputDirectory: string;
  videoId: string;
  ffmpeg: string;
  ffprobe: string;
  registry?: DownloadRegistry;
  log?: Logger;
  onProcess?: (child: ChildProcessByStdio<null, Readable, Readable>) => void;
  isCancelled?: () => boolean;
};

export class PostprocessCancelledError extends Error {
  public constructor() {
    super('Download cancelled');
    this.name = 'PostprocessCancelledError';
  }
}

export type AudioPostprocessResult = {
  finalFilePath: string;
  metadataWritten: boolean;
  artworkEmbedded: boolean;
  verified: boolean;
};

// Finds the extracted audio file inside a staging directory when yt-dlp did not
// report its after-move path (e.g. a postprocessor error aborted the run).
export async function findStagedAudioFile(stagingDirectory: string): Promise<string | undefined> {
  return findStagedFile(stagingDirectory, AUDIO_BASE_NAME, AUDIO_EXTENSIONS);
}

async function findThumbnail(stagingDirectory: string): Promise<string | undefined> {
  try {
    const entries = await readdir(stagingDirectory);
    const match = entries
      .filter((entry) => entry.startsWith(`${AUDIO_BASE_NAME}.`) && IMAGE_EXTENSIONS.has(extname(entry).slice(1).toLowerCase()))
      .sort()[0];
    return match === undefined ? undefined : join(stagingDirectory, match);
  } catch {
    return undefined;
  }
}

type ProcessResult = { stdout: string; stderr: string };
type RunOptions = { timeoutMs?: number; onProcess?: AudioPostprocessOptions['onProcess'] };

function runProcess(executable: string, args: string[], options: RunOptions = {}): Promise<ProcessResult> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    options.onProcess?.(child);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${basename(executable)} timed out`));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-4000); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = stderr.trim().split('\n').pop() ?? `exit code ${code}`;
        reject(new Error(`${basename(executable)} failed: ${detail}`));
      }
    });
  });
}

// Builds a stream-copy ffmpeg command: audio is never re-encoded, metadata is
// replaced wholesale, and the thumbnail is attached as album artwork.
export function buildFfmpegArgs(
  inputPath: string,
  thumbnailPath: string | undefined,
  outputPath: string,
  metadata: AudioMetadata,
  videoId: string,
): string[] {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath];
  if (thumbnailPath !== undefined) args.push('-i', thumbnailPath);
  args.push('-map', '0:a');
  if (thumbnailPath !== undefined) args.push('-map', '1:v');
  else args.push('-map', '0:v?');
  args.push('-map_metadata', '-1', '-c:a', 'copy');
  if (thumbnailPath !== undefined) {
    // YouTube thumbnails are 16:9; re-encode to a centered square so Music.app
    // shows proper square album art instead of a letterboxed image.
    args.push('-c:v', 'mjpeg', '-filter:v', "crop='min(iw,ih)':'min(iw,ih)'");
    args.push('-disposition:v:0', 'attached_pic', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
  } else {
    args.push('-c:v', 'copy');
  }
  args.push('-metadata', `title=${metadata.title}`);
  if (metadata.artist !== undefined) args.push('-metadata', `artist=${metadata.artist}`);
  if (metadata.album !== undefined) args.push('-metadata', `album=${metadata.album}`);
  if (metadata.albumArtist !== undefined) args.push('-metadata', `album_artist=${metadata.albumArtist}`);
  if (metadata.year !== undefined) args.push('-metadata', `date=${metadata.year}`);
  if (metadata.genre !== undefined) args.push('-metadata', `genre=${metadata.genre}`);
  if (metadata.trackNumber !== undefined) args.push('-metadata', `track=${metadata.trackNumber}`);
  args.push('-metadata', `comment=https://www.youtube.com/watch?v=${videoId}`);
  if (extname(outputPath).toLowerCase() === '.mp3') args.push('-id3v2_version', '3', '-write_id3v1', '0');
  args.push(outputPath);
  return args;
}

const ProbeSchema = z.looseObject({
  format: z.looseObject({ tags: z.record(z.string(), z.unknown()).optional() }).optional(),
  streams: z.array(z.looseObject({
    codec_type: z.unknown().optional(),
    disposition: z.looseObject({ attached_pic: z.unknown().optional() }).optional(),
  })).optional(),
});

export type AudioVerification = { ok: boolean; mismatched: string[]; artwork: boolean };

export async function verifyAudioFile(
  ffprobe: string,
  filePath: string,
  expected: AudioMetadata,
): Promise<AudioVerification> {
  const { stdout } = await runProcess(ffprobe, [
    '-v', 'error', '-of', 'json',
    '-show_entries', 'format_tags:stream=codec_type:stream_disposition=attached_pic',
    filePath,
  ]);
  const parsed = ProbeSchema.safeParse(JSON.parse(stdout));
  if (!parsed.success) return { ok: false, mismatched: ['unparseable'], artwork: false };
  const tags = parsed.data.format?.tags ?? {};
  const actual = new Map(Object.entries(tags).map(([key, value]) => [key.toLowerCase(), String(value)]));
  const expectedTags: Record<string, string | undefined> = {
    title: expected.title,
    artist: expected.artist,
    album: expected.album,
    album_artist: expected.albumArtist,
    date: expected.year,
    genre: expected.genre,
    track: expected.trackNumber,
  };
  const mismatched = Object.entries(expectedTags)
    .filter(([key, value]) => value !== undefined && actual.get(key) !== value)
    .map(([key]) => key);
  const artwork = (parsed.data.streams ?? []).some(
    (stream) => stream.codec_type === 'video' || stream.disposition?.attached_pic === 1,
  );
  return { ok: mismatched.length === 0, mismatched, artwork };
}

export async function postprocessAudioFile(options: AudioPostprocessOptions): Promise<AudioPostprocessResult> {
  const log = options.log ?? (() => undefined);
  const ensureNotCancelled = (): void => {
    if (options.isCancelled?.() === true) throw new PostprocessCancelledError();
  };
  ensureNotCancelled();
  const extension = extname(options.inputPath).slice(1).toLowerCase();
  const infoJsonPath = join(options.stagingDirectory, `${AUDIO_BASE_NAME}.info.json`);
  const info = parseInfoJson(await readFile(infoJsonPath, 'utf8').catch(() => '{}'));
  const metadata = normalizeAudioMetadata(info, options.videoId);
  const baseName = audioFileBaseName(metadata);
  const thumbnail = await findThumbnail(options.stagingDirectory);
  const taggedPath = join(options.stagingDirectory, `tagged.${extension}`);

  let source = options.inputPath;
  let metadataWritten = false;
  let artworkEmbedded = false;
  try {
    await runProcess(options.ffmpeg, buildFfmpegArgs(options.inputPath, thumbnail, taggedPath, metadata, options.videoId), { onProcess: options.onProcess });
    source = taggedPath;
    metadataWritten = true;
    artworkEmbedded = thumbnail !== undefined;
  } catch (error) {
    ensureNotCancelled();
    log(`ffmpeg metadata pass failed (${error instanceof Error ? error.message : 'unknown'})`);
    if (thumbnail !== undefined) {
      try {
        await runProcess(options.ffmpeg, buildFfmpegArgs(options.inputPath, undefined, taggedPath, metadata, options.videoId), { onProcess: options.onProcess });
        source = taggedPath;
        metadataWritten = true;
      } catch (retryError) {
        ensureNotCancelled();
        log(`ffmpeg metadata retry failed (${retryError instanceof Error ? retryError.message : 'unknown'}); keeping original file`);
      }
    }
  }

  let verified = false;
  if (metadataWritten) {
    try {
      const verification = await verifyAudioFile(options.ffprobe, taggedPath, metadata);
      verified = verification.ok;
      if (!verification.ok) log(`metadata verification mismatch: ${verification.mismatched.join(', ')}`);
      if (!verification.artwork) log('metadata verification: no embedded artwork found');
      artworkEmbedded = verification.artwork;
    } catch (error) {
      log(`ffprobe verification failed (${error instanceof Error ? error.message : 'unknown'})`);
    }
  }

  ensureNotCancelled();
  const previous = await options.registry?.lookup(options.videoId, 'audio');
  const target = await chooseTargetFileName(options.outputDirectory, baseName, extension, previous);
  const finalFilePath = join(options.outputDirectory, target.fileName);
  await moveAtomic(source, finalFilePath);
  if (target.obsoletePath !== undefined) await rm(target.obsoletePath, { force: true }).catch(() => undefined);
  await options.registry?.record(options.videoId, 'audio', target.fileName);
  return { finalFilePath, metadataWritten, artworkEmbedded, verified };
}
