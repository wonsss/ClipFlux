import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { requireReleaseVersion, run } from './lib';

const root = resolve(import.meta.dir, '..');
const architecture = process.arch;
if (architecture !== 'arm64' && architecture !== 'x64') throw new Error(`Unsupported macOS architecture: ${architecture}`);
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version?: unknown };
requireReleaseVersion(packageJson.version);
const packagePath = resolve(root, `dist/ClipFlux-${architecture}.pkg`);
const profile = process.env['LOCAL_DOWNLOADER_NOTARY_PROFILE'] ?? 'LocalDownloader';

await access(packagePath, constants.R_OK);
await run('/usr/bin/xcrun', ['notarytool', 'history', '--keychain-profile', profile]);
await run('/usr/bin/xcrun', ['notarytool', 'submit', packagePath, '--keychain-profile', profile, '--wait']);
await run('/usr/bin/xcrun', ['stapler', 'staple', '-v', packagePath]);
await run('/usr/bin/xcrun', ['stapler', 'validate', '-v', packagePath]);
await run('/usr/sbin/spctl', ['--assess', '--type', 'install', '--verbose=4', packagePath]);
console.log(`Notarized, stapled, and verified ${packagePath}`);
