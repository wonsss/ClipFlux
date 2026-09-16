import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function run(executable: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${executable} exited with ${code ?? 'unknown'}`)));
  });
}

export function requireExtensionId(): string {
  const id = process.env['LOCAL_DOWNLOADER_EXTENSION_ID'];
  if (id === undefined || !/^[a-p]{32}$/.test(id)) {
    throw new Error('Set LOCAL_DOWNLOADER_EXTENSION_ID to the 32-character Chrome extension ID');
  }
  return id;
}

export async function findSingleIdentity(kind: 'Developer ID Application' | 'Developer ID Installer'): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/security', ['find-identity', '-v', '-p', 'basic'], {
    encoding: 'utf8',
  });
  const identities = [...stdout.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((identity): identity is string => identity?.startsWith(`${kind}: `) === true);
  const identity = identities[0];
  if (identity === undefined) {
    throw new Error(`${kind} certificate is not installed in an accessible Keychain`);
  }
  if (identities.length > 1) {
    throw new Error(`Multiple ${kind} certificates found; set the matching LOCAL_DOWNLOADER_${kind === 'Developer ID Application' ? 'APPLICATION' : 'INSTALLER'}_IDENTITY`);
  }
  return identity;
}

export function requireReleaseVersion(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error('The root package version must use MAJOR.MINOR.PATCH format');
  }
  return value;
}
