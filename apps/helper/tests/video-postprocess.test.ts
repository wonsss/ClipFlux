import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DownloadRegistry } from '../src/downloader/download-registry';
import { findStagedVideoFile, postprocessVideoFile, VIDEO_BASE_NAME } from '../src/downloader/video-postprocess';

async function fixture(): Promise<{ staging: string; output: string }> {
  const root = await mkdtemp(join(tmpdir(), 'video-postprocess-test-'));
  const staging = join(root, 'staging');
  const output = join(root, 'output');
  await mkdir(staging, { recursive: true });
  await mkdir(output, { recursive: true });
  return { staging, output };
}

describe('findStagedVideoFile', () => {
  it('finds the staged video and ignores partial or sidecar files', async () => {
    const { staging } = await fixture();
    await writeFile(join(staging, 'video.mp4.part'), 'partial');
    await writeFile(join(staging, 'video.info.json'), '{}');
    await writeFile(join(staging, 'video.mp4'), 'video bytes');
    expect(await findStagedVideoFile(staging)).toBe(join(staging, 'video.mp4'));
  });

  it('returns undefined when no staged video exists', async () => {
    const { staging } = await fixture();
    await writeFile(join(staging, 'video.info.json'), '{}');
    expect(await findStagedVideoFile(staging)).toBeUndefined();
  });
});

describe('postprocessVideoFile', () => {
  it('moves a staged video to a sanitized title-based name', async () => {
    const { staging, output } = await fixture();
    const staged = join(staging, 'video.mp4');
    await writeFile(staged, 'video bytes');
    await writeFile(join(staging, 'video.info.json'), JSON.stringify({ title: 'A/B: Test? "Video"' }));
    const result = await postprocessVideoFile({
      inputPath: staged,
      stagingDirectory: staging,
      outputDirectory: output,
      videoId: 'dQw4w9WgXcQ',
    });
    const fileName = result.finalFilePath.split('/').at(-1) ?? '';
    expect(fileName).toMatch(/^[^/\\:*?"<>|]+\.mp4$/);
    expect(fileName).toContain('Test');
    expect(fileName).toContain('Video');
    expect(await readFile(result.finalFilePath, 'utf8')).toBe('video bytes');
  });

  it('falls back to the video id when info.json is missing', async () => {
    const { staging, output } = await fixture();
    const staged = join(staging, 'video.mkv');
    await writeFile(staged, 'video bytes');
    const result = await postprocessVideoFile({
      inputPath: staged,
      stagingDirectory: staging,
      outputDirectory: output,
      videoId: 'dQw4w9WgXcQ',
    });
    expect(result.finalFilePath).toBe(join(output, 'dQw4w9WgXcQ.mkv'));
  });

  it('replaces the previous download of the same video instead of duplicating', async () => {
    const { staging, output } = await fixture();
    const registryPath = join(staging, 'registry.json');
    const registry = new DownloadRegistry(registryPath);
    const first = join(staging, 'video.mp4');
    await writeFile(first, 'first');
    await writeFile(join(staging, 'video.info.json'), JSON.stringify({ title: 'My Video' }));
    const one = await postprocessVideoFile({ inputPath: first, stagingDirectory: staging, outputDirectory: output, videoId: 'dQw4w9WgXcQ', registry });
    await writeFile(first, 'second');
    const two = await postprocessVideoFile({ inputPath: first, stagingDirectory: staging, outputDirectory: output, videoId: 'dQw4w9WgXcQ', registry });
    expect(two.finalFilePath).toBe(one.finalFilePath);
    expect(await readFile(two.finalFilePath, 'utf8')).toBe('second');
    expect((await readdir(output)).filter((entry) => entry.endsWith('.mp4'))).toHaveLength(1);
  });

  it('suffixes unrelated name collisions', async () => {
    const { staging, output } = await fixture();
    await writeFile(join(output, 'My Video.mp4'), 'unrelated');
    const staged = join(staging, 'video.mp4');
    await writeFile(staged, 'video bytes');
    await writeFile(join(staging, 'video.info.json'), JSON.stringify({ title: 'My Video' }));
    const result = await postprocessVideoFile({
      inputPath: staged,
      stagingDirectory: staging,
      outputDirectory: output,
      videoId: 'dQw4w9WgXcQ',
    });
    expect(result.finalFilePath).toBe(join(output, 'My Video (2).mp4'));
    expect(await readFile(join(output, 'My Video.mp4'), 'utf8')).toBe('unrelated');
  });

  it('exposes the staging base name used by the command builder', () => {
    expect(VIDEO_BASE_NAME).toBe('video');
  });
});
