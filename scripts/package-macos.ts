import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NATIVE_HOST_NAME } from '../packages/shared/src/index';
import { createRuntimePaths } from '../apps/helper/src/runtime/paths';
import { findSingleIdentity, requireExtensionId, requireReleaseVersion, run } from './lib';

const root = resolve(import.meta.dir, '..');
const stage = resolve(root, 'dist/pkg-root');
const installDirectory = `${stage}/Library/LocalDownloader`;
const manifestDirectory = `${stage}/Library/Google/Chrome/NativeMessagingHosts`;
const architecture = process.arch;
if (architecture !== 'arm64' && architecture !== 'x64') throw new Error(`Unsupported macOS architecture: ${architecture}`);
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version?: unknown };
const version = requireReleaseVersion(packageJson.version);
const output = resolve(root, `dist/ClipFlux-${architecture}.pkg`);
const applicationIdentity = process.env['LOCAL_DOWNLOADER_APPLICATION_IDENTITY']
  ?? await findSingleIdentity('Developer ID Application');
const installerIdentity = process.env['LOCAL_DOWNLOADER_INSTALLER_IDENTITY']
  ?? await findSingleIdentity('Developer ID Installer');

await rm(stage, { recursive: true, force: true });
await rm(output, { force: true });
await mkdir(installDirectory, { recursive: true });
await mkdir(manifestDirectory, { recursive: true });
await cp(resolve(root, 'dist/local-downloader-helper'), `${installDirectory}/local-downloader-helper`);
await cp(createRuntimePaths().runtimeDirectory, `${installDirectory}/runtime`, { recursive: true });
for (const path of [
  `${installDirectory}/local-downloader-helper`,
  `${installDirectory}/runtime/yt-dlp`,
  `${installDirectory}/runtime/ffmpeg`,
  `${installDirectory}/runtime/ffprobe`,
  `${installDirectory}/runtime/deno`,
]) {
  await chmod(path, 0o755);
  await run('/usr/bin/codesign', ['--force', '--options', 'runtime', '--timestamp', '--sign', applicationIdentity, path]);
  await run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', path]);
}
await writeFile(`${manifestDirectory}/${NATIVE_HOST_NAME}.json`, `${JSON.stringify({
  name: NATIVE_HOST_NAME,
  description: 'ClipFlux native helper',
  path: '/Library/LocalDownloader/local-downloader-helper',
  type: 'stdio',
  allowed_origins: [`chrome-extension://${requireExtensionId()}/`],
}, null, 2)}\n`);
await run('/usr/bin/pkgbuild', [
  '--root', stage,
  '--identifier', 'com.localdownloader.helper',
  '--version', version,
  '--install-location', '/',
  '--ownership', 'recommended',
  '--sign', installerIdentity,
  '--timestamp',
  output,
]);
await run('/usr/sbin/pkgutil', ['--check-signature', output]);
console.log(`Created signed ${output}`);
