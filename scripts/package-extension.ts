import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireReleaseVersion, run } from './lib';

const root = resolve(import.meta.dir, '..');
const source = resolve(root, 'dist/chrome-extension');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version?: unknown };
const version = requireReleaseVersion(packageJson.version);
const output = resolve(root, `dist/ClipFlux-extension-${version}.zip`);

await rm(output, { force: true });
await run('/usr/bin/zip', ['-X', '-q', '-r', output, '.'], { cwd: source });
await run('/usr/bin/unzip', ['-t', output]);
console.log(`Created Chrome Web Store package ${output}`);
