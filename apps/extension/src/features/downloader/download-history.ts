import { DownloadHistoryEntrySchema, type DownloadHistoryEntry, type DownloadKind } from '@local-downloader/protocol';
import { z } from 'zod';

const STORAGE_KEY = 'downloadHistory';
const MAX_ENTRIES = 500;
const DownloadHistorySchema = z.array(DownloadHistoryEntrySchema);

type StorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
};

export class DownloadHistoryStore {
  private pendingWrite: Promise<void> = Promise.resolve();

  public constructor(private readonly storage: StorageArea = chrome.storage.local) {}

  public async snapshot(): Promise<DownloadHistoryEntry[]> {
    await this.pendingWrite;
    return this.read();
  }

  private async read(): Promise<DownloadHistoryEntry[]> {
    const stored = await this.storage.get(STORAGE_KEY);
    const parsed = DownloadHistorySchema.safeParse(stored[STORAGE_KEY]);
    return parsed.success ? parsed.data : [];
  }

  public record(videoId: string, kind: DownloadKind, completedAt = Date.now()): Promise<void> {
    this.pendingWrite = this.pendingWrite.then(async () => {
      const history = await this.read();
      const next = [
        { videoId, kind, completedAt },
        ...history.filter((entry) => entry.videoId !== videoId || entry.kind !== kind),
      ].slice(0, MAX_ENTRIES);
      await this.storage.set({ [STORAGE_KEY]: next });
    });
    return this.pendingWrite;
  }
}
