export type ValidatedYouTubeUrl = { url: string; videoId: string };

export function validateYouTubeUrl(value: string, expectedVideoId?: string): ValidatedYouTubeUrl {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.youtube.com' || parsed.pathname !== '/watch') {
    throw new Error('Only public YouTube watch URLs are supported');
  }
  const videoId = parsed.searchParams.get('v');
  if (videoId === null || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error('Invalid YouTube video id');
  }
  if (expectedVideoId !== undefined && videoId !== expectedVideoId) {
    throw new Error('URL and video id do not match');
  }
  parsed.search = `?v=${encodeURIComponent(videoId)}`;
  return { url: parsed.toString(), videoId };
}
