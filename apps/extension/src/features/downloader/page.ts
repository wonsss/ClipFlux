const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function currentVideoId(url = window.location.href): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.youtube.com' || parsed.pathname !== '/watch') return null;
    const id = parsed.searchParams.get('v');
    return id !== null && VIDEO_ID_PATTERN.test(id) ? id : null;
  } catch { return null; }
}

export function findControlAnchor(root: ParentNode = document): Element | null {
  const selectors = [
    'ytd-watch-metadata #actions-inner',
    'ytd-watch-metadata #top-row',
    'ytd-watch-metadata #title',
    '#info-contents ytd-video-primary-info-renderer #info',
  ];
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (node !== null) return node;
  }
  return null;
}

export function hasControls(root: ParentNode = document): boolean {
  return root.querySelector('[data-local-downloader-controls="true"]') !== null;
}

export function ensureControlsMount(anchor: Element, root: ParentNode = document): HTMLDivElement {
  const existing = root.querySelector<HTMLDivElement>('[data-local-downloader-mount="true"]');
  if (existing !== null) return existing;
  const container = document.createElement('div');
  container.dataset['localDownloaderMount'] = 'true';
  anchor.insertAdjacentElement('afterend', container);
  return container;
}
