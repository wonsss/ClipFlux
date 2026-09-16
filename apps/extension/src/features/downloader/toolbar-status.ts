import type { DownloadQueueTask, HelperMessage } from '@local-downloader/protocol';

const ACTIVE_STATUSES = new Set<DownloadQueueTask['status']>(['queued', 'downloading', 'processing']);

export class ToolbarStatus {
  private completedCount = 0;

  public apply(event: HelperMessage): void {
    if (event.type === 'download_completed') this.completedCount += 1;
  }

  public resetCompletedCount(): void {
    this.completedCount = 0;
  }

  public snapshot(tasks: DownloadQueueTask[]): { active: boolean; completedCount: number } {
    return {
      active: tasks.some((task) => ACTIVE_STATUSES.has(task.status)),
      completedCount: this.completedCount,
    };
  }
}

export async function renderToolbarStatus(state: { active: boolean; completedCount: number }): Promise<void> {
  const icon = Object.fromEntries([16, 32].map((size) => [size, drawIcon(size, state.active)]));
  const badge = state.completedCount === 0 ? '' : state.completedCount > 99 ? '99+' : String(state.completedCount);
  await Promise.all([
    chrome.action.setIcon({ imageData: icon }),
    chrome.action.setBadgeText({ text: badge }),
    chrome.action.setBadgeBackgroundColor({ color: '#137333' }),
    chrome.action.setBadgeTextColor({ color: '#ffffff' }),
    chrome.action.setTitle({ title: state.active ? 'ClipFlux · 다운로드 중' : 'ClipFlux' }),
  ]);
}

function drawIcon(size: number, active: boolean): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Unable to render extension icon');
  const scale = size / 32;
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.fillStyle = active ? '#df3935' : '#ff5349';
  context.beginPath();
  context.roundRect(2, 2, 28, 28, 8);
  context.fill();
  context.fillStyle = '#ffffff';
  context.fillRect(14, 6.5, 4, 12);
  context.beginPath();
  context.moveTo(8.8, 15.5);
  context.lineTo(12, 12.3);
  context.lineTo(16, 16.3);
  context.lineTo(20, 12.3);
  context.lineTo(23.2, 15.5);
  context.lineTo(16, 22.5);
  context.closePath();
  context.fill();
  context.beginPath();
  context.roundRect(10, 24, 12, 3, 1.5);
  context.fill();
  if (active) {
    context.fillStyle = '#ffd8d4';
    context.beginPath();
    context.arc(25, 7, 2, 0, Math.PI * 2);
    context.fill();
  }
  return context.getImageData(0, 0, size, size);
}
