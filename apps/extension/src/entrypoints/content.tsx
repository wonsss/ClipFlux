import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ExtensionSettings } from '@local-downloader/protocol';
import { Controls } from '../features/downloader/Controls';
import { currentVideoId, ensureControlsMount, findControlAnchor } from '../features/downloader/page';
import { installerUrl } from '../lib/installer';
import { ThumbnailInjector } from '../features/downloader/thumbnail-injector';
import '../assets/content.css';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let renderedVideoId: string | null = null;
    let settings: ExtensionSettings = { showVideoButton: true, showAudioButton: true };
    let scheduled = false;

    const setupToast = (): void => {
      if (document.querySelector('[data-local-downloader-toast]') !== null) return;
      const toast = document.createElement('div');
      toast.dataset['localDownloaderToast'] = 'true';
      toast.className = 'ld-toast';
      toast.innerHTML = '<span>Downloader setup required</span><button type="button">Install Downloader</button>';
      toast.querySelector('button')?.addEventListener('click', () => window.open(installerUrl(), '_blank', 'noopener'));
      document.body.append(toast);
      setTimeout(() => toast.remove(), 12000);
    };
    const thumbnails = new ThumbnailInjector(setupToast);

    const inject = (): void => {
      thumbnails.inject(settings);
      const videoId = currentVideoId();
      if (videoId === null) { root?.unmount(); container?.remove(); root = null; container = null; renderedVideoId = null; return; }
      const anchor = findControlAnchor();
      if (anchor === null) return;
      if (container === null || !container.isConnected) {
        container = ensureControlsMount(anchor);
        root = createRoot(container);
      }
      if (videoId !== renderedVideoId) renderedVideoId = videoId;
      const displayTitle = document.querySelector<HTMLElement>('ytd-watch-metadata h1, h1.ytd-watch-metadata')?.textContent.trim() || 'YouTube 영상';
      root?.render(<Controls videoId={videoId} displayTitle={displayTitle} showVideo={settings.showVideoButton} showAudio={settings.showAudioButton} onSetupRequired={setupToast} />);
    };

    const scheduleInject = (): void => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; inject(); });
    };

    void chrome.runtime.sendMessage({ type: 'get_extension_settings' }).then((value: ExtensionSettings) => { settings = value; inject(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || changes['extensionSettings'] === undefined) return;
      void chrome.runtime.sendMessage({ type: 'get_extension_settings' }).then((value: ExtensionSettings) => { settings = value; inject(); });
    });
    document.addEventListener('yt-navigate-finish', scheduleInject);
    const observer = new MutationObserver(scheduleInject);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    inject();
  },
});
