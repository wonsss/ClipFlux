import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HELPER_SETTINGS, type HelperMessage, type StartDownloadPayload } from '@local-downloader/protocol';
import { DownloadRunner } from '../src/downloader/download-runner';
import { createRuntimePaths } from '../src/runtime/paths';
import { RuntimeManager } from '../src/runtime/runtime-manager';

describe('DownloadRunner integration', () => {
  it('streams typed events from a fake yt-dlp executable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-test-'));
    const paths = createRuntimePaths(directory);
    await mkdir(paths.runtimeDirectory, { recursive: true });
    await writeFile(paths.ytDlp, `#!${process.execPath}\nrequire('node:fs').writeFileSync('${directory}/video.mp4', 'fake video');\nprocess.stdout.write('LOCAL_DOWNLOADER_PROGRESS|25|100|NA|5|15\\n');\nprocess.stdout.write('LOCAL_DOWNLOADER_COMPLETE|${directory}/video.mp4\\n');\n`);
    await chmod(paths.ytDlp, 0o755);
    const runner = new DownloadRunner(new RuntimeManager(paths, false, []));
    const request: StartDownloadPayload = { taskId: '00000000-0000-4000-8000-000000000000', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', kind: 'video' };
    const settings = structuredClone(DEFAULT_HELPER_SETTINGS);
    settings.output.baseDirectory = directory;
    const events: HelperMessage[] = [];
    await new Promise<void>((resolve, reject) => {
      void runner.start(request, settings, (event) => {
        events.push(event);
        if (event.type === 'download_completed') resolve();
        if (event.type === 'download_failed') reject(new Error(event.reason));
      }).catch(reject);
    });
    expect(events.map((event) => event.type)).toEqual(['download_queued', 'download_started', 'download_progress', 'download_processing', 'download_completed']);
  });

  it('queues beyond the concurrency limit and cancels a pending task', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-downloader-queue-test-'));
    const paths = createRuntimePaths(directory);
    await mkdir(paths.runtimeDirectory, { recursive: true });
    await writeFile(paths.ytDlp, `#!${process.execPath}\nsetTimeout(() => {\n  require('node:fs').writeFileSync('${directory}/video.mp4', 'fake video');\n  process.stdout.write('LOCAL_DOWNLOADER_COMPLETE|${directory}/video.mp4\\n');\n}, 80);\n`);
    await chmod(paths.ytDlp, 0o755);
    const runner = new DownloadRunner(new RuntimeManager(paths, false, []), 1);
    const settings = structuredClone(DEFAULT_HELPER_SETTINGS);
    settings.output.baseDirectory = directory;
    const first: StartDownloadPayload = { taskId: '00000000-0000-4000-8000-000000000001', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', kind: 'video' };
    const second: StartDownloadPayload = { taskId: '00000000-0000-4000-8000-000000000002', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', videoId: 'aaaaaaaaaaa', kind: 'audio' };
    const firstEvents: HelperMessage[] = [];
    const secondEvents: HelperMessage[] = [];
    await runner.start(first, settings, (event) => firstEvents.push(event));
    await runner.start(second, settings, (event) => secondEvents.push(event));
    expect(runner.cancel(second.taskId)).toBe(true);
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        if (firstEvents.some((event) => event.type === 'download_completed')) { clearInterval(timer); resolve(); }
      }, 10);
      setTimeout(() => { clearInterval(timer); reject(new Error('fake download timed out')); }, 2000);
    });
    expect(secondEvents.some((event) => event.type === 'download_started')).toBe(false);
    expect(secondEvents.at(-1)).toMatchObject({ type: 'download_failed', reason: 'Download cancelled' });
  });
});
