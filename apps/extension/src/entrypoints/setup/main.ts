import './style.css';

const command = `pnpm helper:build
pnpm runtime:download
LOCAL_DOWNLOADER_EXTENSION_ID=${chrome.runtime.id} pnpm native:install`;
const output = document.querySelector<HTMLElement>('#command');
const copy = document.querySelector<HTMLButtonElement>('#copy');
if (output !== null) output.textContent = command;
copy?.addEventListener('click', () => {
  void navigator.clipboard.writeText(command).then(() => { copy.textContent = '복사됨'; });
});
