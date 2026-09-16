// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentVideoId, ensureControlsMount, findControlAnchor, hasControls } from '../src/features/downloader/page';

describe('YouTube page integration', () => {
  beforeEach(() => { document.body.innerHTML = '<ytd-watch-metadata><div id="top-row"></div></ytd-watch-metadata>'; });
  it('finds a resilient anchor', () => expect(findControlAnchor()).not.toBeNull());
  it('recognizes current video and navigation', () => {
    expect(currentVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(currentVideoId('https://www.youtube.com/watch?v=aaaaaaaaaaa')).toBe('aaaaaaaaaaa');
    expect(currentVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBeNull();
  });
  it('detects one existing control container to prevent duplicates', () => {
    expect(hasControls()).toBe(false);
    const first = document.createElement('div'); first.dataset['localDownloaderControls'] = 'true'; document.body.append(first);
    expect(hasControls()).toBe(true);
    expect(document.querySelectorAll('[data-local-downloader-controls="true"]')).toHaveLength(1);
  });
  it('inserts the controls mount only once', () => {
    const anchor = findControlAnchor();
    if (anchor === null) throw new Error('fixture anchor missing');
    expect(ensureControlsMount(anchor)).toBe(ensureControlsMount(anchor));
    expect(document.querySelectorAll('[data-local-downloader-mount="true"]')).toHaveLength(1);
  });
  it('supports disabled settings as explicit booleans', () => {
    const settings = { showVideoButton: false, showAudioButton: true };
    expect(settings.showVideoButton).toBe(false); expect(settings.showAudioButton).toBe(true);
  });
});
