import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { run } from './lib';

const root = resolve(import.meta.dir, '..');
await mkdir(resolve(root, 'dist'), { recursive: true });
await run(process.execPath, ['build', resolve(root, 'apps/helper/src/index.ts'), '--compile', '--minify', '--outfile', resolve(root, 'dist/local-downloader-helper')]);
console.log('Built dist/local-downloader-helper');
