import { access, copyFile, readdir, rename, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

export type Logger = (message: string) => void;

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Finds the produced media file inside a staging directory when yt-dlp did not
// report its after-move path (e.g. a postprocessor error aborted the run).
export async function findStagedFile(
  stagingDirectory: string,
  baseName: string,
  extensions: readonly string[],
): Promise<string | undefined> {
  try {
    const entries = await readdir(stagingDirectory);
    const match = entries
      .filter((entry) => extensions.includes(extname(entry).slice(1).toLowerCase()) && entry.startsWith(`${baseName}.`))
      .sort()[0];
    return match === undefined ? undefined : join(stagingDirectory, match);
  } catch {
    return undefined;
  }
}

// Atomic within a volume; falls back to copy+unlink if the staging directory and
// the output directory ever end up on different volumes.
export async function moveAtomic(source: string, destination: string): Promise<void> {
  try {
    await rename(source, destination);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EXDEV') {
      await copyFile(source, destination);
      await rm(source, { force: true });
      return;
    }
    throw error;
  }
}

export type TargetFile = { fileName: string; obsoletePath: string | undefined };

// Picks the final file name. A previous download of the same video is reused or
// removed; unrelated name collisions get a numeric suffix.
export async function chooseTargetFileName(
  outputDirectory: string,
  baseName: string,
  extension: string,
  previousFileName: string | undefined,
): Promise<TargetFile> {
  const desired = `${baseName}.${extension}`;
  const previousPath = previousFileName === undefined ? undefined : join(outputDirectory, previousFileName);
  const previousExists = previousPath !== undefined && (await pathExists(previousPath));
  if (previousExists && previousFileName === desired) return { fileName: desired, obsoletePath: undefined };
  let candidate = desired;
  let suffix = 2;
  while (await pathExists(join(outputDirectory, candidate))) {
    candidate = `${baseName} (${suffix}).${extension}`;
    suffix += 1;
  }
  return { fileName: candidate, obsoletePath: previousExists ? previousPath : undefined };
}
