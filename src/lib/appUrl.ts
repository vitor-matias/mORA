/**
 * Where this app is being served from.
 *
 * Read off the current page rather than configured, so it stays right for a
 * fork, a custom domain, or a move — nothing to update and nothing to go
 * stale. The hash router keeps the route out of `pathname`, so this resolves
 * to the app's root and not whatever page the reader happened to be on.
 */
export function appUrl(): string {
    const { origin, pathname } = window.location;
    return `${origin}${pathname.replace(/index\.html$/, '')}`;
}
