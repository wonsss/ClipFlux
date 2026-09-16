import { describe, expect, it } from 'vitest';
import { DownloadQueueStore } from '../src/features/downloader/queue-store';

const task = (taskId: string, videoId: string, displayTitle: string) => ({
  taskId, videoId, displayTitle, kind: 'video' as const, url: `https://www.youtube.com/watch?v=${videoId}`,
});

describe('DownloadQueueStore', () => {
  it('tracks queue positions and progress', () => {
    const store = new DownloadQueueStore();
    store.add(task('00000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ', 'First'), 1);
    store.add(task('00000000-0000-4000-8000-000000000002', 'aaaaaaaaaaa', 'Second'), 2);
    store.apply({ type: 'download_queued', taskId: '00000000-0000-4000-8000-000000000002', kind: 'video', videoId: 'aaaaaaaaaaa', position: 1 });
    store.apply({ type: 'download_started', taskId: '00000000-0000-4000-8000-000000000001', kind: 'video', videoId: 'dQw4w9WgXcQ' });
    store.apply({ type: 'download_progress', taskId: '00000000-0000-4000-8000-000000000001', percent: 42, downloadedBytes: 42, totalBytes: 100, speedBytesPerSecond: 5, etaSeconds: 12 });
    expect(store.snapshot().map(({ title, status, progress, queuePosition }) => ({ title, status, progress, queuePosition }))).toEqual([
      { title: 'First', status: 'downloading', progress: 42, queuePosition: undefined },
      { title: 'Second', status: 'queued', progress: undefined, queuePosition: 1 },
    ]);
  });

  it('stores completed file paths for user-initiated opening', () => {
    const store = new DownloadQueueStore();
    const taskId = '00000000-0000-4000-8000-000000000003';
    store.add(task(taskId, 'bbbbbbbbbbb', 'Completed'), 3);
    store.apply({ type: 'download_completed', taskId, kind: 'video', videoId: 'bbbbbbbbbbb', finalFilePath: '/tmp/completed.mp4', fileName: 'completed.mp4' });

    expect(store.completedFile(taskId)).toBe('/tmp/completed.mp4');
    expect(store.snapshot()[0]).toMatchObject({ finalFilePath: '/tmp/completed.mp4', fileName: 'completed.mp4' });
  });
});
