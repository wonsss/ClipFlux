import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRuntimePaths } from '../src/runtime/paths';
import { RuntimeManager } from '../src/runtime/runtime-manager';

describe('RuntimeManager', () => {
  it('prefers a system yt-dlp executable over the managed PyInstaller build', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-runtime-test-'));
    const paths = createRuntimePaths(directory);
    const systemYtDlp = join(directory, 'system', 'yt-dlp');
    await mkdir(paths.runtimeDirectory, { recursive: true });
    await mkdir(join(directory, 'system'), { recursive: true });
    await writeFile(paths.ytDlp, '#!/bin/sh\nexit 0\n');
    await writeFile(systemYtDlp, '#!/bin/sh\nexit 0\n');
    await chmod(paths.ytDlp, 0o755);
    await chmod(systemYtDlp, 0o755);

    const manager = new RuntimeManager(paths, false, [systemYtDlp]);

    await expect(manager.resolve('ytDlp')).resolves.toBe(systemYtDlp);
  });

  it('falls back to the managed yt-dlp when no system executable exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-runtime-fallback-test-'));
    const paths = createRuntimePaths(directory);
    await mkdir(paths.runtimeDirectory, { recursive: true });
    await writeFile(paths.ytDlp, '#!/bin/sh\nexit 0\n');
    await chmod(paths.ytDlp, 0o755);

    const manager = new RuntimeManager(paths, false, [join(directory, 'missing', 'yt-dlp')]);

    await expect(manager.resolve('ytDlp')).resolves.toBe(paths.ytDlp);
  });
});
