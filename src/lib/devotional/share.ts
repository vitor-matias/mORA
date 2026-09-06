import { appUrl } from '@/lib/appUrl';
import { withVersicleGlyphs } from '@/lib/versicles';
import type { Prayer } from './types';

/**
 * A prayer as plain text — what goes on the clipboard or into a share sheet.
 *
 * The body carries its ℣ and ℟ rather than the "V." / "R." the data files are
 * written with, so what is pasted reads the way the page does.
 */
export function prayerAsText(prayer: Prayer): string {
    return `${prayer.title}\n\n${withVersicleGlyphs(prayer.text)}`;
}

/**
 * A link back to a prayer, for whoever it is sent to.
 *
 * The route lives in the hash, so it hangs off the app's root rather than
 * being a path of its own; `appUrl` finds that root from the page itself, so
 * the link stays right on a fork, a custom domain or a subdirectory
 * deployment without anything to configure.
 */
export function prayerUrl(prayer: Prayer, base: string = appUrl()): string {
    return `${base}#/devocionario/${prayer.id}`;
}
