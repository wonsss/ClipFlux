import { describe, expect, it } from 'vitest';
import { DEFAULT_HELPER_SETTINGS, type HelperSettings, type StartDownloadPayload } from '@local-downloader/protocol';
import { buildDownloadCommand, outputDirectory, videoFormat } from '../src/downloader/command-builder';
import { createRuntimePaths } from '../src/runtime/paths';

const paths = createRuntimePaths('/Users/test');
const request: StartDownloadPayload = { taskId: '00000000-0000-4000-8000-000000000000', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', kind: 'video' };
const settings = (): HelperSettings => structuredClone(DEFAULT_HELPER_SETTINGS);

describe('command builder', () => {
  it('builds the default 1080p command without a shell', () => {
    const result = buildDownloadCommand(request, settings(), paths);
    expect(result.args).toContain('bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]');
    expect(result.args).toContain('--no-playlist');
  });
  it('supports best and fixed qualities', () => {
    expect(videoFormat('best')).toContain('bv*[ext=mp4]');
    expect(videoFormat('2160p')).toContain('height<=2160');
    expect(videoFormat('1440p')).toContain('height<=1440');
    expect(videoFormat('720p')).toContain('height<=720');
    expect(videoFormat('480p')).toContain('height<=480');
  });
  it('downloads original audio without transcoding', () => {
    const result = buildDownloadCommand({ ...request, kind: 'audio' }, settings(), paths);
    expect(result.args).toContain('ba');
    expect(result.args).not.toContain('-x');
  });
  it('builds m4a and mp3 extraction', () => {
    const m4a = settings(); m4a.audio.format = 'm4a';
    expect(buildDownloadCommand({ ...request, kind: 'audio' }, m4a, paths).args).toContain('m4a');
    const mp3 = settings(); mp3.audio.format = 'mp3'; mp3.audio.mp3Bitrate = 256;
    const args = buildDownloadCommand({ ...request, kind: 'audio' }, mp3, paths).args;
    expect(args).toContain('mp3'); expect(args).toContain('256K');
  });
  it('separates output folders when configured', () => {
    expect(outputDirectory(settings(), 'video')).toBe(`${process.env['HOME']}/Downloads/YouTube/Video`);
    const flat = settings(); flat.output.separateFolders = false;
    expect(outputDirectory(flat, 'audio')).toBe(`${process.env['HOME']}/Downloads/YouTube`);
  });
});
