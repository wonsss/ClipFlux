import { describe, expect, it } from 'vitest';
import { parseProgressLine } from '../src/downloader/progress-parser';

describe('parseProgressLine', () => {
  it('parses normal progress', () => {
    expect(parseProgressLine('LOCAL_DOWNLOADER_PROGRESS|50|100|NA|10|5')).toEqual({ type: 'progress', downloadedBytes: 50, totalBytes: 100, speedBytesPerSecond: 10, etaSeconds: 5, percent: 50 });
  });
  it('uses estimated total and tolerates unknown values', () => {
    expect(parseProgressLine('LOCAL_DOWNLOADER_PROGRESS|50|NA|200|NA|NA')).toMatchObject({ totalBytes: 200, percent: 25, speedBytesPerSecond: null });
  });
  it('parses processing and completion', () => {
    expect(parseProgressLine('LOCAL_DOWNLOADER_PROCESSING|id')).toEqual({ type: 'processing' });
    expect(parseProgressLine('LOCAL_DOWNLOADER_COMPLETE|/tmp/file.mp4')).toEqual({ type: 'completed', finalFilePath: '/tmp/file.mp4' });
  });
  it('ignores unrelated and error lines', () => expect(parseProgressLine('ERROR: unavailable')).toBeNull());
});
