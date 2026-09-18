// Platform sniffing, kept to the one thing UA strings are actually reliable
// for: telling iOS apart from everything else so UI like the share icon can
// match the glyph the player already recognizes from the rest of the OS.

/** True on iPhone, iPod, and iPad — including iPadOS 13+, which reports its
 *  platform as "MacIntel" and is only distinguishable by its touch support. */
export function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
