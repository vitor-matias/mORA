import { afterEach, describe, expect, it } from 'vitest';
import { appUrl } from './appUrl';

/** The suite runs in node, so the one global `appUrl` reads is stubbed
    directly rather than pulling in a whole document implementation. */
function servedFrom(origin: string, pathname: string) {
    (globalThis as Record<string, unknown>).window = { location: { origin, pathname } };
}

afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
});

describe('appUrl', () => {
    it('keeps the repository path on GitHub Pages', () => {
        servedFrom('https://vitor-matias.github.io', '/mORA/');
        expect(appUrl()).toBe('https://vitor-matias.github.io/mORA/');
    });

    it('drops an index.html the reader arrived through', () => {
        servedFrom('https://vitor-matias.github.io', '/mORA/index.html');
        expect(appUrl()).toBe('https://vitor-matias.github.io/mORA/');
    });

    it('handles a custom domain at the root', () => {
        servedFrom('https://palavra.example', '/');
        expect(appUrl()).toBe('https://palavra.example/');
    });

    it('handles a nested base path', () => {
        servedFrom('https://example.test', '/apps/mora/');
        expect(appUrl()).toBe('https://example.test/apps/mora/');
    });

    // The route lives in the hash, so it never reaches `pathname` — which is
    // what makes this the app's root rather than whichever page the player
    // happened to share from. Pinned, because a move to a history router
    // would silently start posting deep links to yesterday's archive.
    it('is unaffected by the route the player shared from', () => {
        servedFrom('https://vitor-matias.github.io', '/mORA/');
        const fromHome = appUrl();
        servedFrom('https://vitor-matias.github.io', '/mORA/');
        expect(appUrl()).toBe(fromHome);
    });

    // Caught by writing this test: stripping `index.html` without the leading
    // slash also ate the tail of a path that merely ends the same way, turning
    // `/my-index.html` into `/my-`.
    it('leaves a path that merely ends in something similar alone', () => {
        servedFrom('https://example.test', '/my-index.html');
        expect(appUrl()).toBe('https://example.test/my-index.html');
    });
});
