import type { DownloadHistoryEntry, DownloadKind, ExtensionSettings, HelperMessage } from '@local-downloader/protocol';
import { currentVideoId } from './page';

const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'yt-lockup-view-model',
].join(',');
const THUMBNAIL_SELECTOR = [
  'a#thumbnail[href*="/watch?v="]',
  'a.yt-lockup-view-model__content-image[href*="/watch?v="]',
  'a.ytLockupViewModelContentImage[href*="/watch?v="]',
].join(',');
const VIDEO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3"/></svg>';
const AUDIO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6.5L19 4v11"/><path d="M9 15.5c-3.5-.7-5.5.6-5.5 2.4 0 1.5 1.5 2.5 3.4 2.1 1.3-.3 2.1-1.2 2.1-2.5m10-5c-3.5-.7-5.5.6-5.5 2.4 0 1.5 1.5 2.5 3.4 2.1 1.3-.3 2.1-1.2 2.1-2.5"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';

export class ThumbnailInjector {
  private readonly taskButtons = new Map<string, HTMLButtonElement>();
  private readonly buttonsByDownload = new Map<string, Set<HTMLButtonElement>>();
  private readonly downloaded = new Set<string>();

  public constructor(private readonly onSetupRequired: () => void) {
    chrome.runtime.onMessage.addListener((raw: unknown) => this.onNativeEvent(raw));
    void chrome.runtime.sendMessage({ type: 'get_download_history' }).then((history: DownloadHistoryEntry[]) => {
      for (const entry of history) this.downloaded.add(this.downloadKey(entry.videoId, entry.kind));
      for (const [key, buttons] of this.buttonsByDownload) {
        if (this.downloaded.has(key)) for (const button of buttons) this.markDownloaded(button);
      }
    }).catch(() => undefined);
  }

  public inject(settings: ExtensionSettings, root: ParentNode = document): void {
    this.pruneDisconnectedButtons();
    if (!settings.enabled) {
      for (const actions of document.querySelectorAll<HTMLElement>('[data-local-downloader-thumbnail-actions="true"]')) actions.hidden = true;
      return;
    }
    for (const card of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
      const link = this.thumbnailLinkFor(card);
      if (link === null) continue;
      const videoId = currentVideoId(new URL(link.href, window.location.origin).toString());
      if (videoId === null) continue;
      const existing = card.querySelector<HTMLElement>('[data-local-downloader-thumbnail-actions="true"]');
      if (existing !== null) {
        existing.hidden = false;
        const host = this.thumbnailHostFor(link);
        if (host !== null && existing.parentElement !== host) {
          existing.className = 'ld-thumbnail-actions';
          host.classList.add('ld-thumbnail-host');
          host.append(existing);
        }
        this.applyVisibility(existing, settings);
        continue;
      }
      const actions = document.createElement('div');
      actions.dataset['localDownloaderThumbnailActions'] = 'true';
      actions.className = 'ld-thumbnail-actions';
      const title = this.titleFor(card);
      actions.append(this.button('video', videoId, title), this.button('audio', videoId, title));
      const host = this.thumbnailHostFor(link);
      if (host === null) continue;
      host.classList.add('ld-thumbnail-host');
      host.append(actions);
      this.applyVisibility(actions, settings);
    }
  }

  private button(kind: DownloadKind, videoId: string, title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ld-thumbnail-button ld-thumbnail-button--${kind}`;
    button.dataset['kind'] = kind;
    button.dataset['videoId'] = videoId;
    button.dataset['displayTitle'] = title;
    button.innerHTML = kind === 'video' ? VIDEO_ICON : AUDIO_ICON;
    button.setAttribute('aria-label', `${title} ${kind === 'video' ? '비디오' : '오디오'} 다운로드`);
    button.title = kind === 'video' ? '비디오 다운로드' : '오디오 다운로드';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset['state'] === 'busy') return;
      const taskId = crypto.randomUUID();
      button.dataset['state'] = 'busy';
      button.innerHTML = kind === 'video' ? VIDEO_ICON : AUDIO_ICON;
      button.setAttribute('aria-busy', 'true');
      button.style.setProperty('--ld-progress', '0');
      this.taskButtons.set(taskId, button);
      void chrome.runtime.sendMessage({
        type: 'start_download',
        payload: { taskId, videoId, kind, displayTitle: title, url: `https://www.youtube.com/watch?v=${videoId}` },
      }).catch(() => { this.onSetupRequired(); this.fail(button, taskId, 'Downloader setup required'); });
    });
    const key = this.downloadKey(videoId, kind);
    const matchingButtons = this.buttonsByDownload.get(key) ?? new Set<HTMLButtonElement>();
    matchingButtons.add(button);
    this.buttonsByDownload.set(key, matchingButtons);
    if (this.downloaded.has(key)) this.markDownloaded(button);
    return button;
  }

  private onNativeEvent(raw: unknown): void {
    const message = raw as { type?: string; event?: HelperMessage };
    if (message.type !== 'native_event' || message.event === undefined) return;
    const event = message.event;
    if (event.type === 'error' && event.code === 'NATIVE_UNAVAILABLE') { this.onSetupRequired(); return; }
    if (!('taskId' in event)) return;
    if (event.type === 'download_completed') {
      const key = this.downloadKey(event.videoId, event.kind);
      this.downloaded.add(key);
      for (const matchingButton of this.buttonsByDownload.get(key) ?? []) this.markDownloaded(matchingButton);
      this.taskButtons.delete(event.taskId);
      return;
    }
    const button = this.taskButtons.get(event.taskId);
    if (button === undefined) return;
    if (event.type === 'download_queued') button.title = `대기열 ${event.position}번째`;
    if (event.type === 'download_progress') button.style.setProperty('--ld-progress', `${(event.percent ?? 0) / 100}`);
    if (event.type === 'download_processing') { button.dataset['state'] = 'processing'; button.title = '처리 중'; }
    if (event.type === 'download_failed') this.fail(button, event.taskId, event.reason);
  }

  private fail(button: HTMLButtonElement, taskId: string, reason: string): void {
    button.dataset['state'] = 'failed';
    button.title = reason;
    button.removeAttribute('aria-busy');
    this.taskButtons.delete(taskId);
  }

  private markDownloaded(button: HTMLButtonElement): void {
    const kind = button.dataset['kind'] as DownloadKind;
    const title = kind === 'video' ? '비디오' : '오디오';
    const displayTitle = button.dataset['displayTitle'] ?? 'YouTube 영상';
    button.dataset['state'] = 'complete';
    button.innerHTML = CHECK_ICON;
    button.title = '이미 다운로드됨 · 다시 다운로드';
    button.setAttribute('aria-label', `${displayTitle} ${title} 이미 다운로드됨. 다시 다운로드`);
    button.removeAttribute('aria-busy');
    button.style.removeProperty('--ld-progress');
  }

  private downloadKey(videoId: string, kind: DownloadKind): string {
    return `${videoId}:${kind}`;
  }

  private pruneDisconnectedButtons(): void {
    for (const [key, buttons] of this.buttonsByDownload) {
      for (const button of buttons) if (!button.isConnected) buttons.delete(button);
      if (buttons.size === 0) this.buttonsByDownload.delete(key);
    }
  }

  private applyVisibility(actions: HTMLElement, settings: ExtensionSettings): void {
    actions.hidden = !settings.enabled;
    const video = actions.querySelector<HTMLElement>('[data-kind="video"]');
    const audio = actions.querySelector<HTMLElement>('[data-kind="audio"]');
    if (video !== null) video.hidden = !settings.showVideoButton;
    if (audio !== null) audio.hidden = !settings.showAudioButton;
  }

  private thumbnailLinkFor(card: HTMLElement): HTMLAnchorElement | null {
    const thumbnail = card.querySelector<HTMLElement>('yt-thumbnail-view-model, ytd-thumbnail');
    const wrappingLink = thumbnail?.closest<HTMLAnchorElement>('a[href*="/watch?v="]');
    if (wrappingLink !== null && wrappingLink !== undefined) return wrappingLink;

    const nestedLink = thumbnail?.querySelector<HTMLAnchorElement>('a[href*="/watch?v="]');
    return nestedLink ?? card.querySelector<HTMLAnchorElement>(THUMBNAIL_SELECTOR);
  }

  private thumbnailHostFor(link: HTMLAnchorElement): HTMLElement | null {
    const nestedThumbnail = link.querySelector<HTMLElement>('ytd-thumbnail, yt-thumbnail-view-model');
    if (nestedThumbnail !== null) return nestedThumbnail;
    const ancestor = link.closest<HTMLElement>('ytd-thumbnail, yt-thumbnail-view-model');
    if (ancestor !== null) return ancestor;
    return link;
  }

  private titleFor(card: HTMLElement): string {
    const title = card.querySelector<HTMLElement>('#video-title, .yt-lockup-metadata-view-model__title, .ytLockupMetadataViewModelTitle, h3');
    return title?.textContent.trim() || 'YouTube 영상';
  }
}
