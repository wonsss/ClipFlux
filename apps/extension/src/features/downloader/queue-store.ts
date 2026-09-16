import type { BrowserStartDownloadPayload, DownloadQueueTask, HelperMessage, StartDownloadPayload } from '@local-downloader/protocol';

const TERMINAL = new Set<DownloadQueueTask['status']>(['completed', 'failed']);

export class DownloadQueueStore {
  private readonly tasks = new Map<string, DownloadQueueTask>();

  public add(payload: BrowserStartDownloadPayload, now = Date.now()): StartDownloadPayload {
    const task: DownloadQueueTask = {
      taskId: payload.taskId,
      videoId: payload.videoId,
      kind: payload.kind,
      status: 'queued',
      createdAt: now,
      ...(payload.displayTitle === undefined ? {} : { title: payload.displayTitle }),
    };
    this.tasks.set(payload.taskId, task);
    this.prune();
    return { taskId: payload.taskId, videoId: payload.videoId, kind: payload.kind, url: payload.url };
  }

  public apply(event: HelperMessage): void {
    if (!('taskId' in event)) return;
    const task = this.tasks.get(event.taskId);
    if (task === undefined) return;
    if (event.type === 'download_queued') this.tasks.set(event.taskId, { ...task, status: 'queued', queuePosition: event.position });
    if (event.type === 'download_started') this.tasks.set(event.taskId, withoutPosition({ ...task, status: 'downloading', progress: 0 }));
    if (event.type === 'download_progress') this.tasks.set(event.taskId, { ...task, status: 'downloading', progress: event.percent });
    if (event.type === 'download_processing') this.tasks.set(event.taskId, withoutPosition({ ...task, status: 'processing', progress: 100 }));
    if (event.type === 'download_completed') this.tasks.set(event.taskId, withoutPosition({
      ...task,
      status: 'completed',
      progress: 100,
      finalFilePath: event.finalFilePath,
      fileName: event.fileName,
    }));
    if (event.type === 'download_failed') this.tasks.set(event.taskId, withoutPosition({ ...task, status: 'failed', error: event.reason }));
  }

  public snapshot(): DownloadQueueTask[] {
    return [...this.tasks.values()].sort((a, b) => {
      const rank = (task: DownloadQueueTask): number => task.status === 'downloading' || task.status === 'processing' ? 0 : task.status === 'queued' ? 1 : 2;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.status === 'queued' && b.status === 'queued') return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
      return b.createdAt - a.createdAt;
    });
  }

  public failActive(reason: string): void {
    for (const [taskId, task] of this.tasks) {
      if (!TERMINAL.has(task.status)) this.tasks.set(taskId, withoutPosition({ ...task, status: 'failed', error: reason }));
    }
  }

  public completedFile(taskId: string): string | undefined {
    const task = this.tasks.get(taskId);
    return task?.status === 'completed' ? task.finalFilePath : undefined;
  }

  private prune(): void {
    const completed = this.snapshot().filter((task) => TERMINAL.has(task.status));
    for (const task of completed.slice(12)) this.tasks.delete(task.taskId);
  }
}

function withoutPosition(task: DownloadQueueTask): DownloadQueueTask {
  const result = { ...task };
  delete result.queuePosition;
  return result;
}
