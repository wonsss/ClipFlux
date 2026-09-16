import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_HELPER_SETTINGS, HelperSettingsSchema, type HelperSettings } from '@local-downloader/protocol';

export class ConfigStore {
  public constructor(private readonly filePath: string) {}

  public async load(): Promise<HelperSettings> {
    try {
      return HelperSettingsSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return structuredClone(DEFAULT_HELPER_SETTINGS);
      if (error instanceof SyntaxError) throw new Error('Helper configuration is invalid');
      throw error;
    }
  }

  public async save(settings: HelperSettings): Promise<HelperSettings> {
    const validated = HelperSettingsSchema.parse(settings);
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.filePath);
    return validated;
  }
}
