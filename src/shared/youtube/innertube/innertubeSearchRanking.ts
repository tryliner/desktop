export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/!/g, "i")
    .replace(/\$/g, "s")
    .replace(/[()[\]\-–—_"'!?.,:;/\\|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "and",
  "or",
  "feat",
  "ft",
  "official",
  "audio",
  "video",
  "music",
  "lyrics",
  "и",
  "в",
  "на",
  "с",
  "со",
  "к",
  "по",
  "о",
  "об",
  "из",
  "клип",
  "трек",
  "песня",
]);

const JUNK_PHRASES = [
  "reaction",
  "reacts",
  "reacting",
  "first time hearing",
  "first time listening",
  "first time reacting",
  "tutorial",
  "how to play",
  "guitar lesson",
  "bass lesson",
  "drum lesson",
  "piano tutorial",
  "sheet music",
  "synthesia",
  "guitar tab",
  "bass tab",
  "drum tab",
  "drum cover",
  "guitar cover",
  "bass cover",
  "fingerstyle",
  "choreography",
  "dance cover",
  "dance practice",
  "dance video",
  "unboxing",
  "review",
  "podcast",
  "interview",
  "full episode",
  "1 hour loop",
  "10 hours",
  "1 hour version",
  "top 10",
  "top 20",
  "top 50",
  "all songs compilation",
  "playlist",
  "full album",
  "album stream",
  "greatest hits",
  "discography",
  "реакция",
  "реакции",
  "реакцию",
  "реагирует",
  "разбор",
  "как играть",
  "ноты",
  "обучение",
  "гитарный кавер",
  "бас кавер",
  "барабанный кавер",
  "интервью",
  "подкаст",
  "обзор",
  "плейлист",
  "полный альбом",
  "дискография",
  "все песни",
];

const MOD_WORDS = [
  "nightcore",
  "slowed",
  "reverb",
  "sped up",
  "speed up",
  "bass boosted",
  "8d audio",
  "замедленная",
  "замедленный",
  "реверб",
];

export function getQueryTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

export function isJunkVideo(title: string, query: string): boolean {
  const normTitle = normalizeSearchText(title);
  const normQuery = normalizeSearchText(query);
  if (
    JUNK_PHRASES.some(
      (phrase) => normTitle.includes(phrase) && !normQuery.includes(phrase),
    )
  ) {
    return true;
  }
  const userWantsMod = MOD_WORDS.some((mod) => normQuery.includes(mod));
  return !userWantsMod && MOD_WORDS.some((mod) => normTitle.includes(mod));
}

export function matchesQueryWell(
  query: string,
  title: string,
  artistNames: string[] = [],
): boolean {
  const tokens = getQueryTokens(query);
  if (tokens.length === 0) return true;
  const combined = normalizeSearchText(`${title} ${artistNames.join(" ")}`);
  const matched = tokens.filter((token) => combined.includes(token)).length;
  const threshold =
    tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.75);
  return matched >= threshold;
}
