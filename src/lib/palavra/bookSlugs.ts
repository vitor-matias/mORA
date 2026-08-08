// Portuguese book name to the slug biblia.capuchinhos.org uses in its routes.
//
// Generated from the corpus the verses themselves come from, where each book
// file declares its own abbreviation in a \toc3 line — not hand-written. That
// matters because the site answers an unknown slug with its app shell rather
// than a 404, so a wrong entry would not fail loudly. It would quietly send a
// reader to the wrong passage, for whichever books nobody thought to check.
//
// 'Salmo' is aliased to 'Salmos': the pool cites a single psalm in the
// singular, the corpus names the book in the plural.
export const BOOK_SLUGS: Record<string, string> = {
    'Génesis': 'gn',
    'Êxodo': 'ex',
    'Levítico': 'lv',
    'Números': 'nm',
    'Deuteronómio': 'dt',
    'Josué': 'js',
    'Juízes': 'jz',
    'Rute': 'rt',
    '1 Samuel': '1sm',
    '2 Samuel': '2sm',
    '1 Reis': '1rs',
    '2 Reis': '2rs',
    '1 Crónicas': '1cr',
    '2 Crónicas': '2cr',
    'Esdras': 'esd',
    'Neemias': 'ne',
    'Ester': 'est',
    'Job': 'jb',
    'Salmos': 'sl',
    'Provérbios': 'pr',
    'Eclesiastes': 'ecl',
    'Cântico dos Cânticos': 'ct',
    'Isaías': 'is',
    'Jeremias': 'jr',
    'Lamentações': 'lm',
    'Ezequiel': 'ez',
    'Daniel': 'dn',
    'Oseias': 'os',
    'Joel': 'jl',
    'Amós': 'am',
    'Abdias': 'abd',
    'Jonas': 'jn',
    'Miqueias': 'mq',
    'Naum': 'na',
    'Habacuc': 'hab',
    'Sofonias': 'sf',
    'Ageu': 'ag',
    'Zacarias': 'zc',
    'Malaquias': 'ml',
    'Mateus': 'mt',
    'Marcos': 'mc',
    'Lucas': 'lc',
    'João': 'jo',
    'Atos dos Apóstolos': 'at',
    'Romanos': 'rm',
    '1 Coríntios': '1cor',
    '2 Coríntios': '2cor',
    'Gálatas': 'gl',
    'Efésios': 'ef',
    'Filipenses': 'fl',
    'Colossenses': 'cl',
    '1 Tessalonicenses': '1ts',
    '2 Tessalonicenses': '2ts',
    '1 Timóteo': '1tm',
    '2 Timóteo': '2tm',
    'Tito': 'tt',
    'Filémon': 'flm',
    'Hebreus': 'heb',
    'Tiago': 'tg',
    '1 Pedro': '1pe',
    '2 Pedro': '2pe',
    '1 João': '1jo',
    '2 João': '2jo',
    '3 João': '3jo',
    'Judas': 'jd',
    'Apocalipse': 'ap',
    'Tobite': 'tb',
    'Judite': 'jdt',
    'Sabedoria': 'sb',
    'Ben Sira': 'sir',
    'Baruc': 'br',
    '1 Macabeus': '1mac',
    '2 Macabeus': '2mac',
    'Salmo': 'sl',
};

/**
 * The Capuchinhos reader's page for a reference like "1 João 5,6".
 *
 * Null when the book isn't in the table, so an unrecognised reference renders
 * as plain text rather than a link that looks right and is not.
 */
export function capuchinhosUrl(ref: string): string | null {
    const match = /^(.+?) (\d+),(\d+)$/.exec(ref.trim());
    if (!match) return null;
    const slug = BOOK_SLUGS[match[1].trim()];
    if (!slug) return null;
    return `https://biblia.capuchinhos.org/${slug}/${match[2]}?verseStart=${match[3]}`;
}
