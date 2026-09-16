import { homedir } from 'node:os';
import { join, normalize, resolve } from 'node:path';

export type RuntimePaths = {
  applicationSupport: string;
  runtimeDirectory: string;
  configFile: string;
  logFile: string;
  ytDlp: string;
  ffmpeg: string;
  ffprobe: string;
  deno: string;
};

export function createRuntimePaths(home = homedir()): RuntimePaths {
  const applicationSupport = join(home, 'Library', 'Application Support', 'LocalDownloader');
  const runtimeDirectory = join(applicationSupport, 'runtime');
  return {
    applicationSupport,
    runtimeDirectory,
    configFile: join(applicationSupport, 'config.json'),
    logFile: join(applicationSupport, 'helper.log'),
    ytDlp: join(runtimeDirectory, 'yt-dlp'),
    ffmpeg: join(runtimeDirectory, 'ffmpeg'),
    ffprobe: join(runtimeDirectory, 'ffprobe'),
    deno: join(runtimeDirectory, 'deno'),
  };
}

export function expandHomePath(path: string, home = homedir()): string {
  const expanded = path === '~' ? home : path.startsWith('~/') ? join(home, path.slice(2)) : path;
  const normalized = normalize(resolve(expanded));
  if (!normalized.startsWith('/')) throw new Error('Output directory must be absolute');
  return normalized;
}
