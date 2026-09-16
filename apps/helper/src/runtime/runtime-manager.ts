import { constants } from 'node:fs';
import { access, chmod, copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { RuntimeStatus } from '@local-downloader/protocol';
import { HELPER_VERSION } from '@local-downloader/shared';
import type { RuntimePaths } from './paths';

type RuntimeName = 'ytDlp' | 'ffmpeg' | 'ffprobe' | 'deno';
const DEV_CANDIDATES: Record<RuntimeName, string[]> = {
  ytDlp: ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp'],
  ffmpeg: ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'],
  ffprobe: ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe'],
  deno: ['/opt/homebrew/bin/deno', '/usr/local/bin/deno'],
};

export class RuntimeManager {
  public constructor(
    private readonly paths: RuntimePaths,
    private readonly development = process.env['LOCAL_DOWNLOADER_DEV'] === '1',
    private readonly systemYtDlpCandidates: readonly string[] = DEV_CANDIDATES.ytDlp,
  ) {}

  public async resolve(name: RuntimeName): Promise<string> {
    if (name === 'ytDlp') {
      for (const candidate of this.systemYtDlpCandidates) {
        if (await executable(candidate)) return candidate;
      }
    }
    const managed = this.paths[name];
    if (await executable(managed)) return managed;
    const bundledDirectory = process.env['LOCAL_DOWNLOADER_BUNDLED_RUNTIME'] ?? '/Library/LocalDownloader/runtime';
    const bundled = join(bundledDirectory, name === 'ytDlp' ? 'yt-dlp' : name.toLowerCase());
    if (await executable(bundled)) {
      await mkdir(this.paths.runtimeDirectory, { recursive: true, mode: 0o700 });
      await copyFile(bundled, managed);
      await chmod(managed, 0o755);
      return managed;
    }
    if (this.development) {
      for (const candidate of DEV_CANDIDATES[name]) if (await executable(candidate)) return candidate;
    }
    return managed;
  }

  public async effectivePaths(): Promise<RuntimePaths> {
    return {
      ...this.paths,
      ytDlp: await this.resolve('ytDlp'),
      ffmpeg: await this.resolve('ffmpeg'),
      ffprobe: await this.resolve('ffprobe'),
      deno: await this.resolve('deno'),
    };
  }

  public async status(): Promise<RuntimeStatus> {
    const [ytDlp, ffmpeg, ffprobe, deno] = await Promise.all([
      this.component('ytDlp'), this.component('ffmpeg'), this.component('ffprobe'), this.component('deno'),
    ]);
    return {
      helper: { installed: true, version: HELPER_VERSION },
      ytDlp, ffmpeg, ffprobe, deno,
      ready: ytDlp.installed && ffmpeg.installed && ffprobe.installed && deno.installed,
    };
  }

  private async component(name: RuntimeName): Promise<{ installed: boolean; version?: string }> {
    const path = await this.resolve(name);
    if (!(await executable(path))) return { installed: false };
    try {
      if (name === 'ytDlp') {
        try {
          const cachedVersion = (await readFile(`${path}.version`, 'utf8')).trim();
          if (/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/.test(cachedVersion)) return { installed: true, version: cachedVersion };
        } catch { /* Development binaries may not have verified release metadata. */ }
      }
      const version = await firstOutputLine(path, name === 'ytDlp' || name === 'deno' ? ['--version'] : ['-version']);
      return version === '' ? { installed: true } : { installed: true, version };
    } catch {
      return { installed: false };
    }
  }
}

async function executable(path: string): Promise<boolean> {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}

function firstOutputLine(executablePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Version check timed out')); }, 10000);
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim().split(/\r?\n/, 1)[0] ?? ''); else reject(new Error('Version command failed'));
    });
  });
}
