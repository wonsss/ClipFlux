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
  it('builds m4a and mp3 extraction', () => {
    const m4a = settings(); m4a.audio.format = 'm4a';
    const m4aArgs = buildDownloadCommand({ ...request, kind: 'audio' }, m4a, paths).args;
    expect(m4aArgs).toContain('ba[ext=m4a]/ba');
    expect(m4aArgs).toContain('m4a');
    const mp3 = settings(); mp3.audio.format = 'mp3'; mp3.audio.mp3Bitrate = 256;
    const args = buildDownloadCommand({ ...request, kind: 'audio' }, mp3, paths).args;
    expect(args).toContain('mp3'); expect(args).toContain('256K');
  });
  it('stages audio downloads outside the output folder and embeds metadata', () => {
    const result = buildDownloadCommand({ ...request, kind: 'audio' }, settings(), paths);
    expect(result.stagingDirectory).toContain('staging');
    expect(result.stagingDirectory).not.toContain('Downloads');
    expect(result.args).toContain('--embed-metadata');
    expect(result.args).toContain('--embed-thumbnail');
    expect(result.args).toContain('--write-info-json');
    expect(result.args).toContain('%(artist,creator,uploader,channel|)s:%(meta_artist)s');
    const outputIndex = result.args.indexOf('-o');
    expect(result.args[outputIndex + 1]).toContain('audio.%(ext)s');
  });
  it('stages video downloads too and embeds metadata and chapters', () => {
    const result = buildDownloadCommand(request, settings(), paths);
    expect(result.stagingDirectory).toContain('staging');
    expect(result.args).toContain('--embed-metadata');
    expect(result.args).toContain('--embed-chapters');
    expect(result.args).toContain('--write-info-json');
    expect(result.args).not.toContain('--embed-thumbnail');
    const outputIndex = result.args.indexOf('-o');
    expect(result.args[outputIndex + 1]).toContain('video.%(ext)s');
  });
  it('separates output folders when configured', () => {
    expect(outputDirectory(settings(), 'video')).toBe(`${process.env['HOME']}/Downloads/YouTube/Video`);
    const flat = settings(); flat.output.separateFolders = false;
    expect(outputDirectory(flat, 'audio')).toBe(`${process.env['HOME']}/Downloads/YouTube`);
  });
});
