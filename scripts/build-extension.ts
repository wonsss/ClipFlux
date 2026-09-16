import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { syncDirectoryInPlace } from "./sync-directory";

const projectRoot = resolve(import.meta.dir, "..");
const buildOutput = resolve(projectRoot, "apps/extension/.output/chrome-mv3");
const distributionOutput = resolve(projectRoot, "dist/chrome-extension");

const build = Bun.spawn(
  ["pnpm", "--filter", "@local-downloader/extension", "build"],
  {
    cwd: projectRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

const exitCode = await build.exited;

if (exitCode !== 0) {
  process.exit(exitCode);
}

await mkdir(resolve(projectRoot, "dist"), { recursive: true });
await syncDirectoryInPlace(buildOutput, distributionOutput);

console.log(`Extension ready: ${distributionOutput}`);
