import type { NostrEvent, NostrFilter, NostrSigner } from '@nostrify/nostrify';
import { NUser } from '@nostrify/react/login';
import { pool, RELAYS } from '@/lib/pool';
import { useAuthStore, currentPubkey } from '@/store/auth';
import {
    useAppStore, mergeStreaks, streaksEqual, emptyStreaks, sanitizeSyncedSettings, settingsEqual,
    isCompleteSyncedSettings,
    type Streaks, type SyncedSettings,
} from '@/store/app';

/** What a signer is handed: an event with everything but the signature. */
export type EventTemplate = Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>;

export const MORA_APP_PUBKEY = 'mora_app'; // Could be used in tags to identify app

// NIP-78 "Application-specific Data": addressable event, replaced per d-tag.
// (30000 would collide with NIP-51 follow sets.)
export const KIND_APP_STATE = 30078;

// Addressable events are keyed by their d-tag, so streaks and settings live
// side by side under one identity without overwriting each other.
const D_STREAK = 'mora-app-streak';
const D_SETTINGS = 'mora-app-settings';

// Replaceable-event queries wait for every relay to EOSE, which an
// unresponsive one never sends — so without a ceiling a single dead relay
// would hang the whole sync. An aborted query returns what it has rather than
// throwing, so this is a deadline, not a failure.
export const RELAY_QUERY_TIMEOUT_MS = 5000;

/** Publishing succeeds as soon as one relay accepts, but a relay that neither
    accepts nor refuses would otherwise leave the publish pending forever. */
export const RELAY_PUBLISH_TIMEOUT_MS = 10_000;

/**
 * A read that says how many relays actually answered.
 *
 * `pool.query` cannot say: it swallows every abort and error and returns
 * whatever arrived, so an empty array means "nobody holds this" and "nobody
 * answered" alike — and it gives the slower relays only one second after the
 * *first* EOSE before aborting them, so a relay that has never heard of
 * somebody can end the read before the one holding their event has spoken.
 * For a board that is a thin result. For a read-modify-write on a replaceable
 * event it is data loss: republishing a list built from a failed read deletes
 * everything the read could not see.
 *
 * So this asks each relay separately, the way server/palavra/badges.js does,
 * and counts the ones that reached EOSE — each relay's own statement that it
 * sent everything it holds. A timeout, a socket error, or a CLOSED (which is
 * how a relay refuses a filter) all yield whatever arrived first, and that is
 * not an answer. There is no EOSE deadline beyond the caller's signal, so a
 * slow relay is waited for rather than cut off.
 *
 * What a caller does with `answered` is its own decision: a board can say the
 * totals are a floor, while a write that replaces a list must refuse outright.
 *
 * Replaceable events are not resolved here, unlike in `pool.query`. Callers
 * get the union deduplicated by id and pick, which is what the ones that care
 * already do.
 */
/**
 * Whether `candidate` supersedes `held` — the newest version of a replaceable
 * or addressable event, decided the same way everywhere.
 *
 * `created_at` alone is not enough. Two versions signed in the same second are
 * common — a republish takes milliseconds — and comparing only timestamps
 * leaves the winner to whichever relay answered first. That is not merely
 * untidy where the result feeds a read-modify-write: the contact list and the
 * profile badge list are each one event holding everything, so picking the
 * stale one of a tied pair republishes it over the current one and drops
 * whatever was added in between.
 *
 * Ties break on the lower id, which is what NSet does inside the pool and what
 * newestPerDay and the badge job's newestVersions do. Arbitrary, and that is
 * the point: every reader has to land on the same event.
 */
export function supersedes(candidate: NostrEvent, held: NostrEvent | undefined): boolean {
    if (!held) return true;
    if (candidate.created_at !== held.created_at) return candidate.created_at > held.created_at;
    return candidate.id < held.id;
}

/** The newest of a set of versions of the same replaceable event, or
    undefined when given none. */
export function newestEvent(events: NostrEvent[]): NostrEvent | undefined {
    return events.reduce<NostrEvent | undefined>(
        (held, candidate) => (supersedes(candidate, held) ? candidate : held),
        undefined,
    );
}

export async function queryComplete(
    filters: NostrFilter[],
    opts: { signal: AbortSignal; relays?: string[] },
): Promise<{ events: NostrEvent[]; answered: number; asked: number }> {
    const urls = opts.relays ?? RELAYS;

    const perRelay = await Promise.all(urls.map(async (url) => {
        const events: NostrEvent[] = [];
        try {
            for await (const msg of pool.relay(url).req(filters, { signal: opts.signal })) {
                if (msg[0] === 'EVENT') events.push(msg[2]);
                if (msg[0] === 'EOSE') return { events, answered: true };
                // Declined. What it sent first is a fragment, not a result set.
                if (msg[0] === 'CLOSED') return { events, answered: false };
            }
        } catch {
            // Aborted, or the socket gave out.
        }
        return { events, answered: false };
    }));

    const byId = new Map<string, NostrEvent>();
    for (const relay of perRelay) {
        for (const event of relay.events) byId.set(event.id, event);
    }
    return {
        events: [...byId.values()],
        answered: perRelay.filter((relay) => relay.answered).length,
        asked: urls.length,
    };
}

// Devices don't agree on the clock to the second; allow a little slack before
// calling a settings timestamp impossible.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

// One sync of each kind at a time; overlapping callers await the same run.
let inFlightStreakSync: Promise<void> | null = null;
let inFlightSettingsSync: Promise<void> | null = null;

export interface NostrProfile {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
}

/**
 * The signer for whoever is logged in, built from their login record.
 *
 * `NUser` turns each custody into the matching `NostrSigner` — `NSecSigner`
 * for a local key, `NBrowserSigner` for an extension (which waits out the
 * injection race), `NConnectSigner` for a remote signer — so nothing
 * downstream has to know which one it got. Null when there is no way to sign:
 * signed out, or a protected key that hasn't been unlocked this session.
 */
export async function getSigner(): Promise<NostrSigner | null> {
    const { login } = useAuthStore.getState();
    if (!login) return null;
    switch (login.type) {
        case 'nsec':
            return NUser.fromNsecLogin(login).signer;
        case 'extension':
            return NUser.fromExtensionLogin(login).signer;
        case 'bunker': {
            // Lazy: the signer module talks over relays, and only this custody
            // needs the connect handshake it manages.
            const { getBunkerSigner } = await import('@/lib/signer');
            return getBunkerSigner(login);
        }
        default:
            return null;
    }
}

export async function signNostrEvent(baseEvent: EventTemplate): Promise<NostrEvent> {
    const signer = await getSigner();
    if (!signer) throw new Error('No method available to sign the event');
    return signer.signEvent(baseEvent);
}

export async function fetchNostrProfile(pubkey: string): Promise<NostrProfile | null> {
    try {
        const events = await pool.query(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        if (events.length > 0) {
            return JSON.parse(events[0].content) as NostrProfile;
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch Nostr profile:', error);
        return null;
    }
}

/**
 * The whole of this identity's published profile, as raw JSON.
 *
 * Distinct from `fetchNostrProfile`, which narrows to the four fields this app
 * understands. Anything that *republishes* a profile has to see the rest —
 * kind 0 is replaceable, so a field left out is a field deleted.
 *
 * Returns null when the relays could not be asked, which is not the same as an
 * identity having no profile yet, and must not be treated as one.
 */
async function fetchRawProfile(
    pubkey: string,
): Promise<{ content: Record<string, unknown> } | null> {
    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not read the current profile.', error);
        return null;
    }
    const newest = events.sort((a, b) => b.created_at - a.created_at)[0];
    if (!newest) return { content: {} };
    try {
        const parsed = JSON.parse(newest.content) as unknown;
        // An array or a scalar is not a profile, and `typeof [] === 'object'`
        // would have let one through: spreading it into the merge yields an
        // object, so whatever was actually published would be replaced by the
        // edits alone. Unrecognisable is unreadable — refuse, don't overwrite.
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            console.warn('The published profile is not a JSON object; refusing to replace it.');
            return null;
        }
        return { content: parsed as Record<string, unknown> };
    } catch {
        // Unparseable is not empty. Overwriting it would still destroy
        // whatever it holds, so treat it as unreadable and refuse.
        console.warn('The published profile is not valid JSON; refusing to replace it.');
        return null;
    }
}

/**
 * Publish changes to this identity's profile.
 *
 * Merged into whatever is already published, never substituted for it. Kind 0
 * is replaceable: the event that lands *is* the profile, so publishing the
 * handful of fields this app knows about silently deletes every field it
 * doesn't — a Lightning address, a NIP-05 identifier, a banner. Reported by a
 * user who edited their picture here and lost `lud16`, `nip05`, `display_name`
 * and `banner` in the same write.
 *
 * If the current profile can't be read, this refuses rather than publishing
 * the changes alone — a failed read must never become a destructive write.
 */
export async function publishNostrProfile(
    changes: NostrProfile,
    /** Set only for an identity created moments ago on this device, which
        cannot have a published profile to merge with or destroy. Without it a
        slow relay would fail the read and refuse to publish the new name —
        protecting something that does not exist. */
    options: { isNewIdentity?: boolean } = {},
): Promise<NostrProfile> {
    const pubkey = currentPubkey();
    if (!pubkey) throw new Error("Not logged in");

    const current = options.isNewIdentity ? { content: {} } : await fetchRawProfile(pubkey);
    if (!current) {
        throw new Error(
            'Não foi possível ler o perfil atual, por isso não foi guardado. Tente novamente.',
        );
    }

    // Undefined entries in `changes` must not blank a published field, so they
    // are dropped before the merge rather than overwriting with undefined.
    const edits = Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    const merged = { ...current.content, ...edits };

    const baseEvent: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(merged)
    };

    try {
        const signedEvent = await signNostrEvent(baseEvent);

        // Resolves as soon as any relay accepts, rejects only if all refuse.
        await pool.event(signedEvent, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
        console.log('Successfully published profile to Nostr:', signedEvent);
        // The merged profile, so the caller can update local state without a
        // second round trip — and without falling back to just its own edits,
        // which would drop every field it doesn't know about from the copy
        // this device shows.
        return merged as NostrProfile;
    } catch (error) {
        console.error('Failed to publish Nostr profile:', error);
        throw error;
    }
}

/** Name plus avatar, for anywhere people are listed rather than just counted. */
export interface ProfileCard {
    name?: string;
    picture?: string;
}

/**
 * How long a picture URL may be.
 *
 * The cap exists so a hostile profile can't ship an unbounded string into the
 * DOM, not to judge what a reasonable picture looks like. 500 was far too mean
 * for that job on both counts: a signed CDN link passes it with a couple of
 * query parameters, and an inline `data:` avatar — which some clients publish
 * — is tens of kilobytes by nature.
 */
const MAX_PICTURE_URL = 200_000;

/**
 * Whether a profile picture can be put in an `<img src>`.
 *
 * `https:` is the ordinary case. Inline `data:` images are allowed too — some
 * clients embed a small avatar directly in the profile, and refusing them
 * showed a placeholder for a picture every other app renders.
 *
 * SVG is excluded from that even though it is an image type: an SVG can carry
 * script, and this one comes from a stranger's profile. Raster formats can't.
 * Everything else — `javascript:`, `http:` on an https page, anything unknown
 * — stays out.
 */
function isShowableImage(url: string): boolean {
    if (url.length > MAX_PICTURE_URL) return false;
    if (/^https:\/\//i.test(url)) return true;
    return /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url);
}

/**
 * A profile as it can safely be shown in a list, or null if there is nothing
 * worth showing.
 *
 * `picture` is kept only when `isShowableImage` accepts it — an https URL, or
 * an inline raster `data:` image. It is rendered as an <img> src, so anything
 * else from a hostile profile would be loading attacker-chosen content into
 * the page.
 *
 * Shared, so a profile taken from local state goes through the same checks as
 * one pulled off a relay: your own is no more trustworthy to render than a
 * stranger's, it just happens to be yours.
 */
export function toProfileCard(profile: NostrProfile | null | undefined): ProfileCard | null {
    if (!profile) return null;
    // Names are attacker-controlled: collapse whitespace and cap the length so
    // a hostile profile can't wreck the layout.
    const name = (profile.display_name || profile.name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);
    const picture = typeof profile.picture === 'string' && isShowableImage(profile.picture)
        ? profile.picture
        : undefined;
    // Rejected silently, this looks identical to having no picture at all —
    // and the person best placed to fix it is the one who can't see why.
    if (profile.picture && !picture) {
        console.warn(
            'Ignoring a profile picture: it must be an https URL, or an inline '
            + `png/jpeg/gif/webp/avif, under ${MAX_PICTURE_URL} characters. `
            + `Got: ${String(profile.picture).slice(0, 120)}`,
        );
    }
    if (!name && !picture) return null;
    return { name: name || undefined, picture };
}

/** Newest kind-0 name and avatar per pubkey, sanitised for display. */
export async function fetchProfileCards(pubkeys: string[]): Promise<Map<string, ProfileCard>> {
    const cards = new Map<string, ProfileCard>();
    if (pubkeys.length === 0) return cards;

    let metadata: NostrEvent[];
    try {
        // kind 0 is replaceable, so this is already one profile per pubkey —
        // the newest each relay in the pool had to offer.
        metadata = await pool.query(
            [{ kinds: [0], authors: pubkeys }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not fetch profiles:', error);
        return cards;
    }

    // The query spans several relays, so two copies of one pubkey's kind-0
    // with different created_at can both come back. Without this the last one
    // in the array won — arrival order, not recency — and a stale name or
    // avatar could overwrite the current one.
    const newestAt = new Map<string, number>();

    for (const event of metadata) {
        if ((newestAt.get(event.pubkey) ?? -1) >= event.created_at) continue;
        try {
            const card = toProfileCard(JSON.parse(event.content) as NostrProfile);
            if (card) {
                newestAt.set(event.pubkey, event.created_at);
                cards.set(event.pubkey, card);
            }
        } catch { /* malformed profile JSON — skip this one */ }
    }
    return cards;
}

// NIP-44 to self, so relays only ever store ciphertext. Returns null when
// there is no encryption path (e.g. a NIP-07 extension without nip44, which
// leaves `signer.nip44` undefined) — callers skip rather than fall back to
// plaintext.
async function encryptToSelf(plaintext: string): Promise<string | null> {
    const pubkey = currentPubkey();
    const signer = await getSigner();
    if (!pubkey || !signer?.nip44) return null;
    return signer.nip44.encrypt(pubkey, plaintext);
}

async function decryptFromSelf(ciphertext: string): Promise<string | null> {
    const pubkey = currentPubkey();
    const signer = await getSigner();
    if (!pubkey || !signer?.nip44) return null;
    return signer.nip44.decrypt(pubkey, ciphertext);
}

/** The newest snapshot this identity published under `dTag`, decrypted, or
    null if there is none (or it can't be read). */
export async function fetchSnapshot(
    pubkey: string,
    dTag: string,
): Promise<{ payload: Record<string, unknown>; createdAt: number } | null> {
    let events: NostrEvent[];
    try {
        // Relays each hold their own copy of an addressable event and can lag;
        // the pool waits for them all (up to the deadline) and hands back only
        // the newest, so there is nothing to reconcile here.
        events = await pool.query([{
            kinds: [KIND_APP_STATE],
            authors: [pubkey],
            '#d': [dTag],
        }], { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) });
    } catch (error) {
        console.warn(`Could not fetch ${dTag} from Nostr relays.`, error);
        return null;
    }
    const [newest] = events;
    if (!newest) return null;

    try {
        const plaintext = await decryptFromSelf(newest.content);
        if (!plaintext) return null;
        const payload = JSON.parse(plaintext) as Record<string, unknown>;
        if (!payload || typeof payload !== 'object') return null;
        return { payload, createdAt: newest.created_at };
    } catch (error) {
        console.warn(`Could not read the ${dTag} snapshot from Nostr.`, error);
        return null;
    }
}

export async function publishSnapshot(dTag: string, payload: Record<string, unknown>, label: string) {
    let eventContent: string;
    try {
        const encrypted = await encryptToSelf(JSON.stringify(payload));
        if (!encrypted) {
            console.warn(`No NIP-44 encryption available; not publishing ${label}.`);
            return;
        }
        eventContent = encrypted;
    } catch (error) {
        console.warn(`Failed to encrypt ${label}; not publishing.`, error);
        return;
    }

    const baseEvent: EventTemplate = {
        kind: KIND_APP_STATE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', dTag], // The distinct string for this parameterized replaceable event
            ['client', 'mora'],
        ],
        content: eventContent,
    };

    try {
        const signedEvent = await signNostrEvent(baseEvent);
        await pool.event(signedEvent, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
        console.log(`Successfully published ${label} to Nostr.`);
    } catch (error) {
        // Relays reject or go offline routinely — warn rather than throw.
        console.warn(`Could not publish ${label} to Nostr relays. Continuing anyway.`, error);
    }
}

export async function publishStreakToNostr() {
    const pubkey = currentPubkey();
    const { streaks, shareStreaks } = useAppStore.getState();
    if (!pubkey) return; // Not logged in
    // Prayer activity is sensitive — syncing it to relays is opt-in.
    if (!shareStreaks) return;

    await publishSnapshot(D_STREAK, { streaks, lastUpdate: new Date().toISOString() }, 'streaks');
}

export async function publishSettingsToNostr() {
    const pubkey = currentPubkey();
    const state = useAppStore.getState();
    if (!pubkey || !state.shareStreaks) return;

    const settings: SyncedSettings = {
        fontFamily: state.fontFamily,
        rosaryMode: state.rosaryMode,
    };
    await publishSnapshot(D_SETTINGS, { settings, updatedAt: state.settingsUpdatedAt }, 'settings');
}

/**
 * Pulls this identity's published streaks and merges them into the local
 * store, then republishes if this device now knows more than the relays do.
 * Safe to call repeatedly; the merge is idempotent.
 */
export function syncStreaksWithNostr(): Promise<void> {
    // Sign-in forces a sync past the hook's throttle, which can land while a
    // foreground-triggered one is still in flight. Both would fetch, merge and
    // publish the same replaceable event, so callers share the first run.
    inFlightStreakSync ??= doSyncStreaks().finally(() => { inFlightStreakSync = null; });
    return inFlightStreakSync;
}

async function doSyncStreaks(): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;

    const snapshot = await fetchSnapshot(pubkey, D_STREAK);
    // A payload whose `streaks` is not an object is no snapshot at all —
    // treating it as one would suppress the re-seed below.
    const raw = snapshot?.payload.streaks;
    const remote = (raw && typeof raw === 'object' ? raw : null) as Streaks | null;
    // Read the store after the round-trip, not before: a prayer may have
    // completed while the query was in flight.
    const { streaks: local, setStreaks } = useAppStore.getState();
    const merged = mergeStreaks(local, remote);

    if (!streaksEqual(merged, local)) setStreaks(merged);

    // Seed the relays on first sync, and push whatever they were missing.
    // publishStreakToNostr reads the store, so it picks up the merge above.
    if (!remote || !streaksEqual(merged, mergeStreaks(emptyStreaks(), remote))) {
        await publishStreakToNostr();
    }
}

/**
 * Settings are last-write-wins on `settingsUpdatedAt` — unlike streaks there
 * is nothing to reconcile between two devices, only a question of which edit
 * came last.
 */
export function syncSettingsWithNostr(): Promise<void> {
    inFlightSettingsSync ??= doSyncSettings().finally(() => { inFlightSettingsSync = null; });
    return inFlightSettingsSync;
}

async function doSyncSettings(): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;

    const snapshot = await fetchSnapshot(pubkey, D_SETTINGS);
    const state = useAppStore.getState();
    // Last-write-wins means the timestamp decides everything, so an impossible
    // one has to be discarded rather than compared: Infinity or a year-3000
    // value from a wrong clock would win forever and freeze this device's own
    // edits out of the sync permanently. Treat anything unusable as "no
    // timestamp", which makes the remote lose and this device republish.
    const rawUpdatedAt = snapshot?.payload.updatedAt;
    const remoteUpdatedAt = typeof rawUpdatedAt === 'number'
        && Number.isFinite(rawUpdatedAt)
        && rawUpdatedAt >= 0
        && rawUpdatedAt <= Date.now() + CLOCK_SKEW_TOLERANCE_MS
        ? rawUpdatedAt
        : 0;
    const remoteSettings = sanitizeSyncedSettings(snapshot?.payload.settings);
    // Half a snapshot is not a snapshot: adopting one would hand this device
    // the remote's timestamp while leaving the field it failed to supply where
    // it was, so a truncated relay entry would outrank a good local edit. It
    // loses the comparison below and gets published over.
    const usable = isCompleteSyncedSettings(remoteSettings);

    const localSettings: SyncedSettings = {
        fontFamily: state.fontFamily,
        rosaryMode: state.rosaryMode,
    };

    if (snapshot && usable && remoteUpdatedAt > state.settingsUpdatedAt) {
        if (!settingsEqual(localSettings, remoteSettings)) {
            state.applySyncedSettings(remoteSettings, remoteUpdatedAt);
        }
        return;
    }
    // This device edited last (or the relays have nothing usable) — publish,
    // but not if the two already agree, so a plain app start writes nothing.
    if (!snapshot || !usable || !settingsEqual(localSettings, remoteSettings)) {
        await publishSettingsToNostr();
    }
}
