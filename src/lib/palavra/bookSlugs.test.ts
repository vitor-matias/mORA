import { describe, expect, it } from 'vitest';
import { BOOK_SLUGS, capuchinhosUrl } from './bookSlugs';

describe('capuchinhosUrl', () => {
    it('builds the reader route the site uses', () => {
        expect(capuchinhosUrl('1 João 5,6'))
            .toBe('https://biblia.capuchinhos.org/1jo/5?verseStart=6');
    });

    it('handles a single-word book and a numbered one alike', () => {
        expect(capuchinhosUrl('Lucas 4,32'))
            .toBe('https://biblia.capuchinhos.org/lc/4?verseStart=32');
        expect(capuchinhosUrl('2 Macabeus 7,9'))
            .toBe('https://biblia.capuchinhos.org/2mac/7?verseStart=9');
    });

    it('accepts the singular Salmo the pool cites', () => {
        // The corpus names the book "Salmos"; every reference to one psalm is
        // singular. Without the alias every psalm in the pool loses its link.
        expect(capuchinhosUrl('Salmo 23,1'))
            .toBe('https://biblia.capuchinhos.org/sl/23?verseStart=1');
    });

    // Fails closed. The site answers an unknown slug with its app shell rather
    // than a 404, so a guessed link would look fine and land on the wrong text.
    it('returns null for a book it does not know', () => {
        expect(capuchinhosUrl('Livro Inventado 1,1')).toBeNull();
    });

    it('returns null for a reference it cannot parse', () => {
        expect(capuchinhosUrl('Lucas')).toBeNull();
        expect(capuchinhosUrl('Lucas 4')).toBeNull();
        expect(capuchinhosUrl('')).toBeNull();
    });

    it('covers the whole canon the corpus ships', () => {
        expect(Object.keys(BOOK_SLUGS).length).toBeGreaterThanOrEqual(73);
    });
});
