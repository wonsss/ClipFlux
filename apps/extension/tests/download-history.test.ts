import { describe, expect, it, vi } from 'vitest';
import { DownloadHistoryStore } from '../src/features/downloader/download-history';

describe('DownloadHistoryStore', () => {
  it('persists completed media and replaces duplicate entries', async () => {
    let values: Record<string, unknown> = {};
    const storage = {
      get: vi.fn((key: string) => Promise.resolve({ [key]: values[key] })),
      set: vi.fn((next: Record<string, unknown>) => { values = { ...values, ...next }; return Promise.resolve(); }),
    };
    const history = new DownloadHistoryStore(storage);

    await history.record('dQw4w9WgXcQ', 'video', 10);
    await history.record('dQw4w9WgXcQ', 'audio', 20);
    await history.record('dQw4w9WgXcQ', 'video', 30);

    expect(await history.snapshot()).toEqual([
      { videoId: 'dQw4w9WgXcQ', kind: 'video', completedAt: 30 },
      { videoId: 'dQw4w9WgXcQ', kind: 'audio', completedAt: 20 },
    ]);
  });

  it('recovers from malformed stored history', async () => {
    const storage = {
      get: vi.fn(() => Promise.resolve({ downloadHistory: [{ broken: true }] })),
      set: vi.fn(() => Promise.resolve()),
    };
    const history = new DownloadHistoryStore(storage);

    expect(await history.snapshot()).toEqual([]);
  });
});
