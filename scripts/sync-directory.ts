import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

export async function syncDirectoryInPlace(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });

  const sourceEntries = await readdir(source, { withFileTypes: true });
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));

  for (const entry of sourceEntries.filter((candidate) => candidate.isDirectory())) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    const destinationKind = await stat(destinationPath).catch(() => undefined);
    if (destinationKind !== undefined && !destinationKind.isDirectory()) {
      await rm(destinationPath, { force: true, recursive: true });
    }
    await syncDirectoryInPlace(sourcePath, destinationPath);
  }

  for (const entry of sourceEntries.filter((candidate) => !candidate.isDirectory())) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    const destinationKind = await stat(destinationPath).catch(() => undefined);
    if (destinationKind?.isDirectory() === true) {
      await rm(destinationPath, { force: true, recursive: true });
    }
    await cp(sourcePath, destinationPath, { force: true });
  }

  const destinationEntries = await readdir(destination, { withFileTypes: true });
  for (const entry of destinationEntries) {
    if (!sourceNames.has(entry.name)) {
      await rm(join(destination, entry.name), { force: true, recursive: true });
    }
  }
}
