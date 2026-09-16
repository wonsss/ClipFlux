import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { NATIVE_HOST_NAME } from '../packages/shared/src/index';
import { requireExtensionId } from './lib';

const extensionId = requireExtensionId();
const helperPath = resolve(import.meta.dir, '../dist/local-downloader-helper');
const directory = join(homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
const manifestPath = join(directory, `${NATIVE_HOST_NAME}.json`);
await chmod(helperPath, 0o755);
await mkdir(directory, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify({
  name: NATIVE_HOST_NAME,
  description: 'ClipFlux native helper',
  path: helperPath,
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extensionId}/`],
}, null, 2)}\n`, { mode: 0o644 });
console.log(`Registered ${NATIVE_HOST_NAME} for Chrome at ${manifestPath}`);
