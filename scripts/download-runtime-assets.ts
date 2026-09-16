import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createRuntimePaths } from '../apps/helper/src/runtime/paths';
import { YtDlpUpdater } from '../apps/helper/src/updater/ytdlp-updater';
import { run } from './lib';

type Asset = { name: string; browser_download_url: string };
type Release = { assets: Asset[] };

const paths = createRuntimePaths();
await mkdir(paths.runtimeDirectory, { recursive: true, mode: 0o700 });
await new YtDlpUpdater(paths.ytDlp).update();

const releaseResponse = await fetch('https://api.github.com/repos/denoland/deno/releases/latest', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LocalDownloader/0.1.0' } });
if (!releaseResponse.ok) throw new Error('Unable to read the official Deno release');
const release = await releaseResponse.json() as Release;
const architecture = process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : null;
if (architecture === null) throw new Error(`Unsupported macOS architecture: ${process.arch}`);
const zipName = `deno-${architecture}-apple-darwin.zip`;
const zipAsset = release.assets.find((asset) => asset.name === zipName);
const checksumAsset = release.assets.find((asset) => asset.name === `${zipName}.sha256sum`);
if (zipAsset === undefined || checksumAsset === undefined) throw new Error('Official Deno assets are unavailable');
if (new URL(zipAsset.browser_download_url).hostname !== 'github.com') throw new Error('Unexpected Deno download host');
const [zipResponse, checksumResponse] = await Promise.all([fetch(zipAsset.browser_download_url), fetch(checksumAsset.browser_download_url)]);
if (!zipResponse.ok || !checksumResponse.ok) throw new Error('Unable to download official Deno assets');
const zipBytes = new Uint8Array(await zipResponse.arrayBuffer());
const expected = (await checksumResponse.text()).trim().split(/\s+/, 1)[0];
const actual = createHash('sha256').update(zipBytes).digest('hex');
if (expected !== actual) throw new Error('Deno checksum verification failed');
const temporary = await mkdtemp(join(tmpdir(), 'local-downloader-deno-'));
const archive = join(temporary, zipName);
await writeFile(archive, zipBytes);
await run('/usr/bin/ditto', ['-x', '-k', archive, temporary]);
await copyFile(join(temporary, 'deno'), paths.deno);
await chmod(paths.deno, 0o755);
await rm(temporary, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;
const ffprobeModule = require('@ffprobe-installer/ffprobe') as { path: string };
if (ffmpegPath === null) throw new Error('ffmpeg-static does not support this platform');
await copyFile(ffmpegPath, paths.ffmpeg);
await copyFile(ffprobeModule.path, paths.ffprobe);
await chmod(paths.ffmpeg, 0o755);
await chmod(paths.ffprobe, 0o755);
console.log(`Installed verified runtime assets in ${paths.runtimeDirectory}`);
