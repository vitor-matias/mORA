import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, History, Loader2, TriangleAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DateNav } from '@/components/DateNav';
import { FullVerse } from '@/components/palavra/FullVerse';
import { ShareToNostr } from '@/components/palavra/ShareToNostr';
import { Community } from '@/components/palavra/Community';
import { Grid, type PlayedRow } from '@/components/palavra/Grid';
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
import { derivePalavraStats, isFinished, usePalavraStore } from '@/store/palavra';
import { useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';
import { formatUTCDate } from '@/lib/format';
import { useDayRollover } from '@/lib/useDayRollover';
import { useTranslations } from '@/lib/i18n';

const EMPTY_PLAY = { guesses: [] as string[], solved: false, ms: 0 };

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

    const writeDraft = useCallback((next: string) => {
        draftRef.current = next;
        setDraft(next);
    }, []);

    const myPubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey ?? null);
    const signedIn = Boolean(myPubkey);
    const sharing = usePalavraStore((s) => s.sharePalavraResults);
    const plays = usePalavraStore((s) => s.plays);
    const practice = usePalavraStore((s) => s.practice);
    const beginPlay = usePalavraStore((s) => s.beginPlay);
    const submitGuess = usePalavraStore((s) => s.submitGuess);
    const sharedNotes = usePalavraStore((s) => s.sharedNotes);
    const markNoteShared = usePalavraStore((s) => s.markNoteShared);

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
    }, [viewDate, writeDraft, t]);

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

    // Start the clock the first time the board is actually playable.
    useEffect(() => {
        if (challenge && answer && !over && !readOnly) beginPlay(viewDate, scope);
    }, [challenge, answer, over, readOnly, viewDate, scope, beginPlay]);

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

    // Publishing reaches the network, so it stays out of the render path, and
    // the ref makes sure a slow relay can't have it run twice for the same day.
    // Practice runs never reach it: an archive game is not a result.
    const publishedFor = useRef<string | null>(null);
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
            await Promise.allSettled([
                publishPalavraStateToNostr(),
                record ? publishPalavraResult(challenge.date, record) : Promise.resolve(),
            ]);
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
    const keyboardUp = pageTab === 'game' && !over;
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
            if (event.key === 'Enter') { onEnter(); return; }
            if (event.key === 'Backspace') { onBackspace(); return; }
            const letter = normalizeWord(event.key);
            if (letter.length === 1) onLetter(letter);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onEnter, onBackspace, onLetter, pageTab]);

    const shareText = useMemo(() => {
        if (!challenge || !over) return '';
        const score = play.solved ? `${play.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
        return [
            t.shareHeading(challenge.date, score),
            challenge.ref,
            '',
            emojiGrid(played.map((row) => row.marks)),
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
            onSelectDate={(date) => goToDate(formatUTCDate(date))}
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
                    onClick={() => setPageTab(id)}
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
            />

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

                    {pageTab === 'social' && (
                        <Community
                            date={viewDate}
                            pubkey={myPubkey}
                            sharing={sharing}
                            // Today's rankings say how many tries people
                            // needed, which is a hint about how hard the word
                            // is. Withheld until this player has finished it.
                            revealResults={over || isArchive}
                        />
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
                                {over && `${challenge.ref} · `}{t.letters(challenge.length)}
                            </cite>
                        </blockquote>

                        {/* The passage in full, once it can't spoil anything.
                            Carried in the puzzle rather than linked out to: the
                            whole translation is available where the puzzle is
                            built, so this reads in the app and offline — and
                            `verse` above is often only an excerpt of it. */}
                        {over && challenge.full && (
                            <blockquote className="psalm-refrain text-[0.95rem]">
                                <FullVerse text={challenge.full} highlight={answerDisplay} />
                                <cite className="block not-italic text-xs font-medium opacity-70 mt-1">
                                    {challenge.ref}
                                </cite>
                            </blockquote>
                        )}

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
                                                ref: challenge.ref,
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
                        <div className="relative">
                            <Grid
                                played={played}
                                draft={over || readOnly ? '' : draft}
                                length={challenge.length}
                                rejected={rejected}
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
                        )}

                    </>
                )}
                    </div>
                </div>
            </div>
        </div>
    );
}

