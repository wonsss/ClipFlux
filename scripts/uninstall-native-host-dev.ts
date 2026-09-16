import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NATIVE_HOST_NAME } from '../packages/shared/src/index';

const manifestPath = join(homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
await rm(manifestPath, { force: true });
console.log(`Removed ${manifestPath}`);
