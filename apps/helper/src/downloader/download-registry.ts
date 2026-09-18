import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { DownloadKind } from '@local-downloader/protocol';

const RegistrySchema = z.record(
  z.string(),
  z.looseObject({ fileName: z.string(), completedAt: z.number().int().nonnegative() }),
);
type RegistryData = z.infer<typeof RegistrySchema>;

// Maps `${videoId}:${kind}` to the file name last produced for it, so re-downloading
// the same video replaces the previous file instead of creating duplicates.
export class DownloadRegistry {
  private data: RegistryData | undefined;

  public constructor(private readonly filePath: string) {}

  private async load(): Promise<RegistryData> {
    if (this.data !== undefined) return this.data;
    try {
      const parsed = RegistrySchema.safeParse(JSON.parse(await readFile(this.filePath, 'utf8')));
      this.data = parsed.success ? parsed.data : {};
    } catch {
      this.data = {};
    }
    return this.data;
  }

  public async lookup(videoId: string, kind: DownloadKind): Promise<string | undefined> {
    return (await this.load())[`${videoId}:${kind}`]?.fileName;
  }

  public async record(videoId: string, kind: DownloadKind, fileName: string): Promise<void> {
    const data = await this.load();
    data[`${videoId}:${kind}`] = { fileName, completedAt: Date.now() };
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.filePath);
  }
}
