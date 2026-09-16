import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { tag_name: string; assets: ReleaseAsset[] };

export type UpdateInfo = { currentVersion?: string; latestVersion: string; updateAvailable: boolean };
export type PrepareYtDlpExecutable = (path: string, expectedVersion: string) => Promise<void>;

const execFileAsync = promisify(execFile);

export class YtDlpUpdater {
  public constructor(
    private readonly destination: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly prepareExecutable: PrepareYtDlpExecutable = prepareYtDlpExecutable,
  ) {}

  public async check(currentVersion?: string): Promise<UpdateInfo> {
    const release = await this.release();
    const latestVersion = release.tag_name.replace(/^v/, '');
    return { ...(currentVersion === undefined ? {} : { currentVersion }), latestVersion, updateAvailable: currentVersion !== latestVersion };
  }

  public async update(): Promise<string> {
    const release = await this.release();
    const version = release.tag_name.replace(/^v/, '');
    const binary = requiredAsset(release.assets, 'yt-dlp_macos');
    const checksums = requiredAsset(release.assets, 'SHA2-256SUMS');
    const [binaryResponse, checksumResponse] = await Promise.all([
      this.fetcher(binary.browser_download_url), this.fetcher(checksums.browser_download_url),
    ]);
    if (!binaryResponse.ok || !checksumResponse.ok) throw new Error('Unable to download official yt-dlp assets');
    const bytes = new Uint8Array(await binaryResponse.arrayBuffer());
    const checksumText = await checksumResponse.text();
    const expected = checksumText.split(/\r?\n/).find((line) => line.endsWith('  yt-dlp_macos'))?.split(/\s+/, 1)[0];
    if (expected === undefined) throw new Error('Official yt-dlp checksum is missing');
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) throw new Error('yt-dlp checksum verification failed');
    await mkdir(dirname(this.destination), { recursive: true, mode: 0o700 });
    const temporary = `${this.destination}.download`;
    await writeFile(temporary, bytes, { mode: 0o755 });
    await chmod(temporary, 0o755);
    try {
      await this.prepareExecutable(temporary, version);
      await rename(temporary, this.destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    await writeFile(`${this.destination}.version`, `${version}\n`, { mode: 0o600 });
    return version;
  }

  private async release(): Promise<Release> {
    const response = await this.fetcher('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LocalDownloader/0.1.0' },
    });
    if (!response.ok) throw new Error('Unable to check yt-dlp updates');
    return response.json() as Promise<Release>;
  }
}

export async function prepareYtDlpExecutable(path: string, expectedVersion: string): Promise<void> {
  await execFileAsync('/usr/bin/codesign', ['--force', '--sign', '-', path], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  const { stdout } = await execFileAsync(path, ['--version'], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  const actualVersion = stdout.trim().split(/\r?\n/, 1)[0];
  if (actualVersion !== expectedVersion) {
    throw new Error(`yt-dlp executable verification failed: expected ${expectedVersion}, received ${actualVersion || 'no version'}`);
  }
}

function requiredAsset(assets: ReleaseAsset[], name: string): ReleaseAsset {
  const asset = assets.find((candidate) => candidate.name === name);
  if (asset === undefined || new URL(asset.browser_download_url).hostname !== 'github.com') throw new Error(`Official ${name} asset is unavailable`);
  return asset;
}
