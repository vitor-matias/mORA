// Loads the pre-generated breviary JSON (public/lh/, produced by
// `npm run parse-lh generate`) — static same-origin data, cacheable by the
// service worker like any other asset. Relative paths work everywhere
// because routing is hash-based: the document URL never leaves the app root.

import { parseCommonsPointer, type ProprioEntry } from './proprio.ts';
import type { ComumDoc } from './comum.ts';
import { mergeComumOverlay } from './assemble.ts';

interface ProprioFile {
    month: string;
    entries: ProprioEntry[];
}

const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(file: string): Promise<T> {
    let pending = cache.get(file) as Promise<T> | undefined;
    if (!pending) {
        pending = fetch(`lh/${file}`).then((res) => {
            if (!res.ok) throw new Error(`lh/${file}: HTTP ${res.status}`);
            return res.json() as Promise<T>;
        });
        // A failed fetch must not poison the cache — retry on next call.
        pending.catch(() => cache.delete(file));
        cache.set(file, pending);
    }
    return pending;
}

/** The month's Próprio dos Santos entries; `month` is 1-based. */
export async function loadProprio(month: number): Promise<ProprioEntry[]> {
    const file = `proprio-${String(month).padStart(2, '0')}.json`;
    return (await loadJson<ProprioFile>(file)).entries;
}

/**
 * One Ofício Comum by id (see COMMON_FILES in comum.ts), with inheritance
 * resolved: a common declared as an overlay on another ("Como no Comum dos
 * Pastores da Igreja, excepto:") comes back whole.
 */
export async function loadComum(id: string, seen: Set<string> = new Set()): Promise<ComumDoc> {
    const doc = await loadJson<ComumDoc>(`comum-${id}.json`);
    seen.add(id);
    if (doc.note) {
        const baseId = parseCommonsPointer(doc.note)[0];
        // The visited set guards against cyclic inheritance in a future
        // regeneration — a → b → a would otherwise recurse forever.
        if (baseId && !seen.has(baseId)) {
            return mergeComumOverlay(await loadComum(baseId, seen), doc);
        }
    }
    return doc;
}
