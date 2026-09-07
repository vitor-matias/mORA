import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RosaryBeadMode } from '@/lib/rosary';
import type { DaySection, LiturgicalDayInfo } from '@/lib/icsCalendar';
import { daysApart, formatISODate } from '@/lib/format';

export interface StreakData {
    days: number;
    lastCompletedDate: string | null;
}

export type StreakItem = 'rosary' | 'liturgy' | 'liturgy_hours';

export const STREAK_ITEMS: readonly StreakItem[] = ['rosary', 'liturgy', 'liturgy_hours'];

export type Streaks = Record<StreakItem, StreakData>;

/** An in-progress rosary, so an accidental exit never loses the user's place. */
export interface RosarySession {
    date: string; // YYYY-MM-DD — sessions don't survive to the next day
    mode: RosaryBeadMode;
    step: number;
}

export function isCompletedToday(streak: StreakData): boolean {
    return streak.lastCompletedDate === formatISODate(new Date());
}

// ── Cross-device streak merging ──────────────────────────────────────────
// Every device keeps its own count and publishes a snapshot; nothing else
// knows what the others recorded, so pulling one in means reconciling two
// partial histories rather than picking a winner.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyStreak(): StreakData {
    return { days: 0, lastCompletedDate: null };
}

export function emptyStreaks(): Streaks {
    return { rosary: emptyStreak(), liturgy: emptyStreak(), liturgy_hours: emptyStreak() };
}

// A century of unbroken daily prayer. Past this the number is not a streak,
// it's a corrupted snapshot.
const MAX_STREAK_DAYS = 36_500;

/** A snapshot from a relay is only as trustworthy as its shape — and a device
    with a wrong clock could otherwise park a streak in the future, where no
    later prayer can ever extend it. */
function isUsableStreak(value: unknown): value is StreakData {
    if (!value || typeof value !== 'object') return false;
    const { days, lastCompletedDate } = value as StreakData;
    if (!Number.isInteger(days) || days < 0 || days > MAX_STREAK_DAYS) return false;
    // The two fields have to agree: a count with no date it was earned on (or
    // a date with a zero count) is an impossible state that would otherwise
    // overwrite a good local streak.
    if (lastCompletedDate === null) return days === 0;
    if (days === 0) return false;
    if (typeof lastCompletedDate !== 'string' || !ISO_DATE_RE.test(lastCompletedDate)) return false;
    return lastCompletedDate <= formatISODate(new Date());
}

/** Persisted state from an older build can predate a streak item, so an entry
    may simply be absent. */
function localStreak(streaks: Streaks, item: StreakItem): StreakData {
    const entry = streaks?.[item];
    return isUsableStreak(entry) ? entry : emptyStreak();
}

function mergeStreakEntry(local: StreakData, remote: StreakData): StreakData {
    if (!remote.lastCompletedDate) return local;
    if (!local.lastCompletedDate) return remote;
    // Same day on both: whichever counted higher already accounts for the
    // other's history.
    if (local.lastCompletedDate === remote.lastCompletedDate) {
        return local.days >= remote.days ? local : remote;
    }

    const [earlier, later] = local.lastCompletedDate < remote.lastCompletedDate
        ? [local, remote]
        : [remote, local];
    // Consecutive days on two devices are one unbroken streak: praying Monday
    // on the phone and Tuesday on the laptop is two days, but neither device
    // can see that alone. A wider gap means the streak really did break, and
    // the later device's own count is the truth.
    const consecutive = daysApart(earlier.lastCompletedDate!, later.lastCompletedDate!) === 1;
    return {
        days: consecutive ? Math.max(later.days, earlier.days + 1) : later.days,
        lastCompletedDate: later.lastCompletedDate,
    };
}

/** Folds a snapshot from another device into this one's streaks. Unusable or
    missing entries leave the local value untouched. */
export function mergeStreaks(local: Streaks, remote: unknown): Streaks {
    const incoming = (remote && typeof remote === 'object' ? remote : {}) as Record<string, unknown>;
    const merged = { ...local };
    for (const item of STREAK_ITEMS) {
        const mine = localStreak(local, item);
        const entry = incoming[item];
        merged[item] = isUsableStreak(entry) ? mergeStreakEntry(mine, entry) : mine;
    }
    return merged;
}

export function streaksEqual(a: Streaks, b: Streaks): boolean {
    return STREAK_ITEMS.every((item) => {
        const x = localStreak(a, item);
        const y = localStreak(b, item);
        return x.days === y.days && x.lastCompletedDate === y.lastCompletedDate;
    });
}

// ── Synced settings ──────────────────────────────────────────────────────
// Only what a person decides once and means everywhere: the reading face and
// how much of the rosary they want spelled out. Both are about the reader, not
// the hardware.
// Deliberately excluded: theme, fontSize and autoScrollSpeed, which answer to
// the screen rather than the person — a size that reads well on a phone is
// cramped on a desktop, "dark" is a judgement about the room the device is in,
// and the scroll speed is in px/s, so the same number crawls on a tall screen
// and races on a short one. Also excluded: notificationTime and hourReminders
// (a reminder is a property of the device meant to buzz, and syncing them
// would fire the same notification on every signed-in device), pushSubscribed
// and shareStreaks (device-level by design), and session/cache state.
// The starred prayers and hymns travel too, but not through here: a list is
// merged entry by entry rather than settled by whoever wrote last — see the
// favourites section below.

export interface SyncedSettings {
    fontFamily: FontFamily;
    rosaryMode: RosaryBeadMode;
}

const FONT_FAMILIES: FontFamily[] = ['system', 'serif', 'sans'];
const ROSARY_MODES: RosaryBeadMode[] = ['beginner', 'advanced'];

/** The interface's keys, at runtime — a snapshot is compared and checked for
    completeness against this, so a field added to SyncedSettings has to be
    added here too. */
const SYNCED_SETTING_KEYS: readonly (keyof SyncedSettings)[] = ['fontFamily', 'rosaryMode'];

/** Keeps only the values this version understands: a snapshot written by a
    newer build (or a corrupted one) must not put the store in a state the UI
    can't render. Snapshots from a build that still synced theme, fontSize and
    autoScrollSpeed are handled by the same rule — the keys are simply dropped,
    so an old device can't reach in and restyle this one. */
export function sanitizeSyncedSettings(raw: unknown): Partial<SyncedSettings> {
    if (!raw || typeof raw !== 'object') return {};
    const input = raw as Record<string, unknown>;
    const out: Partial<SyncedSettings> = {};
    if (FONT_FAMILIES.includes(input.fontFamily as FontFamily)) out.fontFamily = input.fontFamily as FontFamily;
    if (ROSARY_MODES.includes(input.rosaryMode as RosaryBeadMode)) out.rosaryMode = input.rosaryMode as RosaryBeadMode;
    return out;
}

/** Whether a sanitized snapshot carries every setting this version syncs.
    A partial one must not be adopted: applySyncedSettings would take its
    timestamp while leaving the missing field at this device's value, so the
    relay's incomplete entry would outrank a good local edit — and the pull
    returns without publishing, so nothing repairs it until the round trip
    after. Treated as no snapshot at all, it gets published over instead. */
export function isCompleteSyncedSettings(settings: Partial<SyncedSettings>): settings is SyncedSettings {
    return SYNCED_SETTING_KEYS.every((key) => settings[key] !== undefined);
}

export function settingsEqual(a: SyncedSettings, b: Partial<SyncedSettings>): boolean {
    return SYNCED_SETTING_KEYS.every((key) => a[key] === b[key]);
}

/** Devices don't agree on the clock to the second, so allow a little slack
    before calling a timestamp from another one impossible. Shared by the
    settings sync and the favourites below — both let a timestamp decide, and
    both have to refuse one that can only have come from a wrong clock. */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

// ── Favourites ───────────────────────────────────────────────────────────
// A starred prayer or hymn says what *this reader* comes back to, so it
// belongs to the person rather than to the device it was starred on. Unlike
// the settings above it can't be settled by last-write-wins: starring on the
// phone and on the laptop in the same afternoon would throw one of the two
// lists away wholesale. So every id carries the moment it was last toggled
// and which way — two devices then merge entry by entry, and an unstar
// travels the same way a star does instead of being quietly undone by the
// other device's copy of the list.

/** When an id was last starred or unstarred, and to which of the two. */
export interface FavouriteEntry {
    /** Epoch ms of that toggle. Also the sort key — the list reads newest
        first, which is the order the shortlist has always been shown in. */
    at: number;
    on: boolean;
}

/** id → its last toggle. An entry with `on: false` is a tombstone, and it is
    what tells another device the star was taken away rather than never
    having arrived. */
export type FavouriteLog = Record<string, FavouriteEntry>;

// Both catalogues are a couple of hundred entries, so a log past this size is
// not a shortlist — it is a corrupted or hostile snapshot off a relay.
const MAX_FAVOURITE_ENTRIES = 500;
const MAX_FAVOURITE_ID = 64;

/** Keys that mean something to an object rather than naming a prayer.
    Assigning `__proto__` on an object literal runs the inherited setter and
    swaps that object's prototype instead of adding an entry — the entry then
    isn't there, and the log is left a shape nothing expects. `constructor`
    and `prototype` only shadow, but no catalogue id looks like any of the
    three, so the honest answer to all of them is the same. */
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

/** Whether an id can be used as a key in a log. Ids reach here from a relay
    snapshot and from persisted storage — neither is this code's own choice,
    so both go through the same door. */
function isUsableFavouriteId(id: unknown): id is string {
    return typeof id === 'string' && id.length > 0
        && id.length <= MAX_FAVOURITE_ID && !RESERVED_IDS.has(id);
}

/** The starred ids, newest first — what the Devocionário and the Cânticos
    render. Ties break on the id, so the order is stable rather than left to
    the order the object happened to be built in. */
export function starredIds(log: FavouriteLog): string[] {
    return Object.entries(log)
        .filter(([, entry]) => entry.on)
        .sort(([idA, a], [idB, b]) => (b.at - a.at) || (idA < idB ? -1 : 1))
        .map(([id]) => id);
}

export function isStarred(log: FavouriteLog, id: string): boolean {
    return log[id]?.on === true;
}

/** Stars an id, or unstars it — stamped now, which is what decides it against
    another device's copy of the same id. */
export function toggleFavourite(log: FavouriteLog, id: string, now: number = Date.now()): FavouriteLog {
    return { ...log, [id]: { at: now, on: !isStarred(log, id) } };
}

/** Keeps a log to its newest entries, so neither a merge nor a relay payload
    can grow without bound. */
function capLog(log: FavouriteLog): FavouriteLog {
    const entries = Object.entries(log);
    if (entries.length <= MAX_FAVOURITE_ENTRIES) return log;
    // Ties break on the id, as in starredIds. What survives a cap is
    // published, so two devices holding the same entries in a different key
    // order have to drop the same ones — otherwise each would keep restoring
    // what the other had just cut.
    return Object.fromEntries(
        entries
            .sort(([idA, a], [idB, b]) => (b.at - a.at) || (idA < idB ? -1 : 1))
            .slice(0, MAX_FAVOURITE_ENTRIES),
    );
}

/** Only what this version can act on. Relays hand back whatever they hold,
    and an entry stamped in the future would otherwise outrank every star and
    unstar made here afterwards — freezing that prayer's state forever, the
    same trap the settings timestamp is guarded against above. */
export function sanitizeFavouriteLog(raw: unknown, now: number = Date.now()): FavouriteLog {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const log: FavouriteLog = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!isUsableFavouriteId(id)) continue;
        if (!value || typeof value !== 'object') continue;
        const { at, on } = value as FavouriteEntry;
        if (typeof on !== 'boolean') continue;
        if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) continue;
        if (at > now + CLOCK_SKEW_TOLERANCE_MS) continue;
        log[id] = { at, on };
    }
    return capLog(log);
}

/** Folds another device's log into this one's, entry by entry: the newer
    toggle wins. A tie keeps the star — a star that vanishes is a loss the
    reader has to notice to repair, while one that lingers is a single tap
    from gone. */
export function mergeFavouriteLogs(local: FavouriteLog, remote: FavouriteLog): FavouriteLog {
    const merged: FavouriteLog = { ...local };
    for (const [id, entry] of Object.entries(remote)) {
        const mine = merged[id];
        if (!mine || entry.at > mine.at || (entry.at === mine.at && entry.on)) merged[id] = entry;
    }
    return capLog(merged);
}

export function favouriteLogsEqual(a: FavouriteLog, b: FavouriteLog): boolean {
    const ids = Object.keys(a);
    if (ids.length !== Object.keys(b).length) return false;
    return ids.every((id) => b[id]?.at === a[id].at && b[id]?.on === a[id].on);
}

/** Where favourites starred before this build land on the timeline.
    Deliberately in the past: those lists carry no times of their own, so
    anything the reader has done since — on this device or another — has to
    outrank them. */
const LEGACY_FAVOURITE_AT = Date.UTC(2020, 0, 1);

/** The pre-log list as a log. Stars only, never tombstones: two devices
    upgrading independently should end up holding both shortlists, not with
    whichever syncs second deleting what the other had kept. The array's own
    order (newest first) is preserved. */
export function seedFavouriteLog(ids: unknown): FavouriteLog {
    if (!Array.isArray(ids)) return {};
    const log: FavouriteLog = {};
    ids.slice(0, MAX_FAVOURITE_ENTRIES).forEach((id, index) => {
        if (isUsableFavouriteId(id)) {
            log[id] = { at: LEGACY_FAVOURITE_AT - index * 1000, on: true };
        }
    });
    return log;
}

export type ChapletMode = 'guiado' | 'resumido';
export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'system' | 'serif' | 'sans';

// Autoscroll speed levels (px/s). 1 is the reference reading pace and the
// fractions below it are literally that fraction of it — meditative crawls
// for a slow, prayed reading. Above 1 the steps widen faster than the label
// suggests, which is how they read on a phone.
// Lives here (like CONTENT_FONT_SCALE) because the Missa and Liturgia das
// Horas pages and the Profile speed picker all render from it.
const BASE_PPS = 22;

export const SCROLL_LEVELS = [
    { label: '¼', pps: BASE_PPS / 4 },
    { label: '⅓', pps: BASE_PPS / 3 },
    { label: '½', pps: BASE_PPS / 2 },
    { label: '¾', pps: (BASE_PPS * 3) / 4 },
    { label: '1', pps: BASE_PPS },
    { label: '2', pps: 42 },
    { label: '3', pps: 72 },
] as const;

/** A chosen speed, stored by label rather than by position in SCROLL_LEVELS:
    levels get inserted (¼, ⅓ and ¾ all arrived after the first release) and a
    stored index would quietly mean a slower pace every time one did. */
export type AutoScrollSpeed = typeof SCROLL_LEVELS[number]['label'];

/** Where a reader who has never touched the setting starts. */
export const DEFAULT_SCROLL_SPEED: AutoScrollSpeed = '2';

const SCROLL_LABELS: readonly AutoScrollSpeed[] = SCROLL_LEVELS.map((level) => level.label);

/** The position of a stored speed, for the SCROLL_LEVELS lookup and for the
    +/- controls to step from. Persisted values rehydrate from JSON
    unvalidated, so an unknown one falls back to the default rather than
    indexing out of bounds. */
export function scrollLevelIndex(speed: unknown): number {
    const index = SCROLL_LABELS.indexOf(speed as AutoScrollSpeed);
    return index === -1 ? SCROLL_LABELS.indexOf(DEFAULT_SCROLL_SPEED) : index;
}

/** The speed at a position, clamped — what the +/- controls store after a
    step off either end of the scale. */
export function scrollSpeedAt(index: number): AutoScrollSpeed {
    return SCROLL_LABELS[Math.min(Math.max(index, 0), SCROLL_LABELS.length - 1)];
}

/** The scales speeds used to be persisted as indices into, newest first.
    v0 shipped four levels; v1 added ¼ and ¾; v2 stores the label instead, so
    this table stops growing here. */
const INDEXED_SCROLL_SCALES: Record<number, readonly AutoScrollSpeed[]> = {
    0: ['½', '1', '2', '3'],
    1: ['¼', '½', '¾', '1', '2', '3'],
};

/** Reads a speed persisted by an older build. Until v2 it was an index, so
    every level inserted since shifted what a stored number means — resolve it
    against the scale that build actually had, rather than letting a reader on
    '2' come back on ⅓. Anything unrecognised falls back to the default, the
    same as a corrupted value would. */
export function migrateScrollSpeed(stored: unknown, version: number): AutoScrollSpeed {
    const scale = INDEXED_SCROLL_SCALES[version];
    if (scale) {
        return typeof stored === 'number' ? scale[stored] ?? DEFAULT_SCROLL_SPEED : DEFAULT_SCROLL_SPEED;
    }
    return SCROLL_LABELS.includes(stored as AutoScrollSpeed) ? stored as AutoScrollSpeed : DEFAULT_SCROLL_SPEED;
}

// Single source of truth for the content (prayer/reading) text scale.
// Each step pairs a reading size (px) with a line-height tuned for it.
// Consumed by Layout (applies the CSS variables) and Profile (size picker preview).
export const CONTENT_FONT_SCALE: Record<FontSize, { size: number; lineHeight: number }> = {
    small: { size: 18, lineHeight: 1.7 },
    medium: { size: 21, lineHeight: 1.65 },
    large: { size: 26, lineHeight: 1.6 },
    xlarge: { size: 32, lineHeight: 1.5 },
};

interface AppState {
    rosaryMode: RosaryBeadMode;
    setRosaryMode: (mode: RosaryBeadMode) => void;
    toggleRosaryMode: () => void;
    rosarySession: RosarySession | null;
    setRosarySession: (session: RosarySession | null) => void;
    /** A page is using the bottom of the screen for its own controls, so the
        floating tab bar should get out of the way — the same arrangement a
        rosary session already gets, for the same two reasons: the bar covers
        the content, and a tap meant for it navigates away instead.
        Transient: never persisted, and cleared when the page unmounts. */
    bottomBarYielded: boolean;
    setBottomBarYielded: (yielded: boolean) => void;
    streaks: Streaks;
    incrementStreak: (item: StreakItem) => void;
    /** Replaces the whole set — used by the Nostr pull after merging. */
    setStreaks: (streaks: Streaks) => void;

    /** When the synced settings last changed on this device (epoch ms).
        Settings are last-write-wins, so this is what decides a conflict. */
    settingsUpdatedAt: number;
    /** True when the last settings change came from another device rather than
        this user, so the sync hook doesn't publish it straight back. Never
        persisted — it describes the last change, not the state. */
    settingsFromRemote: boolean;
    /** Applies a snapshot pulled from another device, adopting its timestamp
        rather than stamping "now" — otherwise every pull would look like a
        local edit and ping-pong back. */
    applySyncedSettings: (settings: Partial<SyncedSettings>, updatedAt: number) => void;

    // Publishing streaks to Nostr relays is opt-in (and encrypted) — prayer
    // activity is sensitive by default.
    shareStreaks: boolean;
    setShareStreaks: (share: boolean) => void;

    /** Prayers starred in the Devocionário. Read with `starredIds` for the
        list, `isStarred` for one prayer. Synced across this identity's devices
        when "Sincronizar entre dispositivos" is on — a shortlist is about the
        reader, not the screen — but merged entry by entry rather than through
        SyncedSettings, which only knows how to let one side win. */
    prayerFavourites: FavouriteLog;
    togglePrayerFavourite: (id: string) => void;
    /** Hymns starred in the Cânticos section, kept and merged the same way. */
    chantFavourites: FavouriteLog;
    toggleChantFavourite: (id: string) => void;
    /** True when the last favourites change came from the merge with another
        device rather than from a tap here, so the sync hook doesn't publish it
        straight back. Never persisted — it describes the last change, not the
        state. */
    favouritesFromRemote: boolean;
    /** Adopts the logs merged with another device's. */
    applyFavourites: (prayers: FavouriteLog, chants: FavouriteLog) => void;

    /** How the Coroas play: 'guiado' walks every bead, 'resumido' lays the
        whole chaplet on one page for those who count on their own beads.
        Device-local — it answers to how you pray on *this* device. */
    chapletMode: ChapletMode;
    setChapletMode: (mode: ChapletMode) => void;

    // Preferences
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    notificationTime: string | null;
    setNotificationTime: (time: string | null) => void;
    /** Liturgy of the Hours reminders: canonical-hour id → "HH:MM". A missing
        key means that Hour is not being reminded. */
    hourReminders: Record<string, string>;
    setHourReminder: (hourId: string, time: string | null) => void;
    // True while this browser holds a server-registered Web Push
    // subscription; the in-app reminder timer stands down then.
    pushSubscribed: boolean;
    setPushSubscribed: (subscribed: boolean) => void;
    liturgicalColor: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa';
    liturgicalDayName: string | null;
    liturgicalDescription: string | null;
    /** The description as the publisher classified it. Null for a day
        published before sections existed — render `liturgicalDescription`. */
    liturgicalSections: DaySection[] | null;
    liturgicalColorDate: string | null;
    /** Today's day info, whole: the fields travel together and are read
        together, and four positional arguments of the same type were one
        transposition away from a day that says the wrong thing. */
    setLiturgicalDay: (date: string, info: LiturgicalDayInfo) => void;
    // Page-level theme override while browsing another day's liturgy
    // (e.g. Missa on a past/future date). Never persisted — a stale override
    // must not outlive the page that set it.
    liturgicalColorOverride: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa' | null;
    setLiturgicalColorOverride: (color: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa' | null) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    fontFamily: FontFamily;
    setFontFamily: (family: FontFamily) => void;
    autoScrollSpeed: AutoScrollSpeed;
    setAutoScrollSpeed: (speed: AutoScrollSpeed) => void;
}

/** The shape this build persists. Bumping it runs `migrateAppState` on every
    device holding an older one — and on any holding a newer one, which is the
    less obvious half. */
const PERSIST_VERSION = 3;

/**
 * Reads state persisted by a different version of this build.
 *
 * Zustand runs this whenever the stored version *differs* from
 * PERSIST_VERSION, which is not the same as "is older": a build rolled back
 * (or a PWA still serving a cached bundle) meets state written by the newer
 * one, and arrives here with a version above its own. So each step below has
 * to say which versions it is for, rather than assuming it is only ever
 * catching up.
 */
export function migrateAppState(persisted: unknown, version: number): AppState {
    // The two arrays v3 replaced. Pulled out of the spread as well as read, so
    // an upgraded device stops carrying a shortlist nothing reads any more.
    const { favouritePrayers, favouriteChants, ...state } = (persisted ?? {}) as Partial<AppState> & {
        favouritePrayers?: unknown;
        favouriteChants?: unknown;
    };
    // Only a device coming from before v3 has arrays to seed from. Seeding
    // unconditionally would hand a rolled-back build an empty shortlist and
    // delete the logs it already had — and would do the same to everyone the
    // day this version is bumped to 4 for something unrelated.
    const beforeLogs = version < 3;
    return {
        ...state,
        autoScrollSpeed: migrateScrollSpeed(state.autoScrollSpeed, version),
        prayerFavourites: beforeLogs ? seedFavouriteLog(favouritePrayers) : state.prayerFavourites ?? {},
        chantFavourites: beforeLogs ? seedFavouriteLog(favouriteChants) : state.chantFavourites ?? {},
    } as AppState;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            rosaryMode: 'beginner',
            setRosaryMode: (rosaryMode) => set({ rosaryMode, settingsUpdatedAt: Date.now(), settingsFromRemote: false }),
            toggleRosaryMode: () => set((state) => ({
                rosaryMode: state.rosaryMode === 'beginner' ? 'advanced' : 'beginner',
                settingsUpdatedAt: Date.now(),
                settingsFromRemote: false,
            })),
            rosarySession: null,
            setRosarySession: (rosarySession) => set({ rosarySession }),

            bottomBarYielded: false,
            setBottomBarYielded: (bottomBarYielded) => set({ bottomBarYielded }),
            shareStreaks: false,
            setShareStreaks: (shareStreaks) => set({ shareStreaks }),

            chapletMode: 'guiado',
            setChapletMode: (chapletMode) => set({ chapletMode }),
            prayerFavourites: {},
            togglePrayerFavourite: (id) => set((state) => ({
                prayerFavourites: toggleFavourite(state.prayerFavourites, id),
                favouritesFromRemote: false,
            })),
            chantFavourites: {},
            toggleChantFavourite: (id) => set((state) => ({
                chantFavourites: toggleFavourite(state.chantFavourites, id),
                favouritesFromRemote: false,
            })),
            favouritesFromRemote: false,
            applyFavourites: (prayerFavourites, chantFavourites) => set({
                prayerFavourites, chantFavourites, favouritesFromRemote: true,
            }),

            // Default preferences
            theme: 'system',
            // Local-only, like fontSize and autoScrollSpeed below: no
            // settingsUpdatedAt stamp, so the sync hook never publishes it.
            setTheme: (theme) => set({ theme }),
            notificationTime: null,
            setNotificationTime: (notificationTime) => set({ notificationTime }),
            hourReminders: {},
            setHourReminder: (hourId, time) => set((state) => {
                const next = { ...state.hourReminders };
                if (time) next[hourId] = time; else delete next[hourId];
                return { hourReminders: next };
            }),
            pushSubscribed: false,
            setPushSubscribed: (pushSubscribed) => set({ pushSubscribed }),
            liturgicalColor: 'verde',
            liturgicalDayName: null,
            liturgicalDescription: null,
            liturgicalSections: null,
            liturgicalColorDate: null,
            setLiturgicalDay: (liturgicalColorDate, info) => set({
                liturgicalColor: info.color,
                liturgicalColorDate,
                liturgicalDayName: info.dayName,
                liturgicalDescription: info.description,
                liturgicalSections: info.sections ?? null,
            }),
            liturgicalColorOverride: null,
            setLiturgicalColorOverride: (liturgicalColorOverride) => set({ liturgicalColorOverride }),
            fontSize: 'medium',
            setFontSize: (fontSize) => set({ fontSize }),
            // Serif (Lora) by default: long-form liturgical text reads better
            // in a book face; the chrome stays in Inter regardless.
            fontFamily: 'serif',
            setFontFamily: (fontFamily) => set({ fontFamily, settingsUpdatedAt: Date.now(), settingsFromRemote: false }),
            autoScrollSpeed: DEFAULT_SCROLL_SPEED,
            setAutoScrollSpeed: (autoScrollSpeed) => set({ autoScrollSpeed }),
            streaks: emptyStreaks(),
            incrementStreak: (item) => set((state) => {
                const userToday = formatISODate(new Date());

                const currentStreak = state.streaks[item] ?? emptyStreak();

                if (currentStreak.lastCompletedDate === userToday) {
                    // Already completed today, no streak increment needed.
                    return { streaks: state.streaks };
                }

                let newDays = 1;
                if (currentStreak.lastCompletedDate) {
                    const lastDate = new Date(currentStreak.lastCompletedDate);
                    const currentDate = new Date(userToday);
                    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        // Completed yesterday
                        newDays = currentStreak.days + 1;
                    }
                    // If diffDays > 1, Missed a day, streak resets to 1 (which is the default of newDays)
                }

                return {
                    streaks: {
                        ...state.streaks,
                        [item]: { days: newDays, lastCompletedDate: userToday }
                    }
                };
            }),
            setStreaks: (streaks) => set({ streaks }),
            settingsUpdatedAt: 0,
            settingsFromRemote: false,
            applySyncedSettings: (settings, updatedAt) => set({
                ...settings,
                settingsUpdatedAt: updatedAt,
                settingsFromRemote: true,
            })
        }),
        {
            name: 'mora-app-storage',
            // The override is transient page state; persisting it would leave
            // a wrong theme stuck after a hard close mid-browse.
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) =>
                    key !== 'liturgicalColorOverride' && key !== 'settingsFromRemote'
                    && key !== 'favouritesFromRemote'
                    // Transient UI state. Persisting it would restore a
                    // hidden tab bar on a page that has no keyboard.
                    && key !== 'bottomBarYielded')
            ) as Omit<AppState, 'liturgicalColorOverride' | 'settingsFromRemote' | 'favouritesFromRemote' | 'bottomBarYielded'>,
            // v1 inserted ¼ and ¾ into SCROLL_LEVELS and v2 stopped storing
            // autoScrollSpeed as an index into it — see migrateScrollSpeed.
            // v3 turned the two favourites arrays into logs — see
            // seedFavouriteLog.
            version: PERSIST_VERSION,
            migrate: migrateAppState,
        }
    )
);
