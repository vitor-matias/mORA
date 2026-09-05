import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, ExternalLink, Gamepad2, History, Loader2, TriangleAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DateNav } from '@/components/DateNav';
import { ShareToNostr } from '@/components/palavra/ShareToNostr';
import { Community } from '@/components/palavra/Community';
import { Grid, type PlayedRow } from '@/components/palavra/Grid';
import { HowToPlay } from '@/components/palavra/HowToPlay';
import { gapPx } from '@/lib/palavra/layout';
import { capuchinhosUrl } from '@/lib/palavra/bookSlugs';
import { Keyboard } from '@/components/palavra/Keyboard';
import { ResultSheet } from '@/components/palavra/ResultSheet';
import { fetchDailyChallenge, PALAVRA_IS_MOCK } from '@/lib/palavra/api';
import {
    deobfuscateAnswer,
    emojiGrid,
    keyboardState,
    matchesAnswerHash,
    normalizeWord,
    scoreGuess,
} from '@/lib/palavra/game';
import { BLANK_MARKER, MAX_GUESSES, type DailyChallenge } from '@/lib/palavra/types';
import { derivePalavraStats, isFinished, sharesResults, usePalavraStore } from '@/store/palavra';
import { currentPubkey, useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';
import { formatUTCDate } from '@/lib/format';
import { appUrl } from '@/lib/appUrl';
import { useDayRollover } from '@/lib/useDayRollover';
import { useTranslations } from '@/lib/i18n';

const EMPTY_PLAY = { guesses: [] as string[], solved: false, ms: 0 };

/** Air under the keyboard, so the last row never sits flush against a gesture
    bar, plus a couple of pixels for rounding: each row's height comes from
    `aspect-ratio` on a fractional tile width, so six rows round up slightly
    past what the arithmetic predicts. */
const BOARD_BREATHING_PX = 8;

/** Below this the board can't fit whatever we do; it stops shrinking and the
    page scrolls, which beats a board collapsed to nothing. */
const MIN_TILE_PX = 26;

/** Long enough that a burst of guesses is one write, short enough that closing
    the app after a guess still leaves the board backed up. */
const IN_PROGRESS_SYNC_DEBOUNCE_MS = 3_000;

type PageTab = 'game' | 'social';

const PAGE_TAB_ICON: Record<PageTab, typeof Gamepad2> = { game: Gamepad2, social: Users };

export default function Palavra() {
    const [today, setToday] = useState(() => formatUTCDate(new Date()));
    // Which puzzle is on screen. Anything before today is the archive, played
    // for practice only — see PalavraScope in the store.
    const [viewDate, setViewDate] = useState(today);
    const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    // The typing buffer lives in a ref, with `draft` as its render mirror.
    // Reading it from a closure instead would submit a stale word whenever
    // several key events land in one task — React hasn't re-rendered between
    // them, so the Enter handler would still see the buffer as it was before
    // the letters. The ref is always current.
    const draftRef = useRef('');
    const [draft, setDraft] = useState('');
    const [rejected, setRejected] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const t = useTranslations().palavra;
    const [pageTab, setPageTab] = useState<PageTab>('game');
    // Whether the social half has ever been opened. It mounts lazily and then
    // stays mounted, hidden — the same bargain Community strikes with its own
    // four panels, and it has to be struck out here too or Community's
    // `visited` set dies with it: unmounting on every hop back to the game
    // re-ran the whole relay fan-out on the next hop over, the monthly read
    // included, and that one is five filters wide. Never mounted at all for a
    // player who only ever plays the game.
    const [socialSeen, setSocialSeen] = useState(false);
    const openPageTab = useCallback((id: PageTab) => {
        setPageTab(id);
        if (id === 'social') setSocialSeen(true);
    }, []);

    const writeDraft = useCallback((next: string) => {
        draftRef.current = next;
        setDraft(next);
    }, []);

    const myPubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey ?? null);
    const signedIn = Boolean(myPubkey);
    const sharing = usePalavraStore((s) => sharesResults(s, myPubkey));
    const plays = usePalavraStore((s) => s.plays);
    const practice = usePalavraStore((s) => s.practice);
    const beginPlay = usePalavraStore((s) => s.beginPlay);
    const submitGuess = usePalavraStore((s) => s.submitGuess);
    const sharedNotes = usePalavraStore((s) => s.sharedNotes);
    const markNoteShared = usePalavraStore((s) => s.markNoteShared);
    const markTutorialSeen = usePalavraStore((s) => s.markTutorialSeen);
    // Lazy initial value, not an effect: the persisted flag is already
    // hydrated by the time this component first renders (synchronous
    // localStorage), so reading it once here is the whole check — an effect
    // would only add a render where the explainer flashes in a beat late.
    const [showHowToPlay, setShowHowToPlay] = useState(() => !usePalavraStore.getState().seenTutorial);
    const closeHowToPlay = useCallback(() => {
        setShowHowToPlay(false);
        markTutorialSeen();
    }, [markTutorialSeen]);

    const isArchive = viewDate !== today;

    // An archive day the player already answered on the day itself keeps that
    // real result — replaying it for practice would paper over their record
    // with a second attempt they can't unsee.
    const recorded = plays[viewDate];
    const scope = isArchive && !recorded ? 'practice' : 'daily';
    const play = (isArchive ? (recorded ?? practice[viewDate]) : plays[viewDate]) ?? EMPTY_PLAY;
    const over = isFinished(play);
    // A recorded archive day is history: shown, not replayable.
    const readOnly = isArchive && Boolean(recorded);
    // Whether *today* is done, which is not what `over` says while an archive
    // day is on screen — there `play` is the archived day's. The month board
    // sums today's guess counts, so that is the question it has to ask.
    const finishedToday = isFinished(plays[today] ?? EMPTY_PLAY);

    // A PWA resumed from the background can be days behind; re-anchor and
    // re-fetch rather than leave yesterday's puzzle on screen. Only moves the
    // view if it was following today — someone reading the archive stays put.
    useDayRollover(() => formatUTCDate(new Date()), () => {
        const next = formatUTCDate(new Date());
        setViewDate((current) => {
            if (current !== today) return current;
            // Clear the board too, the way goToDate does. Leaving yesterday's
            // challenge mounted while viewDate has already advanced makes the
            // page key two ways at once: beginPlay and the play record use the
            // new date, but onEnter still submits against challenge.date. A
            // guess in that window lands in yesterday's record, and the result
            // published from it is for the wrong day.
            setChallenge(null);
            setLoadError(null);
            return next;
        });
        setToday(next);
        writeDraft('');
    });

    // Moving to another day clears the board here, in the event handler,
    // rather than in the fetch effect — clearing there would be a synchronous
    // setState on every mount, and would blank a working board on a refetch.
    const goToDate = useCallback((next: string) => {
        if (next > formatUTCDate(new Date())) return; // no puzzles ahead of today
        setViewDate(next);
        setChallenge(null);
        setLoadError(null);
        writeDraft('');
    }, [writeDraft]);

    const shiftDay = useCallback((delta: number) => {
        // Parsed and stepped as UTC, to match how puzzle days are identified.
        const date = new Date(`${viewDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + delta);
        goToDate(formatUTCDate(date));
    }, [viewDate, goToDate]);

    useEffect(() => {
        let cancelled = false;
        fetchDailyChallenge(viewDate)
            .then((next) => {
                if (cancelled) return;
                setChallenge(next);
                setLoadError(null);
            })
            .catch((error: unknown) => {
                console.warn('Could not load the challenge.', error);
                if (!cancelled) {
                    setLoadError(error instanceof Error ? error.message : t.loadFailed);
                }
            });
        return () => { cancelled = true; };
    }, [viewDate, t]);

    // The answer only exists locally, recovered from the day's cipher, in two
    // forms: the real Portuguese spelling for the reveal ("SALVAÇÃO") and the
    // folded one the board is scored against ("SALVACAO").
    const answerDisplay = useMemo(
        () => (challenge ? deobfuscateAnswer(challenge.date, challenge.answerCipher) : ''),
        [challenge],
    );

    // An empty answer means the payload didn't decode; a hash mismatch means it
    // decoded to the wrong word. Either way the board is unplayable, and the
    // error state below says so rather than scoring every guess against
    // nonsense. Checking the hash here also catches a server whose
    // normalization drifts from normalizeWord — the one mismatch that would
    // otherwise make the day quietly unwinnable.
    const answer = useMemo(() => {
        if (!challenge || !answerDisplay) return '';
        const folded = normalizeWord(answerDisplay);
        if (folded.length !== challenge.length) return '';
        return matchesAnswerHash(challenge.date, folded, challenge.answerHash) ? folded : '';
    }, [challenge, answerDisplay]);

    // Start the clock the first time the board is actually playable — but not
    // while the how-to-play explainer covers it: submitGuess measures `ms`
    // from this moment, and a first-time player reading the rules before
    // their first guess isn't part of their solve time. Harmless once the
    // clock is already running (beginPlay itself no-ops on a startedAt that
    // exists), so reopening the explainer mid-game doesn't pause anything.
    useEffect(() => {
        if (challenge && answer && !over && !readOnly && !showHowToPlay) beginPlay(viewDate, scope);
    }, [challenge, answer, over, readOnly, showHowToPlay, viewDate, scope, beginPlay]);

    const played: PlayedRow[] = useMemo(
        () => (answer ? play.guesses.map((guess) => ({ guess, marks: scoreGuess(guess, answer) })) : []),
        [play.guesses, answer],
    );

    const keys = useMemo(
        () => (answer ? keyboardState(play.guesses, answer) : {}),
        [play.guesses, answer],
    );

    const stats = useMemo(() => derivePalavraStats(plays), [plays]);

    const flashNotice = useCallback((message: string) => {
        setNotice(message);
        setRejected(true);
        window.setTimeout(() => setRejected(false), 400);
        window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 2200);
    }, []);

    // Back up an *unfinished* game too.
    //
    // The result publish below only fires when a game ends, so a board left
    // half-played — one guess in, then the app closed — stayed on the device
    // that made it. Picking it up on another device is the whole point of the
    // encrypted log: the same puzzle continued where it was left.
    //
    // Debounced, because six guesses in a row would otherwise be six relay
    // writes for a payload only the last one needs. Daily games only: practice
    // runs are deliberately local, and the snapshot never carries them.
    const guessCount = play.guesses.length;
    useEffect(() => {
        if (scope !== 'daily' || guessCount === 0 || over) return;
        const timer = window.setTimeout(async () => {
            try {
                const { publishPalavraStateToNostr } = await import('@/lib/palavra/nostr');
                await publishPalavraStateToNostr();
            } catch (error) {
                // The game is recorded locally either way; the next sync
                // carries it.
                console.warn('Could not back up the game in progress.', error);
            }
        }, IN_PROGRESS_SYNC_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [guessCount, scope, over]);

    // Publishing reaches the network, so it stays out of the render path, and
    // the ref makes sure a slow relay can't have it run twice for the same day.
    // Practice runs never reach it: an archive game is not a result.
    const publishedFor = useRef<string | null>(null);
    // Whether today's result has become published — however that happened,
    // see the comment inside reportResult below — so the community panels
    // reload and the player sees themselves on the board. Read straight from
    // the store rather than a local counter bumped from one call site: that
    // was what left players invisible until a reload when this page's own
    // publish attempt was the one that stalled.
    const resultsVersion = usePalavraStore((s) =>
        myPubkey && challenge ? Number(Boolean(s.publishedResults[`${myPubkey}:${challenge.date}`])) : 0);
    const reportResult = useCallback(async () => {
        if (!challenge || scope !== 'daily') return;
        if (publishedFor.current === challenge.date) return;
        publishedFor.current = challenge.date;

        // The encrypted log (so other devices see this game) and, if the
        // player opted in, the public result the social views read.
        // Best-effort and after the fact — the game is already recorded
        // locally, so nothing here can cost them the play.
        try {
            const { publishPalavraStateToNostr, publishPalavraResult } = await import('@/lib/palavra/nostr');
            const record = usePalavraStore.getState().plays[challenge.date];
            const [, published] = await Promise.allSettled([
                publishPalavraStateToNostr(),
                record ? publishPalavraResult(challenge.date, record) : Promise.resolve(false),
            ]);
            // Only when the public result genuinely reached a relay. Marking
            // unconditionally — which is what putting this after the try did —
            // would tell the next foreground the result is already out there
            // on a failed publish, an import that never loaded, or a player
            // who hasn't opted into sharing — and it would never retry.
            //
            // `allSettled` is why the return value has to be read rather than
            // the absence of a throw: it swallows a rejection into a settled
            // entry, so awaiting it says nothing about what happened.
            //
            // Marked here rather than tracked in a local ref: the background
            // sync (see publishTodaysResultIfMissing, which runs on every
            // foreground) marks the same flag when *it* is the one that lands
            // the publish — e.g. this attempt stalled on a slow relay and a
            // later foreground succeeded instead. resultsVersion above reads
            // this flag, so the board catches up either way, instead of only
            // when this exact call succeeds.
            if (published.status === 'fulfilled' && published.value === true) {
                const pubkey = currentPubkey();
                if (pubkey) usePalavraStore.getState().markResultPublished(pubkey, challenge.date);
            }
        } catch (error) {
            console.warn('Palavra Nostr publish skipped:', error);
        }
    }, [challenge, scope]);

    const onEnter = useCallback(() => {
        if (!challenge || !answer || readOnly) return;
        // Read the board from the store rather than this render's snapshot,
        // for the same reason the draft comes from a ref.
        const state = usePalavraStore.getState();
        const log = scope === 'daily' ? state.plays : state.practice;
        const current = log[challenge.date] ?? EMPTY_PLAY;
        if (isFinished(current)) return;

        const guess = normalizeWord(draftRef.current);
        if (guess.length < challenge.length) {
            flashNotice(t.wrongLength(challenge.length));
            return;
        }
        if (current.guesses.includes(guess)) {
            flashNotice(t.alreadyTried);
            return;
        }
        // The hash is the authority on winning; the deciphered answer is only
        // used to colour the tiles.
        const solved = matchesAnswerHash(challenge.date, guess, challenge.answerHash);
        submitGuess(challenge.date, guess, solved, scope);
        writeDraft('');

        const guesses = [...current.guesses, guess];
        if (solved || guesses.length >= MAX_GUESSES) {
            void reportResult();
        }
    }, [challenge, answer, readOnly, scope, submitGuess, writeDraft, flashNotice, reportResult, t]);

    const onLetter = useCallback((letter: string) => {
        if (!challenge || over || readOnly) return;
        if (draftRef.current.length >= challenge.length) return;
        writeDraft(draftRef.current + letter);
    }, [challenge, over, readOnly, writeDraft]);

    const onBackspace = useCallback(() => {
        writeDraft(draftRef.current.slice(0, -1));
    }, [writeDraft]);

    // The on-screen keyboard occupies the strip the floating tab bar floats
    // in, so ask the bar to stand down while it is up — its bottom row was
    // clipped by roughly 20px, and a miss on ENTER or backspace hit a nav tab
    // and left the game. Only while the keyboard actually renders: the
    // community tab and a finished board both want the bar back.
    // Gated on there actually being a board: loading, a load error and a
    // rejected payload all render no Keyboard, and hiding the tab bar for
    // them takes away navigation to make room for nothing.
    const keyboardUp = pageTab === 'game' && !over && Boolean(challenge) && !loadError;
    const setBottomBarYielded = useAppStore((s) => s.setBottomBarYielded);
    useEffect(() => {
        setBottomBarYielded(keyboardUp);
        return () => setBottomBarYielded(false);
    }, [keyboardUp, setBottomBarYielded]);

    // Desktop players expect to just type.
    useEffect(() => {
        // The board stays mounted behind the community tab (so the reveal
        // animation doesn't replay on every switch), but this listener is on
        // window — without the guard, typing while reading the leaderboard
        // would fill in a board nobody can see.
        if (pageTab !== 'game') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            // DateNav renders a date input on this tab. Typing in it also
            // reached the board, and Enter submitted a guess.
            const target = event.target as HTMLElement | null;
            if (target?.isContentEditable
                || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
            const letter = normalizeWord(event.key);
            const handled = event.key === 'Enter' || event.key === 'Backspace' || letter.length === 1;
            if (!handled) return;

            // A button clicked earlier still holds focus — a date arrow, a
            // section tab — and Enter or Space on a focused button is a click.
            // Reported from a real game: Enter submitted the guess *and* paged
            // the day, because the calendar button was still focused.
            //
            // Blurring alone doesn't fix it. The click is the default action
            // of this very keydown, so it is already on its way by the time
            // the handler runs; only preventDefault cancels it. Blur as well,
            // so the ring goes and the next keystroke starts clean.
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused !== document.body) {
                event.preventDefault();
                focused.blur();
            }

            if (event.key === 'Enter') { onEnter(); return; }
            if (event.key === 'Backspace') { onBackspace(); return; }
            onLetter(letter);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onEnter, onBackspace, onLetter, pageTab]);

    // How tall a tile may be, measured rather than assumed.
    //
    // The board used to size itself from `100vh` minus a constant standing in
    // for everything else on the page. That constant was wrong twice, because
    // what sits above the board changes with the verse's length, the reader's
    // font size, and the device. Measuring the gap between the top of the
    // board and the top of the keyboard is the same quantity, correct by
    // construction.
    //
    // No feedback loop: the board's top depends only on what is above it, and
    // the keyboard sizes itself from vh — neither moves when a tile resizes.
    const boardRef = useRef<HTMLDivElement>(null);
    const keyboardRef = useRef<HTMLDivElement>(null);
    const [maxTilePx, setMaxTilePx] = useState<number | undefined>(undefined);

    const measure = useCallback(() => {
        const board = boardRef.current;
        const keyboard = keyboardRef.current;
        // With no keyboard on screen — a finished game, an archive day —
        // nothing is competing for the space, so the board keeps its natural
        // size and the CSS cap alone applies.
        if (!board || !keyboard) { setMaxTilePx(undefined); return; }

        // Everything here stays in viewport coordinates. Adding
        // `window.scrollY` to the board's top mixed document coordinates into
        // a subtraction from `innerHeight`, so a remeasure taken while
        // scrolled shrank the board by the scroll offset — reproduced at
        // 412x760: a resize at scroll 60 took tiles from 41px to 33px.
        const boardBox = board.getBoundingClientRect();
        // Board bottom to keyboard bottom. Measured between two elements
        // rather than derived from the page height: `scrollHeight` stops
        // shrinking once the page fits, so subtracting from it made this
        // figure *grow* as the board shrank and drove the size into the floor.
        // Between two elements it is stable — shrink the board and both edges
        // move up together.
        const below = keyboard.getBoundingClientRect().bottom - boardBox.bottom;
        const available = window.innerHeight - boardBox.top - below - BOARD_BREATHING_PX;
        const perTile = (available - gapPx() * (MAX_GUESSES - 1)) / MAX_GUESSES;
        // Floored, so a landscape phone gets a small board and a scroll rather
        // than one collapsed to nothing.
        setMaxTilePx(Math.max(MIN_TILE_PX, Math.floor(perTile)));
    }, []);

    // Subscriptions, set up once per layout-changing state. `maxTilePx` is
    // deliberately *not* a dependency here: it changes on every settling pass,
    // and re-running this would tear down and rebuild the resize listener and
    // the ResizeObserver each time for no benefit.
    useLayoutEffect(() => {
        measure();
        // Again after paint. The first pass runs before the browser has
        // finished laying out — web fonts in particular land later and change
        // every height above the board — so measuring only once converges on a
        // stale figure and leaves the board a pixel or two too tall.
        // Both frame ids, not just the outer one. Cancelling only the first
        // leaves the inner frame scheduled if cleanup lands between them, and
        // it then measures a board that has already unmounted.
        let innerRaf = 0;
        const raf = requestAnimationFrame(() => { innerRaf = requestAnimationFrame(measure); });
        window.addEventListener('resize', measure);
        const observer = new ResizeObserver(measure);
        if (boardRef.current) observer.observe(boardRef.current.parentElement ?? boardRef.current);
        return () => {
            cancelAnimationFrame(raf);
            cancelAnimationFrame(innerRaf);
            window.removeEventListener('resize', measure);
            observer.disconnect();
        };
    }, [challenge, over, pageTab, measure]);

    // The settling pass, split from the subscriptions above so it costs a
    // measurement and nothing else. Applying a size changes the layout the
    // next reading sees, so each value triggers one more pass. It terminates
    // because the space below the board doesn't depend on the board's own
    // height: the second pass computes what the third would, and the setState
    // bails on an unchanged value.
    useLayoutEffect(() => {
        if (maxTilePx === undefined) return;
        measure();
    }, [maxTilePx, measure]);

    // Installed to the home screen (Android WebAPK / iOS standalone). There,
    // an external link opened with target="_blank" doesn't reach the system
    // browser — it lands in a boxed-in in-app view with no way back except
    // closing it. A same-window navigation instead makes the OS hand the page
    // off to the real browser, leaving mORA behind the way switching apps
    // does. Only worth it inside the installed app: in an ordinary browser
    // tab, target="_blank" is what keeps mORA open behind the new one.
    const isInstalledApp = typeof window !== 'undefined' && (
        window.matchMedia?.('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );

    // Back to a link on the reference. The card already carries the finished
    // verse, so the separate full-verse box under it was the same text and the
    // same reference twice; what it didn't carry was the way out to the reader.
    const refUrl = useMemo(
        () => (challenge ? capuchinhosUrl(challenge.ref) : null),
        [challenge],
    );

    const shareText = useMemo(() => {
        if (!challenge || !over) return '';
        const score = play.solved ? `${play.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
        // No reference. The grid is the whole point of a Wordle share — it says
        // how you did without saying anything about the answer — and "João 1,1"
        // hands the day's word to every reader who hasn't played yet.
        return [
            t.shareHeading(challenge.date, score),
            '',
            emojiGrid(played.map((row) => row.marks)),
            '',
            // The same link the Nostr note carries. Wherever this lands — a
            // chat, a timeline — a grid with no way to reach the game is a
            // dead end for whoever reads it.
            appUrl(),
        ].join('\n');
    }, [challenge, over, play.solved, play.guesses.length, played, t]);

    // The verse split on every blank: n parts means n-1 gaps to render.
    const verseParts = challenge ? challenge.verse.split(BLANK_MARKER) : [''];

    // Rendered twice — in the desktop sidebar and in the mobile flow — the way
    // Missa and Horas handle their own date nav. Each DateNav instance owns
    // its picker input ref internally, so mounting two is safe.
    const dateNav = (
        <DateNav
            // Midday, so the label names the right calendar day whatever the
            // reader's offset: parsing the bare date as UTC midnight would
            // render as the previous day for anyone west of Greenwich.
            selectedDate={new Date(`${viewDate}T12:00:00Z`)}
            selectedDateStr={viewDate}
            isToday={!isArchive}
            onChangeDay={shiftDay}
            // The picked string, not the Date beside it. Puzzle days are UTC
            // days, and converting a local-midnight Date back to one lands on
            // the day before east of Greenwich — which put a Lisbon player on
            // Sunday every time they picked Monday, today included.
            onSelectDate={(_date, iso) => goToDate(iso)}
            // No future puzzles exist: the publisher refuses to publish ahead,
            // so tomorrow would only ever load as "no puzzle for this day".
            maxDateStr={today}
        />
    );

    // Rendered vertically in the desktop sidebar and horizontally above the
    // board on mobile, so it takes the orientation rather than being two
    // copies that can drift apart.
    const pageTabs = (vertical: boolean) => (
        <div
            role="tablist"
            aria-label={t.sections}
            className={vertical ? 'flex flex-col gap-1' : 'flex gap-1'}
        >
            {([{ id: 'game', label: t.tabGame }, { id: 'social', label: t.tabCommunity }] as const).map(({ id, label }) => {
                const Icon = PAGE_TAB_ICON[id];
                return (
                <button
                    key={id}
                    role="tab"
                    aria-selected={pageTab === id}
                    onClick={() => openPageTab(id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        vertical ? 'w-full justify-start' : 'flex-1 justify-center'
                    } ${
                        pageTab === id
                            ? 'bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300'
                            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                </button>
                );
            })}
        </div>
    );

    const notices = (
        <>
            {PALAVRA_IS_MOCK && (
                <p className="text-xs text-center text-amber-700 dark:text-amber-500 bg-amber-500/10 rounded-xl px-3 py-2">
                    {t.demoMode}
                </p>
            )}
            {isArchive && (
                <p className="flex items-center justify-center gap-2 text-xs text-center text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 rounded-xl px-3 py-2">
                    <History size={14} className="shrink-0" aria-hidden="true" />
                    {readOnly
                        ? t.archiveRecorded
                        : t.archivePractice}
                </p>
            )}
        </>
    );

    return (
        // No bottom padding of its own: Layout's <main> already clears the
        // floating tab bar (5.5rem + the safe-area inset), which is enough to
        // keep the keyboard's bottom row out from under it. Adding more here
        // just stacked two gaps.
        //
        // At xl the tab bar has moved to the top and that clearance becomes a
        // plain 2rem of trailing space — which on a 720px-tall window is the
        // difference between fitting and showing a scrollbar for one or two
        // pixels. The keyboard is the last thing on this page and wants no
        // gutter under it, so most of it is given back.
        <div className="xl:-mb-6">
            {/* No reference here. Before the game ends it would be the answer
                key — "João 1,1" is one search away from the word — and after,
                the verse card already carries it, as a link. */}
            <PageHeader
                title={t.title}
                subtitle={t.subtitle}
                action={
                    <button
                        type="button"
                        onClick={() => setShowHowToPlay(true)}
                        aria-label={t.howToPlayTitle}
                        className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm transition-all shrink-0 p-2"
                    >
                        <CircleHelp size={20} />
                    </button>
                }
            />

            {showHowToPlay && <HowToPlay onClose={closeHowToPlay} />}

            {/* Sidebar left, board right — the same split Missa and Horas use,
                so the date nav sits in one predictable place on desktop. */}
            <div className="max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-6 pt-2 flex flex-col lg:flex-row lg:gap-10 lg:items-start">

                {/* Navigation on the left, content on the right — the section
                    tabs belong with the date nav rather than sitting on top of
                    the board, which is the one column that has to stay narrow. */}
                <aside className="hidden lg:flex flex-col gap-3 w-64 xl:w-72 shrink-0 sticky top-24">
                    {dateNav}
                    {pageTabs(true)}
                    {notices}
                </aside>

                {/* The board stays a narrow column even on a wide screen —
                    eight tiles spread across 5xl would be unreadable. */}
                <div className="flex-1 min-w-0 max-w-md w-full mx-auto lg:mx-0">
                    {/* Outside the space-y container below, not inside it:
                        `space-y` puts a top margin on every child after the
                        first and counts hidden ones, so leaving this here
                        pushed the verse card down by one gap on desktop and
                        broke its alignment with the sidebar. */}
                    <div className="lg:hidden space-y-3 mb-3">
                        {dateNav}
                        {notices}
                    </div>

                    {/* On desktop this lives in the sidebar; here it is the
                        mobile copy. Only one is ever rendered, so there is a
                        single tablist in the accessibility tree. */}
                    <div className="lg:hidden mb-4">{pageTabs(false)}</div>

                    {socialSeen && (
                        <div hidden={pageTab !== 'social'}>
                            <Community
                                refreshKey={resultsVersion}
                                date={viewDate}
                                pubkey={myPubkey}
                                sharing={sharing}
                                // Today's rankings say how many tries people
                                // needed, which is a hint about how hard the
                                // word is. Withheld until this player has
                                // finished it.
                                revealResults={over || isArchive}
                                // Not the same question, and the month board
                                // needs this one: browsing the archive reveals
                                // nothing about today's word, but a monthly
                                // total *with today in it* is today's guess
                                // counts summed. `over` describes whichever day
                                // is on screen; this describes today.
                                finishedToday={finishedToday}
                            />
                        </div>
                    )}

                    <div className={pageTab === 'game' ? 'space-y-4 sm:space-y-5' : 'hidden'}>
                {loadError && (
                    <div className="surface rounded-2xl p-5 text-center space-y-2">
                        <TriangleAlert size={22} className="mx-auto text-amber-600" aria-hidden="true" />
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{loadError}</p>
                    </div>
                )}

                {!challenge && !loadError && (
                    <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-12">
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        {t.loading}
                    </p>
                )}

                {challenge && !answer && (
                    <div className="surface rounded-2xl p-5 text-center">
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {t.corrupt}
                        </p>
                    </div>
                )}

                {challenge && answer && (
                    <>
                        {/* A verse may carry more than one blank: where it
                            repeats the hidden word, every occurrence is hidden,
                            or the answer would sit in plain sight beside its
                            own gap. They all fill together on the reveal. */}
                        <blockquote className="surface surface-accent rounded-2xl p-4 text-[1.05rem] leading-relaxed">
                            {verseParts.map((part, i) => (
                                <Fragment key={i}>
                                    {part}
                                    {i < verseParts.length - 1 && (
                                        <span
                                            // Only while it is a blank: after
                                            // the reveal it is ordinary text.
                                            // A plain span is `generic`, which
                                            // ARIA gives no accessible name,
                                            // so the label below could be
                                            // dropped without a role here.
                                            role={over ? undefined : 'img'}
                                            className="inline-block align-baseline border-b-2 border-liturgy-600 dark:border-liturgy-400 text-liturgy-700 dark:text-liturgy-300 font-semibold px-1 text-center"
                                            style={over ? undefined : { minWidth: `${challenge.length * 0.72}em` }}
                                            aria-label={over ? undefined : t.hiddenWord(challenge.length)}
                                        >
                                            {over ? answerDisplay : ' '}
                                        </span>
                                    )}
                                </Fragment>
                            ))}
                            <cite className="block not-italic text-xs font-medium text-zinc-500 mt-2">
                                {over && (
                                    <>
                                        {refUrl
                                            ? (
                                                <a
                                                    href={refUrl}
                                                    {...(isInstalledApp
                                                        ? { rel: 'noreferrer' }
                                                        : { target: '_blank', rel: 'noopener noreferrer' })}
                                                    className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-liturgy-700 dark:hover:text-liturgy-300"
                                                >
                                                    {challenge.ref}
                                                    <ExternalLink size={11} aria-hidden="true" />
                                                </a>
                                            )
                                            : challenge.ref}
                                        {' · '}
                                    </>
                                )}
                                {t.letters(challenge.length)}
                            </cite>
                        </blockquote>

                        {/* Once the game is over the outcome leads and the
                            board drops below it: the result is what the player
                            came back for, and their own guesses are the
                            supporting detail. While playing, the board is the
                            whole screen and nothing sits above it. */}
                        {over && (
                            <ResultSheet
                                solved={play.solved}
                                tries={play.guesses.length}
                                answer={answerDisplay}
                                stats={stats}
                                shareText={shareText}
                                archive={isArchive}
                                actions={signedIn && !isArchive ? (
                                    // Archive runs are practice and carry no
                                    // proof, so there is nothing worth posting.
                                    <ShareToNostr
                                        alreadyShared={Boolean(sharedNotes[challenge.date])}
                                        onShare={async () => {
                                            const { sharePalavraNote } = await import('@/lib/palavra/nostr');
                                            await sharePalavraNote({
                                                date: challenge.date,
                                                tries: play.guesses.length,
                                                solved: play.solved,
                                                grid: emojiGrid(played.map((row) => row.marks)),
                                            });
                                            // Only after the relay accepted it —
                                            // marking on click would hide the
                                            // button on a publish that failed.
                                            markNoteShared(challenge.date);
                                        }}
                                    />
                                ) : undefined}
                            />
                        )}

                        {/* The refusal message floats over the board rather
                            than sitting in the flow: a reserved empty row cost
                            vertical space on every screen to serve the rare
                            moment a guess is rejected, and that was part of
                            what pushed the keyboard off a laptop viewport. */}
                        <div className="relative" ref={boardRef}>
                            <Grid
                                played={played}
                                draft={over || readOnly ? '' : draft}
                                length={challenge.length}
                                rejected={rejected}
                                maxTilePx={maxTilePx}
                            />
                            <p
                                role="status"
                                className={`absolute inset-x-0 top-1 flex justify-center pointer-events-none transition-opacity duration-150 ${
                                    notice ? 'opacity-100' : 'opacity-0'
                                }`}
                            >
                                {notice && (
                                    <span className="rounded-lg bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-sm font-semibold px-3 py-1.5 shadow-lg">
                                        {notice}
                                    </span>
                                )}
                            </p>
                        </div>

                        {!over && (
                            <div ref={keyboardRef}>
                            <Keyboard
                                state={keys}
                                // An archive day with a recorded but abandoned
                                // play is readOnly while `over` is false, so
                                // the keys rendered live and did nothing.
                                disabled={readOnly}
                                onLetter={onLetter}
                                onBackspace={onBackspace}
                                onEnter={onEnter}
                            />
                            </div>
                        )}

                    </>
                )}
                    </div>
                </div>
            </div>
        </div>
    );
}

