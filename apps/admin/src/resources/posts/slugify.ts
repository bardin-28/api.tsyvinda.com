/**
 * Ukrainian → Latin by the official national transliteration (Cabinet of Ministers resolution
 * No. 55, 2010): Є/Ї/Й/Ю/Я start a word as ye/yi/y/yu/ya and become ie/i/i/iu/ia inside it,
 * "зг" is "zgh", the soft sign and apostrophe are dropped. Russian-only letters get their usual
 * forms so mixed text still yields a readable slug.
 */
const UKRAINIAN_LETTERS: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  // Not Ukrainian, but common in quoted names
  ё: 'yo',
  ъ: '',
  ы: 'y',
  э: 'e',
};

/** Forms of Є, Ї, Й, Ю, Я at the start of a word. */
const WORD_START_LETTERS: Record<string, string> = {
  є: 'ye',
  ї: 'yi',
  й: 'y',
  ю: 'yu',
  я: 'ya',
};

const APOSTROPHES = /['’ʼ`]/g;
const CYRILLIC_LETTER = /[Ѐ-ӿ]/;

export function transliterateUkrainian(text: string): string {
  const lower = text.toLowerCase().replace(APOSTROPHES, '');
  let result = '';
  for (let index = 0; index < lower.length; index++) {
    const letter = lower[index]!;
    const previous = index > 0 ? lower[index - 1]! : '';
    const startsWord = !CYRILLIC_LETTER.test(previous) && !/[a-z0-9]/.test(previous);
    if (letter === 'г' && previous === 'з') {
      result += 'gh';
    } else if (startsWord && letter in WORD_START_LETTERS) {
      result += WORD_START_LETTERS[letter];
    } else {
      result += UKRAINIAN_LETTERS[letter] ?? letter;
    }
  }
  return result;
}

/**
 * Title → URL slug matching the API's rule: lowercase a-z0-9 with single inner hyphens.
 * Cyrillic titles are transliterated first.
 */
export function slugify(title: string): string {
  return (
    transliterateUkrainian(title)
      .normalize('NFKD')
      // Combining accents left over from NFKD (é → e)
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200)
      .replace(/-+$/, '')
  );
}
