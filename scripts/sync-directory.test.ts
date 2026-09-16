import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncDirectoryInPlace } from "./sync-directory";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("syncDirectoryInPlace", () => {
  it("updates a loaded extension directory without replacing its root", async () => {
    const root = await mkdtemp(join(tmpdir(), "clipflux-extension-sync-"));
    temporaryDirectories.push(root);
    const source = join(root, "source");
    const destination = join(root, "destination");
    await mkdir(join(source, "chunks"), { recursive: true });
    await mkdir(join(destination, "chunks"), { recursive: true });
    await writeFile(join(source, "manifest.json"), "new manifest");
    await writeFile(join(source, "chunks", "popup-new.js"), "new popup");
    await writeFile(join(destination, "manifest.json"), "old manifest");
    await writeFile(join(destination, "chunks", "popup-old.js"), "old popup");
    const destinationInode = (await stat(destination)).ino;

    await syncDirectoryInPlace(source, destination);

    expect((await stat(destination)).ino).toBe(destinationInode);
    expect(await readFile(join(destination, "manifest.json"), "utf8")).toBe("new manifest");
    expect(await readFile(join(destination, "chunks", "popup-new.js"), "utf8")).toBe("new popup");
    await expect(stat(join(destination, "chunks", "popup-old.js"))).rejects.toThrow();
  });
});
