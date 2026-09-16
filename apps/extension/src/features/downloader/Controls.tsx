import { useEffect, useState } from 'react';
import type { DownloadHistoryEntry, DownloadKind, DownloadStatus, HelperMessage } from '@local-downloader/protocol';
import { AudioDownloadIcon, CheckIcon, VideoDownloadIcon } from './icons';

type TaskState = { taskId: string; status: DownloadStatus; percent?: number; position?: number; error?: string };
type Props = { videoId: string; displayTitle: string; showVideo: boolean; showAudio: boolean; onSetupRequired: () => void };

function label(kind: DownloadKind, task: TaskState | undefined, saved: boolean): string {
  const idle = kind === 'video' ? 'Video' : 'Audio';
  if (task === undefined || task.status === 'idle') return saved ? `${idle} saved` : idle;
  if (task.status === 'queued') return task.position === undefined ? 'Queued' : `Queued · ${task.position}`;
  if (task.status === 'downloading') return `${Math.round(task.percent ?? 0)}%`;
  if (task.status === 'processing') return 'Processing…';
  if (task.status === 'completed') return kind === 'video' ? 'Video saved' : 'Audio saved';
  return 'Retry';
}

export function Controls({ videoId, displayTitle, showVideo, showAudio, onSetupRequired }: Props) {
  const [tasks, setTasks] = useState<Partial<Record<DownloadKind, TaskState>>>({});
  const [saved, setSaved] = useState<Partial<Record<DownloadKind, boolean>>>({});

  useEffect(() => {
    let active = true;
    setTasks({});
    setSaved({});
    void chrome.runtime.sendMessage({ type: 'get_download_history' }).then((history: DownloadHistoryEntry[]) => {
      if (!active) return;
      setSaved({
        video: history.some((entry) => entry.videoId === videoId && entry.kind === 'video'),
        audio: history.some((entry) => entry.videoId === videoId && entry.kind === 'audio'),
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [videoId]);

  useEffect(() => {
    const listener = (raw: unknown): void => {
      const message = raw as { type?: string; event?: HelperMessage };
      if (message.type !== 'native_event' || message.event === undefined) return;
      const event = message.event;
      if (event.type === 'error' && event.code === 'NATIVE_UNAVAILABLE') { onSetupRequired(); return; }
      if (!('taskId' in event)) return;
      if (event.type === 'download_completed' && event.videoId === videoId) {
        setSaved((currentSaved) => ({ ...currentSaved, [event.kind]: true }));
      }
      setTasks((current) => {
        const entry = Object.entries(current).find(([, task]) => task.taskId === event.taskId);
        if (entry === undefined) return current;
        const kind = entry[0] as DownloadKind;
        if (event.type === 'download_queued') return { ...current, [kind]: { ...current[kind], status: 'queued', position: event.position } };
        if (event.type === 'download_started') return { ...current, [kind]: { ...current[kind], status: 'downloading', position: undefined } };
        if (event.type === 'download_progress') return { ...current, [kind]: { ...current[kind], status: 'downloading', percent: event.percent ?? 0 } };
        if (event.type === 'download_processing') return { ...current, [kind]: { ...current[kind], status: 'processing' } };
        if (event.type === 'download_failed') return { ...current, [kind]: { ...current[kind], status: 'failed', error: event.reason } };
        return { ...current, [kind]: { ...current[kind], status: 'completed' } };
      });
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [onSetupRequired, videoId]);

  const start = (kind: DownloadKind): void => {
    const active = tasks[kind];
    if (active !== undefined && !['failed', 'completed'].includes(active.status)) return;
    const taskId = crypto.randomUUID();
    setTasks((current) => ({ ...current, [kind]: { taskId, status: 'queued' } }));
    void chrome.runtime.sendMessage({
      type: 'start_download',
      payload: { taskId, videoId, kind, displayTitle, url: `https://www.youtube.com/watch?v=${videoId}` },
    }).catch(() => { onSetupRequired(); setTasks((current) => ({ ...current, [kind]: { taskId, status: 'failed', error: 'Downloader setup required' } })); });
  };

  const button = (kind: DownloadKind) => {
    const task = tasks[kind];
    const busy = task !== undefined && ['queued', 'downloading', 'processing'].includes(task.status);
    const isSaved = saved[kind] === true;
    const complete = task?.status === 'completed' || (task === undefined && isSaved);
    const icon = complete ? <CheckIcon /> : kind === 'video' ? <VideoDownloadIcon /> : <AudioDownloadIcon />;
    const actionLabel = kind === 'video' ? '비디오' : '오디오';
    return <button className={`ld-button ld-button--${kind}`} data-state={complete ? 'completed' : task?.status ?? 'idle'} style={{ '--ld-progress': (task?.percent ?? 0) / 100 } as React.CSSProperties} aria-label={complete ? `${actionLabel} 이미 다운로드됨. 다시 다운로드` : `${actionLabel} 다운로드`} aria-live="polite" aria-busy={busy} disabled={busy} title={task?.error ?? (complete ? '이미 다운로드됨 · 다시 다운로드' : undefined)} onClick={() => start(kind)}>{icon}<span>{label(kind, task, isSaved)}</span></button>;
  };

  return <div className="ld-controls" data-local-downloader-controls="true">{showVideo && button('video')}{showAudio && button('audio')}</div>;
}
