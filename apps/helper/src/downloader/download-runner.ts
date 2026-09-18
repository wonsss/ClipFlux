import { mkdir, rm } from 'node:fs/promises';
import { basename } from 'node:path';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { HelperMessage, HelperSettings, StartDownloadPayload } from '@local-downloader/protocol';
import type { RuntimePaths } from '../runtime/paths';
import type { RuntimeManager } from '../runtime/runtime-manager';
import { buildDownloadCommand, type DownloadCommand } from './command-builder';
import { findStagedAudioFile, postprocessAudioFile, PostprocessCancelledError } from './audio-postprocess';
import { pathExists } from './file-utils';
import { findStagedVideoFile, postprocessVideoFile } from './video-postprocess';
import type { DownloadRegistry } from './download-registry';
import { parseProgressLine } from './progress-parser';

export type EventSink = (event: HelperMessage) => void;
type PendingTask = { request: StartDownloadPayload; settings: HelperSettings; sink: EventSink };

export class DownloadRunner {
  private readonly tasks = new Map<string, ChildProcessByStdio<null, Readable, Readable>>();
  private readonly activeRequests = new Map<string, StartDownloadPayload>();
  private readonly pending: PendingTask[] = [];
  private readonly cancellations = new Set<string>();

  public constructor(
    private readonly runtimeManager: RuntimeManager,
    private readonly maximumConcurrent = 2,
    private readonly maximumQueued = 20,
    private readonly registry?: DownloadRegistry,
  ) {}

  public has(taskId: string): boolean { return this.tasks.has(taskId) || this.pending.some((task) => task.request.taskId === taskId); }

  public start(request: StartDownloadPayload, settings: HelperSettings, sink: EventSink): Promise<void> {
    if (this.has(request.taskId)) throw new Error('Task already exists');
    const duplicate = [...this.activeRequests.values(), ...this.pending.map((task) => task.request)]
      .some((task) => task.videoId === request.videoId && task.kind === request.kind);
    if (duplicate) throw new Error('This download is already active');
    if (this.pending.length >= this.maximumQueued) throw new Error('Download queue is full');
    this.pending.push({ request, settings, sink });
    sink({ type: 'download_queued', taskId: request.taskId, kind: request.kind, videoId: request.videoId, position: this.pending.length });
    this.pump();
    return Promise.resolve();
  }

  private pump(): void {
    while (this.activeRequests.size < this.maximumConcurrent) {
      const next = this.pending.shift();
      if (next === undefined) break;
      void this.execute(next);
    }
    this.emitQueuePositions();
  }

  private emitQueuePositions(): void {
    this.pending.forEach(({ request, sink }, index) => {
      sink({ type: 'download_queued', taskId: request.taskId, kind: request.kind, videoId: request.videoId, position: index + 1 });
    });
  }

  private async execute({ request, settings, sink }: PendingTask): Promise<void> {
    this.activeRequests.set(request.taskId, request);
    try {
    const paths = await this.runtimeManager.effectivePaths();
    const command = buildDownloadCommand(request, settings, paths);
    await mkdir(command.outputDirectory, { recursive: true, mode: 0o700 });
    await mkdir(command.stagingDirectory, { recursive: true, mode: 0o700 });
    const child = spawn(command.executable, command.args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: false });
    this.tasks.set(request.taskId, child);
    sink({ type: 'download_started', taskId: request.taskId, kind: request.kind, videoId: request.videoId });

    let finalFilePath: string | undefined;
    let errorTail = '';
    let finished = false;
    const createConsumer = (captureError: boolean): ((chunk: Buffer) => void) => {
      let carry = '';
      return (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      if (captureError) errorTail = `${errorTail}${text}`.slice(-2000);
      const lines = `${carry}${text}`.split(/\r?\n/);
      carry = lines.pop() ?? '';
      for (const line of lines) {
        const event = parseProgressLine(line.trim());
        if (event?.type === 'progress') sink({
          type: 'download_progress', taskId: request.taskId, percent: event.percent,
          downloadedBytes: event.downloadedBytes, totalBytes: event.totalBytes,
          speedBytesPerSecond: event.speedBytesPerSecond, etaSeconds: event.etaSeconds,
        });
        if (event?.type === 'processing') sink({ type: 'download_processing', taskId: request.taskId });
        if (event?.type === 'completed') finalFilePath = event.finalFilePath;
      }
      };
    };
    child.stdout.on('data', createConsumer(false));
    child.stderr.on('data', createConsumer(true));
    child.once('error', (error) => {
      if (finished) return;
      finished = true;
      this.tasks.delete(request.taskId);
      this.activeRequests.delete(request.taskId);
      sink({ type: 'download_failed', taskId: request.taskId, reason: friendlyError(error.message) });
      this.pump();
    });
    child.once('close', (_code, signal) => {
      if (finished) return;
      finished = true;
      this.tasks.delete(request.taskId);
      void this.settle(request, paths, command, sink, finalFilePath, errorTail, signal)
        .finally(() => {
          this.activeRequests.delete(request.taskId);
          this.cancellations.delete(request.taskId);
          void rm(command.stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
          this.pump();
        });
    });
    } catch (error) {
      this.activeRequests.delete(request.taskId);
      sink({ type: 'download_failed', taskId: request.taskId, reason: friendlyError(error instanceof Error ? error.message : '') });
      this.pump();
    }
  }

  // yt-dlp exits non-zero when a postprocessor (metadata/thumbnail embedding)
  // fails even though the media file was produced; a staged file is therefore
  // still finalized regardless of the exit code.
  private async settle(
    request: StartDownloadPayload,
    paths: RuntimePaths,
    command: DownloadCommand,
    sink: EventSink,
    reportedPath: string | undefined,
    errorTail: string,
    signal: NodeJS.Signals | null,
  ): Promise<void> {
    if (signal !== null) {
      sink({ type: 'download_failed', taskId: request.taskId, reason: 'Download cancelled' });
      return;
    }
    const staged = reportedPath !== undefined && (await pathExists(reportedPath))
      ? reportedPath
      : request.kind === 'audio'
        ? await findStagedAudioFile(command.stagingDirectory)
        : await findStagedVideoFile(command.stagingDirectory);
    if (staged === undefined) {
      sink({ type: 'download_failed', taskId: request.taskId, reason: friendlyError(errorTail) });
      return;
    }
    sink({ type: 'download_processing', taskId: request.taskId });
    try {
      const finalFilePath = request.kind === 'audio'
        ? (await postprocessAudioFile({
            inputPath: staged,
            stagingDirectory: command.stagingDirectory,
            outputDirectory: command.outputDirectory,
            videoId: request.videoId,
            ffmpeg: paths.ffmpeg,
            ffprobe: paths.ffprobe,
            ...(this.registry !== undefined ? { registry: this.registry } : {}),
            log: (message) => process.stderr.write(`[helper] audio postprocess ${request.taskId}: ${message}\n`),
            onProcess: (child) => {
              this.tasks.set(request.taskId, child);
              child.once('close', () => this.tasks.delete(request.taskId));
            },
            isCancelled: () => this.cancellations.has(request.taskId),
          })).finalFilePath
        : (await postprocessVideoFile({
            inputPath: staged,
            stagingDirectory: command.stagingDirectory,
            outputDirectory: command.outputDirectory,
            videoId: request.videoId,
            ...(this.registry !== undefined ? { registry: this.registry } : {}),
          })).finalFilePath;
      sink({ type: 'download_completed', taskId: request.taskId, kind: request.kind, videoId: request.videoId, finalFilePath, fileName: basename(finalFilePath) });
    } catch (error) {
      if (error instanceof PostprocessCancelledError || this.cancellations.has(request.taskId)) {
        sink({ type: 'download_failed', taskId: request.taskId, reason: 'Download cancelled' });
      } else {
        sink({ type: 'download_failed', taskId: request.taskId, reason: friendlyError(error instanceof Error ? error.message : errorTail) });
      }
    }
  }

  public cancel(taskId: string): boolean {
    const pendingIndex = this.pending.findIndex((task) => task.request.taskId === taskId);
    if (pendingIndex >= 0) {
      const [task] = this.pending.splice(pendingIndex, 1);
      if (task !== undefined) task.sink({ type: 'download_failed', taskId, reason: 'Download cancelled' });
      this.emitQueuePositions();
      return true;
    }
    const child = this.tasks.get(taskId);
    if (child === undefined) return false;
    this.cancellations.add(taskId);
    child.kill('SIGTERM');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 3000);
    child.once('close', () => { clearTimeout(timer); });
    return true;
  }

  public stopAll(): void {
    for (const child of this.tasks.values()) child.kill('SIGTERM');
    for (const task of this.pending.splice(0)) task.sink({ type: 'download_failed', taskId: task.request.taskId, reason: 'Download cancelled' });
  }
}

function friendlyError(detail: string): string {
  if (/private|unavailable|sign in/i.test(detail)) return 'This video is unavailable or requires access';
  if (/network|unable to download|timed? out/i.test(detail)) return 'Network error while downloading';
  return 'Download failed. Check the helper log for details.';
}
