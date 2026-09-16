import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';

export type SystemFileOpener = (path: string) => Promise<void>;

const execFileAsync = promisify(execFile);

export async function openDownloadedFile(path: string, systemOpen: SystemFileOpener = openWithDefaultApplication): Promise<void> {
  if (!isAbsolute(path)) throw new Error('Downloaded file path must be absolute');
  const file = await stat(path);
  if (!file.isFile()) throw new Error('Downloaded file no longer exists');
  await systemOpen(path);
}

async function openWithDefaultApplication(path: string): Promise<void> {
  await execFileAsync('/usr/bin/open', ['--', path], { timeout: 15_000 });
}
