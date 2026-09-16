import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { YtDlpUpdater } from '../src/updater/ytdlp-updater';

const VERSION = '2026.08.19';
const BINARY = new TextEncoder().encode('verified yt-dlp fixture');

function releaseFetcher(): typeof fetch {
  const checksum = createHash('sha256').update(BINARY).digest('hex');
  return vi.fn((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/releases/latest')) {
      return Promise.resolve(Response.json({
        tag_name: VERSION,
        assets: [
          { name: 'yt-dlp_macos', browser_download_url: 'https://github.com/yt-dlp/yt-dlp/releases/download/current/yt-dlp_macos' },
          { name: 'SHA2-256SUMS', browser_download_url: 'https://github.com/yt-dlp/yt-dlp/releases/download/current/SHA2-256SUMS' },
        ],
      }));
    }
    if (url.endsWith('/yt-dlp_macos')) return Promise.resolve(new Response(BINARY));
    return Promise.resolve(new Response(`${checksum}  yt-dlp_macos\n`));
  }) as unknown as typeof fetch;
}

describe('YtDlpUpdater', () => {
  it('prepares and launches the verified executable before replacing the installed copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-updater-test-'));
    const destination = join(directory, 'runtime', 'yt-dlp');
    const prepare = vi.fn(async (path: string, expectedVersion: string) => {
      expect(path).toBe(`${destination}.download`);
      expect(expectedVersion).toBe(VERSION);
      expect(new Uint8Array(await readFile(path))).toEqual(BINARY);
    });

    const updater = new YtDlpUpdater(destination, releaseFetcher(), prepare);
    await expect(updater.update()).resolves.toBe(VERSION);

    expect(prepare).toHaveBeenCalledOnce();
    expect(new Uint8Array(await readFile(destination))).toEqual(BINARY);
    expect(await readFile(`${destination}.version`, 'utf8')).toBe(`${VERSION}\n`);
  });

  it('keeps the previous executable when preparation fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-updater-rollback-test-'));
    const destination = join(directory, 'runtime', 'yt-dlp');
    await mkdir(join(directory, 'runtime'), { recursive: true });
    await writeFile(destination, 'working previous binary');
    const prepare = vi.fn(() => Promise.reject(new Error('macOS rejected the executable')));

    const updater = new YtDlpUpdater(destination, releaseFetcher(), prepare);
    await expect(updater.update()).rejects.toThrow('macOS rejected the executable');

    expect(await readFile(destination, 'utf8')).toBe('working previous binary');
    await expect(readFile(`${destination}.download`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
