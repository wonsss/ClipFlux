import { readFile, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { DownloadRegistry } from './download-registry';
import { normalizeVideoTitle, parseInfoJson, sanitizeFileName } from './audio-metadata';
import { chooseTargetFileName, findStagedFile, moveAtomic, type Logger } from './file-utils';

export const VIDEO_BASE_NAME = 'video';
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov'];

export async function findStagedVideoFile(stagingDirectory: string): Promise<string | undefined> {
  return findStagedFile(stagingDirectory, VIDEO_BASE_NAME, VIDEO_EXTENSIONS);
}

export type VideoPostprocessOptions = {
  inputPath: string;
  stagingDirectory: string;
  outputDirectory: string;
  videoId: string;
  registry?: DownloadRegistry;
  log?: Logger;
};

// Videos arrive already tagged by yt-dlp (--embed-metadata/--embed-chapters);
// this step only resolves the final name, de-duplicates, and moves atomically.
export async function postprocessVideoFile(options: VideoPostprocessOptions): Promise<{ finalFilePath: string }> {
  const extension = extname(options.inputPath).slice(1).toLowerCase();
  const infoJsonPath = join(options.stagingDirectory, `${VIDEO_BASE_NAME}.info.json`);
  const info = parseInfoJson(await readFile(infoJsonPath, 'utf8').catch(() => '{}'));
  const baseName = sanitizeFileName(normalizeVideoTitle(info, options.videoId));
  const previous = await options.registry?.lookup(options.videoId, 'video');
  const target = await chooseTargetFileName(options.outputDirectory, baseName, extension, previous);
  const finalFilePath = join(options.outputDirectory, target.fileName);
  await moveAtomic(options.inputPath, finalFilePath);
  if (target.obsoletePath !== undefined) await rm(target.obsoletePath, { force: true }).catch(() => undefined);
  await options.registry?.record(options.videoId, 'video', target.fileName);
  return { finalFilePath };
}
