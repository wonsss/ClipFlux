import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildFfmpegArgs,
  findStagedAudioFile,
  postprocessAudioFile,
} from '../src/downloader/audio-postprocess';
import { chooseTargetFileName } from '../src/downloader/file-utils';
import { DownloadRegistry } from '../src/downloader/download-registry';
import type { AudioMetadata } from '../src/downloader/audio-metadata';

const metadata: AudioMetadata = {
  title: 'True Romance',
  artist: 'Citizens!',
  album: 'Here We Are',
  albumArtist: 'Citizens!',
  year: '2012',
  genre: undefined,
  trackNumber: '7',
};

async function fakeRuntime(directory: string, ffprobeTags: Record<string, string> = {}): Promise<{ ffmpeg: string; ffprobe: string }> {
  const ffmpeg = join(directory, 'fake-ffmpeg.js');
  const ffprobe = join(directory, 'fake-ffprobe.js');
  await writeFile(ffmpeg, `#!${process.execPath}\nconst { copyFileSync } = require('node:fs');\nconst args = process.argv.slice(2);\ncopyFileSync(args[args.indexOf('-i') + 1], args[args.length - 1]);\n`);
  await writeFile(ffprobe, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify({ format: { tags: ffprobeTags }, streams: [{ codec_type: 'audio' }] }))});\n`);
  await chmod(ffmpeg, 0o755);
  await chmod(ffprobe, 0o755);
  return { ffmpeg, ffprobe };
}

async function stagedAudio(directory: string): Promise<string> {
  const staging = join(directory, 'staging');
  await mkdir(staging, { recursive: true });
  await writeFile(join(staging, 'audio.mp3'), 'fake audio bytes');
  await writeFile(join(staging, 'audio.info.json'), JSON.stringify({
    track: 'True Romance', artist: 'Citizens!', album: 'Here We Are', release_year: 2012,
  }));
  await writeFile(join(staging, 'audio.jpg'), 'fake image');
  return staging;
}

describe('buildFfmpegArgs', () => {
  it('stream-copies audio and attaches the thumbnail as artwork', () => {
    const args = buildFfmpegArgs('in.mp3', 'cover.jpg', 'out.mp3', metadata, 'G1jQahN-Zcc');
    expect(args).toContain('-c:a'); expect(args).toContain('copy');
    expect(args).toContain('-map'); expect(args).toContain('1:v');
    expect(args).toContain('attached_pic');
    expect(args).toContain('title=True Romance');
    expect(args).toContain('artist=Citizens!');
    expect(args).toContain('album_artist=Citizens!');
    expect(args).toContain('date=2012');
    expect(args).not.toContain('genre=');
    expect(args).toContain('-id3v2_version');
  });
  it('omits artwork mapping without a thumbnail and keeps any embedded art', () => {
    const args = buildFfmpegArgs('in.m4a', undefined, 'out.m4a', metadata, 'G1jQahN-Zcc');
    expect(args).toContain('0:v?');
    expect(args).not.toContain('attached_pic');
    expect(args).not.toContain('-id3v2_version');
  });
  it('crops thumbnails to a centered square for Music.app', () => {
    const args = buildFfmpegArgs('in.mp3', 'cover.webp', 'out.mp3', metadata, 'G1jQahN-Zcc');
    const codecIndex = args.indexOf('-c:v');
    expect(args[codecIndex + 1]).toBe('mjpeg');
    expect(args).toContain("crop='min(iw,ih)':'min(iw,ih)'");
  });
});

describe('chooseTargetFileName', () => {
  it('reuses the previous file name for a re-download of the same video', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'target-test-'));
    await writeFile(join(directory, 'Citizens! - True Romance.mp3'), 'old');
    const target = await chooseTargetFileName(directory, 'Citizens! - True Romance', 'mp3', 'Citizens! - True Romance.mp3');
    expect(target).toEqual({ fileName: 'Citizens! - True Romance.mp3', obsoletePath: undefined });
  });
  it('marks the previous file obsolete when the desired name changed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'target-test-'));
    await writeFile(join(directory, 'Old Name.mp3'), 'old');
    const target = await chooseTargetFileName(directory, 'New Name', 'mp3', 'Old Name.mp3');
    expect(target.fileName).toBe('New Name.mp3');
    expect(target.obsoletePath).toBe(join(directory, 'Old Name.mp3'));
  });
  it('adds a suffix when an unrelated file already uses the desired name', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'target-test-'));
    await writeFile(join(directory, 'Citizens! - True Romance.mp3'), 'other');
    const target = await chooseTargetFileName(directory, 'Citizens! - True Romance', 'mp3', undefined);
    expect(target.fileName).toBe('Citizens! - True Romance (2).mp3');
  });
});

describe('postprocessAudioFile', () => {
  it('tags, embeds artwork, and moves the file to the output folder', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postprocess-test-'));
    const staging = await stagedAudio(directory);
    const outputDirectory = join(directory, 'Audio');
    await mkdir(outputDirectory, { recursive: true });
    const runtime = await fakeRuntime(directory, {
      title: 'True Romance', artist: 'Citizens!', album: 'Here We Are', album_artist: 'Citizens!', date: '2012',
    });
    const registry = new DownloadRegistry(join(directory, 'downloads.json'));
    const result = await postprocessAudioFile({
      inputPath: join(staging, 'audio.mp3'),
      stagingDirectory: staging,
      outputDirectory,
      videoId: 'G1jQahN-Zcc',
      ...runtime,
      registry,
    });
    expect(result.finalFilePath).toBe(join(outputDirectory, 'Citizens! - True Romance.mp3'));
    expect(result.metadataWritten).toBe(true);
    expect(result.verified).toBe(true);
    expect(await readFile(result.finalFilePath, 'utf8')).toBe('fake audio bytes');
  });

  it('overwrites the previous file on re-download instead of duplicating', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postprocess-test-'));
    const staging = await stagedAudio(directory);
    const outputDirectory = join(directory, 'Audio');
    await mkdir(outputDirectory, { recursive: true });
    const runtime = await fakeRuntime(directory);
    const registry = new DownloadRegistry(join(directory, 'downloads.json'));
    const options = { inputPath: join(staging, 'audio.mp3'), stagingDirectory: staging, outputDirectory, videoId: 'G1jQahN-Zcc', ...runtime, registry };
    const first = await postprocessAudioFile(options);
    const second = await postprocessAudioFile(options);
    expect(second.finalFilePath).toBe(first.finalFilePath);
  });

  it('still delivers the audio file when ffmpeg fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postprocess-test-'));
    const staging = await stagedAudio(directory);
    const outputDirectory = join(directory, 'Audio');
    await mkdir(outputDirectory, { recursive: true });
    const runtime = await fakeRuntime(directory);
    const failing = join(directory, 'failing-ffmpeg.js');
    await writeFile(failing, `#!${process.execPath}\nprocess.stderr.write('boom');\nprocess.exit(1);\n`);
    await chmod(failing, 0o755);
    const result = await postprocessAudioFile({
      inputPath: join(staging, 'audio.mp3'),
      stagingDirectory: staging,
      outputDirectory,
      videoId: 'G1jQahN-Zcc',
      ffmpeg: failing,
      ffprobe: runtime.ffprobe,
    });
    expect(result.metadataWritten).toBe(false);
    expect(result.finalFilePath).toBe(join(outputDirectory, 'Citizens! - True Romance.mp3'));
    expect(await readFile(result.finalFilePath, 'utf8')).toBe('fake audio bytes');
  });

  it('aborts without moving the file when cancelled', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postprocess-test-'));
    const staging = await stagedAudio(directory);
    const outputDirectory = join(directory, 'Audio');
    await mkdir(outputDirectory, { recursive: true });
    const runtime = await fakeRuntime(directory);
    await expect(postprocessAudioFile({
      inputPath: join(staging, 'audio.mp3'),
      stagingDirectory: staging,
      outputDirectory,
      videoId: 'G1jQahN-Zcc',
      ...runtime,
      isCancelled: () => true,
    })).rejects.toThrow('Download cancelled');
    expect(await findStagedAudioFile(staging)).toBe(join(staging, 'audio.mp3'));
  });

  it('finds the staged audio file by name when the path is unknown', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postprocess-test-'));
    const staging = await stagedAudio(directory);
    expect(await findStagedAudioFile(staging)).toBe(join(staging, 'audio.mp3'));
    expect(await findStagedAudioFile(join(directory, 'missing'))).toBeUndefined();
  });
});
