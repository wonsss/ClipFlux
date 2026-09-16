import type { HelperMessage, RuntimeStatus } from '@local-downloader/protocol';
import { publicInstallerUrl } from '../../lib/installer';
import './style.css';

const command = `pnpm helper:build
pnpm runtime:download
LOCAL_DOWNLOADER_EXTENSION_ID=${chrome.runtime.id} pnpm native:install`;
const status = document.querySelector<HTMLElement>('#status');
const check = document.querySelector<HTMLButtonElement>('#check');
const guide = document.querySelector<HTMLElement>('#developer-guide');
const output = document.querySelector<HTMLElement>('#command');
const copy = document.querySelector<HTMLButtonElement>('#copy');
const download = document.querySelector<HTMLAnchorElement>('#download');
const port = chrome.runtime.connect({ name: 'setup-native' });
const publicInstaller = publicInstallerUrl();

if (output !== null) output.textContent = command;
if (guide !== null && publicInstaller !== undefined) guide.hidden = true;
if (download !== null) {
  if (publicInstaller === undefined) download.hidden = true;
  else {
    download.href = publicInstaller;
    download.target = '_blank';
    download.rel = 'noreferrer';
  }
}

function renderStatus(kind: 'checking' | 'ready' | 'unavailable', title: string, detail: string): void {
  if (status === null) return;
  status.dataset.state = kind;
  status.innerHTML = `<i></i><div><strong>${title}</strong><span>${detail}</span></div>`;
}

function checkConnection(): void {
  check?.setAttribute('disabled', '');
  renderStatus('checking', '연결을 확인하는 중입니다', '설치 후 처음 연결할 때는 잠시 걸릴 수 있습니다.');
  port.postMessage({ type: 'health_check' });
  window.setTimeout(() => {
    if (check?.disabled === true) {
      check.disabled = false;
      renderStatus('unavailable', '다운로드 엔진이 아직 준비되지 않았습니다', '설치가 완료된 뒤 다시 연결 확인을 눌러 주세요.');
    }
  }, 2500);
}

port.onMessage.addListener((message: HelperMessage) => {
  if (message.type !== 'health_result') return;
  check?.removeAttribute('disabled');
  renderHealth(message.status);
});
port.onDisconnect.addListener(() => {
  check?.removeAttribute('disabled');
  renderStatus('unavailable', '다운로드 엔진을 찾을 수 없습니다', '설치가 끝났는지 확인한 뒤 연결 확인을 눌러 주세요.');
});

function renderHealth(health: RuntimeStatus): void {
  if (health.ready) {
    renderStatus('ready', '설치가 완료되었습니다', '이 탭을 닫고 Chrome 도구 모음의 ClipFlux 아이콘을 다시 열어 주세요.');
    if (check !== null) check.textContent = '연결됨';
    return;
  }
  const missing = [
    !health.ytDlp.installed ? 'yt-dlp' : undefined,
    !health.ffmpeg.installed ? 'FFmpeg' : undefined,
    !health.ffprobe.installed ? 'FFprobe' : undefined,
    !health.deno.installed ? 'JavaScript runtime' : undefined,
  ].filter((value): value is string => value !== undefined);
  renderStatus('unavailable', '설치가 아직 완료되지 않았습니다', `${missing.join(', ')}를 준비하는 중이거나 설치가 필요합니다.`);
}

check?.addEventListener('click', checkConnection);
copy?.addEventListener('click', () => {
  void navigator.clipboard.writeText(command).then(() => { copy.textContent = '복사됨'; });
});
checkConnection();
