import { describe, expect, it } from 'vitest';
import type { DownloadQueueTask } from '@local-downloader/protocol';
import { ToolbarStatus } from '../src/features/downloader/toolbar-status';

const task = (status: DownloadQueueTask['status']): DownloadQueueTask => ({
  taskId: '00000000-0000-4000-8000-000000000001',
  videoId: 'dQw4w9WgXcQ',
  kind: 'video',
  status,
  createdAt: 1,
});

describe('ToolbarStatus', () => {
  it('shows active state, counts completions, and resets when the popup opens', () => {
    const toolbar = new ToolbarStatus();
    expect(toolbar.snapshot([task('downloading')])).toEqual({ active: true, completedCount: 0 });
    toolbar.apply({ type: 'download_completed', taskId: task('completed').taskId, kind: 'video', videoId: 'dQw4w9WgXcQ', finalFilePath: '/tmp/video.mp4', fileName: 'video.mp4' });
    expect(toolbar.snapshot([task('completed')])).toEqual({ active: false, completedCount: 1 });
    toolbar.resetCompletedCount();
    expect(toolbar.snapshot([task('completed')])).toEqual({ active: false, completedCount: 0 });
  });
});
