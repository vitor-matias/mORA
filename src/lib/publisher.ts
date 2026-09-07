// The one identity whose events the app reads as *content*.
//
// mORA publishes two feeds for itself to read back: the daily Palavra puzzle
// (server/palavra) and the liturgical calendar (server/agenda). Both are
// signed by the same key, and both are pinned here.
//
// Pinning is the whole point. A Nostr event is just an event: anyone can
// publish one claiming to be today's puzzle, or today's feast and its colour.
// Filtering on a known pubkey is the only thing separating what this project
// published from what a stranger did.
//
// It lives in its own module, rather than in either reader, for two reasons.
// One key checked in one place cannot drift into two subtly different checks.
// And it is a leaf — importing nothing — so the calendar can share the pin
// without pulling the game's store and puzzle logic into the bundle behind
// the liturgical colour that Layout renders on every page.
//
// This is separate from a signed-in user's own key (src/store/auth): that is
// whoever is using the app, while this is whoever the app believes.

const HEX64_RE = /^[0-9a-f]{64}$/i;

/**
 * A configured pubkey, or '' when there isn't a usable one.
 *
 * Exported for the tests; everything else wants `PUBLISHER_PUBKEY` below.
 */
export function parsePublisherPubkey(configured: string | undefined): string {
    const pubkey = configured?.trim() ?? '';
    if (!pubkey) return '';
    // An npub or a truncated key is the easy mistake here, and left unchecked
    // it fails in the worst way: the pin never matches, so every day looks
    // like "nothing published" with nothing on screen to point at.
    return HEX64_RE.test(pubkey) ? pubkey.toLowerCase() : '';
}

// Named for Palavra because it was the first feed to need it, and renaming it
// would mean every deployment setting a new variable to say what the old one
// already says. It pins both.
const configured = (import.meta.env.VITE_PALAVRA_PUBLISHER_PUBKEY as string | undefined)?.trim() ?? '';

/** The pinned publisher, or '' when nothing usable is configured. */
export const PUBLISHER_PUBKEY = parsePublisherPubkey(configured);

if (configured && !PUBLISHER_PUBKEY) {
    // One bad value breaks both feeds, so say so once, naming both.
    console.warn(
        'VITE_PALAVRA_PUBLISHER_PUBKEY must be 64 hex characters, not an npub. '
        + 'The daily puzzle falls back to the demo pool, and the liturgical calendar will not load.',
    );
}
