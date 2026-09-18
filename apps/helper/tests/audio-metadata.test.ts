import { describe, expect, it } from 'vitest';
import {
  audioFileBaseName,
  normalizeAudioMetadata,
  parseInfoJson,
  sanitizeFileName,
} from '../src/downloader/audio-metadata';

describe('normalizeAudioMetadata', () => {
  it('prefers track/artist/album/release_year for official music uploads', () => {
    const metadata = normalizeAudioMetadata({
      title: 'Citizens! - True Romance',
      track: 'True Romance',
      artist: 'Citizens!',
      album: 'Here We Are',
      release_year: 2012,
      uploader: 'CitizensVEVO',
      channel: 'CitizensVEVO',
      upload_date: '20120601',
    }, 'fallback');
    expect(metadata).toEqual({
      title: 'True Romance',
      artist: 'Citizens!',
      album: 'Here We Are',
      albumArtist: 'Citizens!',
      year: '2012',
      genre: undefined,
    });
  });

  it('falls back to uploader/channel for regular uploads', () => {
    const metadata = normalizeAudioMetadata({
      title: 'My cool song cover',
      uploader: 'RandomUploader',
      channel: 'RandomUploader',
      upload_date: '20240115',
    }, 'fallback');
    expect(metadata.title).toBe('My cool song cover');
    expect(metadata.artist).toBe('RandomUploader');
    expect(metadata.albumArtist).toBe('RandomUploader');
    expect(metadata.album).toBe('My cool song cover');
    expect(metadata.year).toBe('2024');
  });

  it('prefers creator over uploader and channel over nothing', () => {
    expect(normalizeAudioMetadata({ creator: 'C', uploader: 'U' }, 'f').artist).toBe('C');
    expect(normalizeAudioMetadata({ channel: 'CH' }, 'f').artist).toBe('CH');
    expect(normalizeAudioMetadata({ channel: 'CH' }, 'f').albumArtist).toBeUndefined();
  });

  it('normalizes invalid values like NA, None, null, Various Artists and empty strings', () => {
    const metadata = normalizeAudioMetadata({
      title: 'Song',
      artist: 'NA',
      creator: 'None',
      uploader: 'RealUploader',
      album: 'Various Artists',
      genre: 'null',
    }, 'fallback');
    expect(metadata.artist).toBe('RealUploader');
    expect(metadata.album).toBe('Song');
    expect(metadata.genre).toBeUndefined();
  });

  it('skips empty-string fields to the next fallback', () => {
    const metadata = normalizeAudioMetadata({ title: 'T', artist: '  ', creator: 'X' }, 'f');
    expect(metadata.artist).toBe('X');
  });

  it('uses the fallback title when both track and title are missing', () => {
    expect(normalizeAudioMetadata({}, 'G1jQahN-Zcc').title).toBe('G1jQahN-Zcc');
  });

  it('derives the artist from "Artist - Title" when only a channel name exists', () => {
    const metadata = normalizeAudioMetadata({
      title: 'Citizens! - True Romance (Official Video)',
      uploader: 'CitizensVEVO',
      channel: 'CitizensVEVO',
    }, 'fallback');
    expect(metadata.artist).toBe('Citizens!');
    expect(metadata.title).toBe('True Romance');
    expect(metadata.albumArtist).toBe('Citizens!');
    expect(metadata.album).toBe('True Romance');
  });

  it('strips YouTube decorations but keeps meaningful parentheses', () => {
    expect(normalizeAudioMetadata({ title: 'Song (Official Lyric Video) [HD]' }, 'f').title).toBe('Song');
    expect(normalizeAudioMetadata({ title: 'Song (feat. Someone) (Live at Wembley)' }, 'f').title)
      .toBe('Song (feat. Someone) (Live at Wembley)');
    expect(normalizeAudioMetadata({ title: 'Song [M/V]' }, 'f').title).toBe('Song');
  });

  it('uses the parsed tail as title when the head matches the real artist', () => {
    const metadata = normalizeAudioMetadata({
      title: 'Citizens! - True Romance', artist: 'Citizens!',
    }, 'fallback');
    expect(metadata.artist).toBe('Citizens!');
    expect(metadata.title).toBe('True Romance');
  });

  it('keeps the full title when the head does not match a real artist field', () => {
    const metadata = normalizeAudioMetadata({
      title: 'Random Vlog - Day 3', artist: 'Someone Else',
    }, 'fallback');
    expect(metadata.artist).toBe('Someone Else');
    expect(metadata.title).toBe('Random Vlog - Day 3');
  });

  it('only splits on the first separator for multi-dash titles', () => {
    const metadata = normalizeAudioMetadata({ title: 'Artist - Title - Live Version' }, 'f');
    expect(metadata.artist).toBe('Artist');
    expect(metadata.title).toBe('Title - Live Version');
  });

  it('does not title-parse when a real track field exists', () => {
    const metadata = normalizeAudioMetadata({
      track: 'True Romance', title: 'Citizens! - True Romance', artist: 'Citizens!',
    }, 'fallback');
    expect(metadata.title).toBe('True Romance');
  });

  it('strips "- Topic" and "VEVO" channel suffixes from artist names', () => {
    expect(normalizeAudioMetadata({ title: 'Song', uploader: 'Citizens! - Topic' }, 'f').artist).toBe('Citizens!');
    expect(normalizeAudioMetadata({ title: 'Song', uploader: 'CitizensVEVO' }, 'f').artist).toBe('Citizens');
    expect(normalizeAudioMetadata({ title: 'Song', uploader: 'Topic' }, 'f').artist).toBe('Topic');
  });

  it('keeps track_number when present', () => {
    expect(normalizeAudioMetadata({ title: 'Song', track_number: 7 }, 'f').trackNumber).toBe('7');
    expect(normalizeAudioMetadata({ title: 'Song' }, 'f').trackNumber).toBeUndefined();
  });
});

describe('parseInfoJson', () => {
  it('returns an empty info object for invalid JSON', () => {
    expect(parseInfoJson('not json')).toEqual({});
    expect(parseInfoJson('[]')).toEqual({});
  });
  it('keeps only the fields it needs', () => {
    expect(parseInfoJson('{"title":"T","artist":"A","formats":[{}]}')).toMatchObject({ title: 'T', artist: 'A' });
  });
});

describe('sanitizeFileName', () => {
  it('removes characters that are unsafe on macOS', () => {
    expect(sanitizeFileName('AC/DC: Live <At> "Home"?')).toBe('AC DC Live At Home');
  });
  it('keeps exclamation marks and dashes', () => {
    expect(sanitizeFileName('Citizens! - True Romance')).toBe('Citizens! - True Romance');
  });
  it('trims dots and spaces and falls back when empty', () => {
    expect(sanitizeFileName(' . . ')).toBe('audio');
    expect(sanitizeFileName('.hidden')).toBe('hidden');
  });
});

describe('audioFileBaseName', () => {
  it('builds "Artist - Title" when an artist exists', () => {
    expect(audioFileBaseName({ title: 'True Romance', artist: 'Citizens!', album: undefined, albumArtist: undefined, year: undefined, genre: undefined, trackNumber: undefined }))
      .toBe('Citizens! - True Romance');
  });
  it('builds just the title without an artist', () => {
    expect(audioFileBaseName({ title: 'True Romance', artist: undefined, album: undefined, albumArtist: undefined, year: undefined, genre: undefined, trackNumber: undefined }))
      .toBe('True Romance');
  });
});
