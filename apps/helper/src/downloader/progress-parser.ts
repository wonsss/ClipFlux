export type ProgressEvent =
  | { type: 'progress'; downloadedBytes: number | null; totalBytes: number | null; speedBytesPerSecond: number | null; etaSeconds: number | null; percent: number | null }
  | { type: 'processing' }
  | { type: 'completed'; finalFilePath: string };

function numeric(value: string | undefined): number | null {
  if (value === undefined || value === 'NA' || value === 'None' || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function parseProgressLine(line: string): ProgressEvent | null {
  if (line.startsWith('LOCAL_DOWNLOADER_PROGRESS|')) {
    const [, downloadedValue, totalValue, estimatedValue, speedValue, etaValue] = line.split('|');
    const downloadedBytes = numeric(downloadedValue);
    const totalBytes = numeric(totalValue) ?? numeric(estimatedValue);
    const percent = downloadedBytes !== null && totalBytes !== null && totalBytes > 0
      ? Math.min(100, Math.max(0, (downloadedBytes / totalBytes) * 100))
      : null;
    return { type: 'progress', downloadedBytes, totalBytes, speedBytesPerSecond: numeric(speedValue), etaSeconds: numeric(etaValue), percent };
  }
  if (line.startsWith('LOCAL_DOWNLOADER_PROCESSING|')) return { type: 'processing' };
  if (line.startsWith('LOCAL_DOWNLOADER_COMPLETE|')) {
    const finalFilePath = line.slice('LOCAL_DOWNLOADER_COMPLETE|'.length).trim();
    return finalFilePath === '' ? null : { type: 'completed', finalFilePath };
  }
  return null;
}
