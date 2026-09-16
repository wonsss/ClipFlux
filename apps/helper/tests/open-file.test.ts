import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { openDownloadedFile } from '../src/macos/open-file';

describe('openDownloadedFile', () => {
  it('opens an existing downloaded file with the system application', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-open-test-'));
    const file = join(directory, 'video.mp4');
    await writeFile(file, 'fixture');
    const systemOpen = vi.fn(() => Promise.resolve());

    await openDownloadedFile(file, systemOpen);

    expect(systemOpen).toHaveBeenCalledWith(file);
  });

  it('rejects missing or relative paths before invoking the system', async () => {
    const systemOpen = vi.fn(() => Promise.resolve());
    await expect(openDownloadedFile('video.mp4', systemOpen)).rejects.toThrow('must be absolute');
    await expect(openDownloadedFile('/tmp/local-downloader-file-that-does-not-exist', systemOpen)).rejects.toThrow();
    expect(systemOpen).not.toHaveBeenCalled();
  });
});
