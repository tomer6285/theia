function canonicalLanguage(value: string): string {
  try { return Intl.getCanonicalLocales(value)[0]?.toLowerCase().split('-')[0] || ''; }
  catch { return value.toLowerCase(); }
}

export function preferredTrackIndex(tracks: Array<{ lang?: string }>, preferences: string[]): number {
  for (const preference of preferences) {
    const index = tracks.findIndex((track) => track.lang
      && canonicalLanguage(track.lang) === canonicalLanguage(preference));
    if (index >= 0) return index;
  }
  return -1;
}
