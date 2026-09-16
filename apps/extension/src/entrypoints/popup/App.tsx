import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_EXTENSION_SETTINGS, DEFAULT_HELPER_SETTINGS,
  type DownloadQueueTask, type ExtensionSettings, type HelperMessage, type HelperSettings, type RuntimeStatus,
} from '@local-downloader/protocol';
import { saveExtensionSettings, getExtensionSettings } from '../../lib/storage';
import { installerUrl } from '../../lib/installer';
import { AudioDownloadIcon, CheckIcon, CloseIcon, OpenFileIcon, VideoDownloadIcon } from '../../features/downloader/icons';

const qualityOptions = [
  ['best-up-to-1080p', 'Best up to 1080p'], ['best', 'Best available'], ['2160p', '2160p'],
  ['1440p', '1440p'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p'],
] as const;

export function App() {
  const [settings, setSettings] = useState<HelperSettings>(structuredClone(DEFAULT_HELPER_SETTINGS));
  const [extensionSettings, setExtensionSettings] = useState<ExtensionSettings>(structuredClone(DEFAULT_EXTENSION_SETTINGS));
  const [health, setHealth] = useState<RuntimeStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [notice, setNotice] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [queue, setQueue] = useState<DownloadQueueTask[]>([]);
  const port = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    const refreshQueue = (): void => { void chrome.runtime.sendMessage({ type: 'get_download_queue' }).then((tasks: DownloadQueueTask[]) => setQueue(tasks)); };
    void getExtensionSettings().then(setExtensionSettings);
    refreshQueue();
    const nativePort = chrome.runtime.connect({ name: 'popup-native' });
    port.current = nativePort;
    nativePort.onMessage.addListener((message: HelperMessage) => {
      if ('taskId' in message) refreshQueue();
      if (message.type === 'health_result') { setHealth(message.status); setUnavailable(!message.status.ready); }
      if (message.type === 'settings_result') setSettings(message.settings);
      if (message.type === 'update_status') { setUpdateAvailable(message.updateAvailable); setNotice(message.updated ? `yt-dlp updated to ${message.latestVersion ?? ''}` : message.updateAvailable ? `yt-dlp ${message.latestVersion ?? ''} is available` : 'yt-dlp is up to date'); }
      if (message.type === 'error') { if (message.code === 'NATIVE_UNAVAILABLE') setUnavailable(true); setNotice(message.message); }
    });
    nativePort.postMessage({ type: 'health_check' });
    nativePort.postMessage({ type: 'get_settings' });
    const browserListener = (message: unknown): void => { const value = message as { type?: string }; if (value.type === 'native_event') refreshQueue(); };
    chrome.runtime.onMessage.addListener(browserListener);
    return () => { chrome.runtime.onMessage.removeListener(browserListener); nativePort.disconnect(); port.current = null; };
  }, []);

  const save = (next: HelperSettings): void => { setSettings(next); port.current?.postMessage({ type: 'update_settings', settings: next }); };
  const updateExtension = (next: ExtensionSettings): void => { setExtensionSettings(next); void saveExtensionSettings(next); };
  const patch = (mutate: (next: HelperSettings) => void): void => { const next = structuredClone(settings); mutate(next); save(next); };

  if (unavailable) return <main className="popup setup"><h1>ClipFlux</h1><div className="setup-icon"><VideoDownloadIcon /></div><h2>Downloader setup required</h2><p>다운로드 기능을 사용하려면 Downloader Engine을 한 번 설치해야 합니다.</p><a className="primary" href={installerUrl()} target="_blank" rel="noreferrer">Install Downloader</a><button onClick={() => { setUnavailable(false); setHealth(null); port.current?.postMessage({ type: 'health_check' }); }}>Check again</button></main>;

  return <main className="popup">
    <header><div><h1>ClipFlux</h1><p className={health?.ready ? 'ready' : 'checking'}><span />{health === null ? 'Checking…' : health.ready ? 'Ready' : 'Setup incomplete'}</p></div></header>

    <Queue tasks={queue} onCancel={(taskId) => { void chrome.runtime.sendMessage({ type: 'cancel_download', taskId }); }} onOpen={(taskId) => { void chrome.runtime.sendMessage({ type: 'open_download', taskId }); }} />

    <section><h2>Video</h2><label>Default quality<select value={settings.video.quality} onChange={(event) => patch((next) => { next.video.quality = event.target.value as HelperSettings['video']['quality']; })}>{qualityOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>Container<select value={settings.video.container} onChange={() => undefined}><option value="mp4">MP4</option></select></label></section>

    <section><h2>Audio</h2><label>Format<select value={settings.audio.format} onChange={(event) => patch((next) => { next.audio.format = event.target.value as HelperSettings['audio']['format']; })}><option value="original">Original / Best</option><option value="m4a">M4A</option><option value="mp3">MP3</option></select></label>{settings.audio.format === 'mp3' && <label>MP3 encoding bitrate<select value={settings.audio.mp3Bitrate} onChange={(event) => patch((next) => { next.audio.mp3Bitrate = Number(event.target.value) as 320 | 256 | 192; })}><option value="320">320 kbps</option><option value="256">256 kbps</option><option value="192">192 kbps</option></select><small>Output bitrate; it cannot improve the source quality.</small></label>}</section>

    <section><h2>Save location</h2><div className="path-row"><code title={settings.output.baseDirectory}>{settings.output.baseDirectory}</code><button onClick={() => port.current?.postMessage({ type: 'choose_download_directory' })}>Change…</button></div><Check label="Separate Video and Audio folders" checked={settings.output.separateFolders} onChange={(checked) => patch((next) => { next.output.separateFolders = checked; })} /></section>

    <section><h2>Downloader</h2><div className="engine"><strong>Downloader Engine</strong><span className={health?.ready ? 'ready' : 'checking'}><i />{health?.ready ? 'Ready' : 'Not ready'}</span></div><details><summary>Details</summary><Runtime label="yt-dlp" component={health?.ytDlp} /><Runtime label="FFmpeg" component={health?.ffmpeg} /><Runtime label="FFprobe" component={health?.ffprobe} /><Runtime label="JS Runtime" component={health?.deno} /><Runtime label="Helper" component={health?.helper} /><Check label="Automatic yt-dlp updates" checked={settings.updates.automaticYtDlp} onChange={(checked) => patch((next) => { next.updates.automaticYtDlp = checked; })} /></details><button className="wide" onClick={() => port.current?.postMessage({ type: updateAvailable ? 'update_ytdlp' : 'check_for_updates' })}>{updateAvailable ? 'Update yt-dlp' : 'Check for updates'}</button>{notice !== '' && <p className="notice">{notice}</p>}</section>

    <section className="toggles"><Check label="Show Video button" checked={extensionSettings.showVideoButton} onChange={(checked) => updateExtension({ ...extensionSettings, showVideoButton: checked })} /><Check label="Show Audio button" checked={extensionSettings.showAudioButton} onChange={(checked) => updateExtension({ ...extensionSettings, showAudioButton: checked })} /></section>
  </main>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>; }
function Runtime({ label, component }: { label: string; component: RuntimeStatus['ytDlp'] | undefined }) { return <div className="runtime"><span>{label}</span><span title={component?.version}>{component?.installed ? <CheckIcon /> : '—'}</span></div>; }

function Queue({ tasks, onCancel, onOpen }: { tasks: DownloadQueueTask[]; onCancel: (taskId: string) => void; onOpen: (taskId: string) => void }) {
  const visible = tasks.slice(0, 6);
  const active = tasks.filter((task) => ['queued', 'downloading', 'processing'].includes(task.status)).length;
  return <section className="queue-section">
    <div className="section-heading"><h2>Downloads</h2>{active > 0 && <span>{active} active</span>}</div>
    {visible.length === 0 ? <div className="queue-empty"><VideoDownloadIcon /><p>다운로드를 시작하면 진행 상황이 여기에 표시됩니다.</p></div> : <div className="queue-list">{visible.map((task) => <QueueRow key={task.taskId} task={task} onCancel={onCancel} onOpen={onOpen} />)}</div>}
  </section>;
}

function QueueRow({ task, onCancel, onOpen }: { task: DownloadQueueTask; onCancel: (taskId: string) => void; onOpen: (taskId: string) => void }) {
  const active = ['queued', 'downloading', 'processing'].includes(task.status);
  const progress = task.status === 'completed' || task.status === 'processing' ? 100 : task.progress ?? 0;
  const status = task.status === 'queued' ? `대기열 ${task.queuePosition ?? '—'}번째` : task.status === 'downloading' ? `${Math.round(task.progress ?? 0)}% 다운로드 중` : task.status === 'processing' ? '파일 처리 중' : task.status === 'completed' ? '완료 · 클릭하여 열기' : task.error ?? '실패';
  const content = <>
    <div className="queue-kind">{task.status === 'completed' ? <CheckIcon /> : task.kind === 'video' ? <VideoDownloadIcon /> : <AudioDownloadIcon />}</div>
    <div className="queue-copy"><strong title={task.title ?? task.videoId}>{task.title ?? `YouTube · ${task.videoId}`}</strong><span>{task.kind === 'video' ? 'Video' : 'Audio'} · {status}</span>{active && <div className="queue-progress" aria-label={status}><i style={{ transform: `scaleX(${progress / 100})` }} /></div>}</div>
    {task.status === 'completed' ? <OpenFileIcon className="queue-open-icon" /> : active ? <button className="icon-button" type="button" aria-label="다운로드 취소" title="다운로드 취소" onClick={() => onCancel(task.taskId)}><CloseIcon /></button> : <span />}
  </>;
  if (task.status === 'completed' && task.finalFilePath !== undefined) return <button type="button" className={`queue-row queue-row-button queue-row--${task.status}`} title={`${task.fileName ?? task.title ?? '다운로드 파일'} 열기`} onClick={() => onOpen(task.taskId)}>{content}</button>;
  return <div className={`queue-row queue-row--${task.status}`}>{content}</div>;
}
