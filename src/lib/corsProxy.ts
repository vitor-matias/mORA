// Shared by the two feeds that send no CORS headers — liturgia.pt's calendar
// (src/lib/liturgy.ts) and vatican.va's monthly theme (src/lib/intentions.ts).

/**
 * corsproxy.io went key-only, so it rejoins the proxy rotation only when a
 * key is configured. Vite inlines this into the bundle, where anyone can
 * read it — fine for a free key's quota, but it is not a secret.
 */
export function corsProxyIoUrl(url: string): string | null {
    const key = import.meta.env.VITE_CORSPROXY_KEY as string | undefined;
    if (!key) return null;
    return `https://corsproxy.io/?key=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}`;
}
