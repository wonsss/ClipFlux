import { z } from 'zod';

// Subset of the yt-dlp info dictionary used for audio tagging. Anything else is ignored.
export const YtDlpInfoSchema = z.looseObject({
  id: z.unknown().optional(),
  title: z.unknown().optional(),
  track: z.unknown().optional(),
  artist: z.unknown().optional(),
  creator: z.unknown().optional(),
  uploader: z.unknown().optional(),
  channel: z.unknown().optional(),
  album: z.unknown().optional(),
  release_title: z.unknown().optional(),
  release_year: z.unknown().optional(),
  upload_date: z.unknown().optional(),
  genre: z.unknown().optional(),
  track_number: z.unknown().optional(),
});
export type YtDlpInfo = z.infer<typeof YtDlpInfoSchema>;

export type AudioMetadata = {
  title: string;
  artist: string | undefined;
  album: string | undefined;
  albumArtist: string | undefined;
  year: string | undefined;
  genre: string | undefined;
  trackNumber: string | undefined;
};

// Values YouTube commonly emits that should be treated as "no metadata" for Music.app.
const INVALID_VALUES = new Set([
  'na', 'n/a', 'none', 'null', 'unknown', 'unknown artist', 'unknown album', 'various artists',
]);

function clean(value: unknown): string | undefined {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : undefined;
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' || INVALID_VALUES.has(trimmed.toLowerCase()) ? undefined : trimmed;
}

function first(...values: unknown[]): string | undefined {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned !== undefined) return cleaned;
  }
  return undefined;
}

// Channel names frequently carry suffixes that are not part of the artist name:
// auto-generated "Artist - Topic" uploads and "ArtistVEVO" channels.
const ARTIST_SUFFIXES = /(?:\s+-\s+Topic|\s*VEVO)$/i;

function cleanArtist(value: unknown): string | undefined {
  const cleaned = clean(value);
  if (cleaned === undefined) return undefined;
  const stripped = cleaned.replace(ARTIST_SUFFIXES, '').trim();
  return stripped === '' || INVALID_VALUES.has(stripped.toLowerCase()) ? undefined : stripped;
}

function firstArtist(...values: unknown[]): string | undefined {
  for (const value of values) {
    const artist = cleanArtist(value);
    if (artist !== undefined) return artist;
  }
  return undefined;
}

function uploadYear(value: unknown): string | undefined {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : undefined;
  const match = raw?.match(/\d{4}/);
  return match?.[0];
}

// Bracketed YouTube decorations like "(Official Video)" or "[M/V]". Parentheses
// carrying real information — (feat. X), (Live), (Remastered) — are kept.
const DECORATOR_KEYWORDS = /\b(official|music video|lyrics?|visualizer|audio|video|mv|m\/v|hd|hq|4k|explicit|teaser|trailer)\b/i;
const BRACKETED_SEGMENT = /\s*(?:\(([^()]{0,60})\)|\[([^[\]]{0,60})\]|\{([^{}]{0,60})\})/g;

function stripDecorators(title: string): string {
  const stripped = title
    .replace(BRACKETED_SEGMENT, (match, ...groups: unknown[]) =>
      groups.slice(0, 3).some((group) => typeof group === 'string' && DECORATOR_KEYWORDS.test(group)) ? '' : match)
    .replace(/\s+/g, ' ')
    .trim();
  return stripped === '' ? title.trim() : stripped;
}

const ARTIST_TITLE_SEPARATOR = /\s+[-–—]\s+/;

function splitArtistTitle(raw: string): { head: string; tail: string } | undefined {
  const match = ARTIST_TITLE_SEPARATOR.exec(raw);
  if (match === null) return undefined;
  return { head: raw.slice(0, match.index), tail: raw.slice(match.index + match[0].length) };
}

function sameName(a: string, b: string): boolean {
  const key = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return key(a) === key(b);
}

export function parseInfoJson(json: string): YtDlpInfo {
  try {
    const parsed = YtDlpInfoSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function normalizeAudioMetadata(info: YtDlpInfo, fallbackTitle: string): AudioMetadata {
  // artist/creator are explicit artist fields; uploader/channel are only names
  // of the account that posted the video and are treated as a weaker signal.
  const strongArtist = firstArtist(info.artist, info.creator);
  const weakArtist = firstArtist(info.uploader, info.channel);
  const track = clean(info.track);
  const rawTitle = track ?? clean(info.title) ?? fallbackTitle;

  let title = rawTitle;
  let artist = strongArtist ?? weakArtist;
  let titleDerivedArtist = false;
  const parts = track === undefined ? splitArtistTitle(rawTitle) : undefined;
  if (parts !== undefined) {
    const head = cleanArtist(parts.head);
    const tail = clean(parts.tail);
    if (head !== undefined && tail !== undefined) {
      if (strongArtist !== undefined) {
        if (sameName(head, strongArtist)) title = tail;
      } else {
        artist = head;
        title = tail;
        titleDerivedArtist = true;
      }
    }
  }
  title = stripDecorators(title);

  return {
    title,
    artist,
    // No album on YouTube → treat the upload as a single so Music.app shows the
    // track title instead of grouping it under "Unknown Album".
    album: first(info.album, info.release_title) ?? title,
    albumArtist: strongArtist ?? (titleDerivedArtist ? artist : undefined) ?? firstArtist(info.uploader),
    year: clean(info.release_year) ?? uploadYear(info.upload_date),
    genre: clean(info.genre),
    trackNumber: clean(info.track_number),
  };
}

// Characters that are invalid or confusing in filenames on macOS/Finder.
// eslint-disable-next-line no-control-regex -- control characters are stripped deliberately
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\x00-\x1f\x7f]/g;

export function sanitizeFileName(name: string, maxLength = 180): string {
  const cleaned = name
    .replace(UNSAFE_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .slice(0, maxLength)
    .replace(/[.\s]+$/, '');
  return cleaned === '' ? 'audio' : cleaned;
}

export function normalizeVideoTitle(info: YtDlpInfo, fallbackTitle: string): string {
  return stripDecorators(first(info.title) ?? fallbackTitle);
}

export function audioFileBaseName(metadata: AudioMetadata): string {
  const base = metadata.artist === undefined ? metadata.title : `${metadata.artist} - ${metadata.title}`;
  return sanitizeFileName(base);
}
