import { spawn } from 'node:child_process';

const SCRIPT = 'POSIX path of (choose folder with prompt "Choose a download folder")';

export function chooseDirectory(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/osascript', ['-e', SCRIPT], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString('utf8'); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(output.trim().replace(/\/$/, ''));
      else if (/User canceled/i.test(error)) resolve(null);
      else reject(new Error('Unable to open the directory picker'));
    });
  });
}
