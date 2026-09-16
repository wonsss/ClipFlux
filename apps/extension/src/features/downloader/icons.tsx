type IconProps = { className?: string };

export function VideoDownloadIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3"/></svg>;
}

export function AudioDownloadIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6.5L19 4v11"/><path d="M9 15.5c-3.5-.7-5.5.6-5.5 2.4 0 1.5 1.5 2.5 3.4 2.1 1.3-.3 2.1-1.2 2.1-2.5m10-5c-3.5-.7-5.5.6-5.5 2.4 0 1.5 1.5 2.5 3.4 2.1 1.3-.3 2.1-1.2 2.1-2.5"/></svg>;
}

export function CheckIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>;
}

export function CloseIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>;
}

export function OpenFileIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6M19 5l-8 8"/><path d="M18 14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/></svg>;
}
