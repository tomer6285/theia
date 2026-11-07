function canonicalLanguage(value: string): string {
  const label = value.toLowerCase().trim();
  const names: Record<string, string> = {
    english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt',
    japanese: 'ja', korean: 'ko', chinese: 'zh', arabic: 'ar', hebrew: 'he', russian: 'ru',
  };
  const name = label.split(/[\s[(]/)[0];
  if (names[name]) return names[name];
  try { return Intl.getCanonicalLocales(value)[0]?.toLowerCase().split('-')[0] || ''; }
  catch { return label; }
}

export function preferredTrackIndex(tracks: Array<{ lang?: string }>, preferences: string[]): number {
  for (const preference of preferences) {
    const index = tracks.findIndex((track) => track.lang
      && canonicalLanguage(track.lang) === canonicalLanguage(preference));
    if (index >= 0) return index;
  }
  return -1;
}
