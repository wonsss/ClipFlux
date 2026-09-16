import { describe, expect, it } from 'vitest';
import { validateYouTubeUrl } from '../src/security/youtube-url';

describe('validateYouTubeUrl', () => {
  it('accepts and canonicalizes a watch URL', () => {
    expect(validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ',
    });
  });
  it('drops a playlist parameter to force one video', () => {
    expect(validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123').url).not.toContain('list');
  });
  it.each(['javascript:alert(1)', 'file:///tmp/a', 'http://localhost/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.test/watch?v=dQw4w9WgXcQ'])('rejects %s', (url) => {
    expect(() => validateYouTubeUrl(url)).toThrow();
  });
  it('rejects mismatched ids', () => {
    expect(() => validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'aaaaaaaaaaa')).toThrow();
  });
});
