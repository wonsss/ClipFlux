// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserMessageSchema } from '@local-downloader/protocol';
import { ThumbnailInjector } from '../src/features/downloader/thumbnail-injector';

const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => Promise.resolve(
  (message as { type?: string }).type === 'get_download_history' ? [] : { accepted: true },
));
let runtimeListener: ((message: unknown) => void) | undefined;

describe('ThumbnailInjector', () => {
  beforeEach(() => {
    document.body.innerHTML = `<ytd-rich-item-renderer><ytd-thumbnail><a id="thumbnail" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></a></ytd-thumbnail><h3 id="video-title">A useful video</h3></ytd-rich-item-renderer>`;
    sendMessage.mockReset();
    sendMessage.mockImplementation((message) => Promise.resolve(
      (message as { type?: string }).type === 'get_download_history' ? [] : { accepted: true },
    ));
    runtimeListener = undefined;
    vi.stubGlobal('chrome', { runtime: { sendMessage, onMessage: { addListener: vi.fn((listener: (message: unknown) => void) => { runtimeListener = listener; }) } } });
  });

  it('adds video and audio actions exactly once', () => {
    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });
    injector.inject({ showVideoButton: true, showAudioButton: true });
    expect(document.querySelectorAll('[data-local-downloader-thumbnail-actions="true"]')).toHaveLength(1);
    expect(document.querySelectorAll('.ld-thumbnail-button')).toHaveLength(2);
  });

  it('honors visibility settings and sends a structured download', () => {
    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: false, showAudioButton: true });
    const video = document.querySelector<HTMLButtonElement>('[data-kind="video"]');
    const audio = document.querySelector<HTMLButtonElement>('[data-kind="audio"]');
    expect(video?.hidden).toBe(true);
    audio?.click();
    const startMessage = sendMessage.mock.calls.find(([message]) => (message as { type?: string }).type === 'start_download')?.[0];
    const parsed = BrowserMessageSchema.parse(startMessage);
    expect(parsed).toMatchObject({ type: 'start_download', payload: { videoId: 'dQw4w9WgXcQ', kind: 'audio', displayTitle: 'A useful video' } });
  });

  it('marks previously downloaded video and audio independently', async () => {
    sendMessage.mockImplementation((message) => Promise.resolve(
      (message as { type?: string }).type === 'get_download_history'
        ? [{ videoId: 'dQw4w9WgXcQ', kind: 'video', completedAt: 10 }]
        : { accepted: true },
    ));
    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLButtonElement>('[data-kind="video"]')?.dataset['state']).toBe('complete');
    });
    expect(document.querySelector<HTMLButtonElement>('[data-kind="video"]')?.title).toBe('이미 다운로드됨 · 다시 다운로드');
    expect(document.querySelector<HTMLButtonElement>('[data-kind="video"]')?.getAttribute('aria-label')).toContain('이미 다운로드됨');
    expect(document.querySelector<HTMLButtonElement>('[data-kind="audio"]')?.dataset['state']).toBeUndefined();
  });

  it('updates every matching card when the same video completes elsewhere', () => {
    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    runtimeListener?.({
      type: 'native_event',
      event: {
        type: 'download_completed',
        taskId: '00000000-0000-4000-8000-000000000001',
        videoId: 'dQw4w9WgXcQ',
        kind: 'video',
        finalFilePath: '/tmp/video.mp4',
        fileName: 'video.mp4',
      },
    });

    expect(document.querySelector<HTMLButtonElement>('[data-kind="video"]')?.dataset['state']).toBe('complete');
    expect(document.querySelector<HTMLButtonElement>('[data-kind="audio"]')?.dataset['state']).toBeUndefined();
  });

  it('supports the current YouTube lockup card markup', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ">
              <yt-thumbnail-view-model></yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost">
                <h3><a class="ytLockupMetadataViewModelTitle">Big Buck Bunny</a></h3>
                <div><span>조회수 100만회</span><span> · 4년 전</span></div>
              </yt-lockup-metadata-view-model>
            </div>
          </div>
        </yt-lockup-view-model>
      </ytd-rich-item-renderer>`;

    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    const host = document.querySelector('.ytLockupMetadataViewModelHost');
    expect(host?.classList.contains('ld-lockup-metadata-host')).toBe(true);
    expect(host?.lastElementChild?.classList.contains('ld-lockup-metadata-actions')).toBe(true);
    expect(host?.querySelectorAll('.ld-thumbnail-button')).toHaveLength(2);
    expect(host?.querySelector<HTMLButtonElement>('[data-kind="video"]')?.getAttribute('aria-label'))
      .toBe('Big Buck Bunny 비디오 다운로드');
  });

  it('places home-feed actions at the end of the metadata row', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <ytd-thumbnail><a id="thumbnail" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ"></a></ytd-thumbnail>
        <div class="ytLockupMetadataViewModelMetadata"><span>조회수 389만회</span><span> · 4년 전</span></div>
      </ytd-rich-item-renderer>`;

    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    const metadata = document.querySelector('.ytLockupMetadataViewModelMetadata');
    expect(metadata?.classList.contains('ld-card-metadata-host')).toBe(true);
    expect(metadata?.querySelectorAll('.ld-card-metadata-actions .ld-thumbnail-button')).toHaveLength(2);
  });

  it('finds a nested view-count label when anchoring home-feed actions', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <ytd-thumbnail><a id="thumbnail" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ"></a></ytd-thumbnail>
        <div class="metadata-row"><span><yt-attributed-string>조회수 389만회</yt-attributed-string></span><span> · 4년 전</span></div>
      </ytd-rich-item-renderer>`;

    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    const metadata = document.querySelector('.metadata-row');
    expect(metadata?.classList.contains('ld-card-metadata-host')).toBe(true);
  });

  it('places sidebar recommendation actions before the more menu', () => {
    document.body.innerHTML = `
      <ytd-watch-next-secondary-results-renderer>
        <ytd-compact-video-renderer>
          <ytd-thumbnail><a id="thumbnail" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ"></a></ytd-thumbnail>
          <div id="menu"><button class="more">…</button></div>
        </ytd-compact-video-renderer>
      </ytd-watch-next-secondary-results-renderer>`;

    const injector = new ThumbnailInjector(vi.fn());
    injector.inject({ showVideoButton: true, showAudioButton: true });

    const menu = document.querySelector('#menu');
    expect(menu?.classList.contains('ld-compact-menu-host')).toBe(true);
    expect(menu?.firstElementChild?.classList.contains('ld-compact-actions')).toBe(true);
    expect(menu?.querySelectorAll('.ld-compact-actions .ld-thumbnail-button')).toHaveLength(2);
  });
});
