import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Check, PartyPopper, Undo2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActions } from "@/components/layout/StickyActions";
import { useAppStore, isCompletedToday } from "@/store/app";
import type { RosaryBeadMode } from "@/lib/rosary";
import { useTranslations } from "@/lib/i18n";
import { getMysteryForToday, generateRosarySequence, mysteries, MYSTERY_LABELS } from "@/lib/rosary";
import { formatISODate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useDayRollover } from "@/lib/useDayRollover";
import { Sheet, type SheetHandle } from "@/components/Sheet";

function currentDay() {
    const now = new Date();
    return { date: formatISODate(now), mystery: getMysteryForToday(now) };
}

export default function Rosary() {
    const navigate = useNavigate();
    const { rosaryMode, setRosaryMode, setRosarySession, streaks, incrementStreak, setBottomBarYielded } = useAppStore();
    const t = useTranslations().rosary;

    // The day, and so the mysteries, are fixed once praying has begun. Read
    // on every render, a bead tap after midnight rebuilt the sequence as the
    // next day's mysteries at the same step — a rosary begun Sorrowful
    // finished mid-way through the Glorious. Before the first bead they are
    // re-read, so a page left open overnight starts with today's.
    const [day, setDay] = useState(currentDay);
    const { date: todayStr, mystery: todayMysteryClass } = day;

    // Resume an unfinished session from today (same mode); otherwise start fresh.
    const [currentStepIndex, setCurrentStepIndex] = useState(() => {
        const session = useAppStore.getState().rosarySession;
        if (session && session.date === todayStr && session.mode === useAppStore.getState().rosaryMode) {
            return session.step;
        }
        return 0;
    });
    const [showFinish, setShowFinish] = useState(false);

    // Back in the foreground on a new day, before the first bead.
    useDayRollover(
        () => formatISODate(new Date()),
        () => { if (currentStepIndex === 0) setDay(currentDay()); },
    );
    const finishSheet = useRef<SheetHandle>(null);

    const sequence = useMemo(() => {
        return generateRosarySequence(todayMysteryClass, rosaryMode);
    }, [todayMysteryClass, rosaryMode]);

    // Keep the saved session in sync so an accidental exit never loses the
    // user's place. Cleared on finish and whenever we're back at the start —
    // including a stale (other day/mode) session rejected by the initializer —
    // so nothing resumes from it and the tab bar stops treating it as active.
    useEffect(() => {
        if (showFinish) return;
        if (currentStepIndex > 0) {
            setRosarySession({ date: todayStr, mode: rosaryMode, step: currentStepIndex });
        } else {
            setRosarySession(null);
        }
    }, [currentStepIndex, rosaryMode, todayStr, showFinish, setRosarySession]);

    const currentStep = sequence[Math.min(currentStepIndex, sequence.length - 1)];

    const handleFinishRosary = async () => {
        incrementStreak('rosary');
        setRosarySession(null);
        setShowFinish(true);

        try {
            const { publishStreakToNostr } = await import('@/lib/nostr');
            await publishStreakToNostr();
        } catch (error) {
            // Best-effort sync — a chunk-load failure (e.g. offline) must
            // never break finishing the rosary.
            console.warn('Streak sync skipped:', error);
        }
    };

    // Which way the last step went, so the next card enters from that side.
    // Null until the first step, and after a jump (restart, mode change),
    // which has no side to come from.
    const [direction, setDirection] = useState<'next' | 'prev' | null>(null);

    const handleNext = () => {
        if (currentStepIndex === 0) setDay(currentDay());
        if (currentStepIndex < sequence.length - 1) {
            // A bead under the thumb; two when this closes a decade — the
            // Glória (bead 11) is its last step.
            haptic(sequence[currentStepIndex].beadIndex === 11 ? 'group' : 'bead');
            setDirection('next');
            setCurrentStepIndex(prev => prev + 1);
        } else {
            haptic('complete');
            handleFinishRosary();
        }
    };

    const handleBackStep = () => {
        setDirection('prev');
        setCurrentStepIndex(prev => Math.max(0, prev - 1));
    };

    const handleRestart = () => {
        setDay(currentDay());
        setDirection(null);
        setCurrentStepIndex(0);
        setRosarySession(null);
    };

    const changeMode = (mode: RosaryBeadMode) => {
        setDay(currentDay());
        setRosaryMode(mode);
        setDirection(null);
        setCurrentStepIndex(0);
        setRosarySession(null);
    };

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentStepIndex]);

    const atStart = currentStepIndex === 0;

    // Once praying has started the tab bar steps aside (TabBar hides it for
    // an active session) — tell the store too, so the layout stops holding
    // 5.5rem of clearance for a bar that isn't drawn and the action rail can
    // settle at the bar's own inset. Cleared on unmount so it never outlives
    // the page.
    const barYielded = rosaryMode === 'beginner' && !atStart;
    useEffect(() => {
        setBottomBarYielded(barYielded);
    }, [barYielded, setBottomBarYielded]);
    useEffect(() => () => setBottomBarYielded(false), [setBottomBarYielded]);

    // Shared by both layouts: guided shows it only before starting, the
    // mysteries-only page always shows it (there is no "started" state).
    const modePicker = (
        <div className="mb-6">
            <div role="group" aria-label="Modo do terço" className="flex w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
                {([['beginner', 'Guiado'], ['advanced', 'Só mistérios']] as [RosaryBeadMode, string][]).map(([mode, label]) => (
                    <button
                        type="button"
                        key={mode}
                        onClick={() => changeMode(mode)}
                        aria-pressed={rosaryMode === mode}
                        className={`pressable flex-1 px-2 py-2 rounded-lg text-sm font-medium ${rosaryMode === mode
                            ? 'surface text-liturgy-700 dark:text-liturgy-400'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-2">
                {rosaryMode === 'beginner'
                    ? 'Todas as orações, conta a conta.'
                    : 'Os cinco mistérios numa só página — reza as contas ao teu ritmo.'}
            </p>
        </div>
    );

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader
                title="Terço"
                subtitle={`Mistérios ${MYSTERY_LABELS[todayMysteryClass]}`}
                action={rosaryMode === 'beginner' && !atStart && !showFinish ? (
                    <button
                        type="button"
                        onClick={handleRestart}
                        aria-label="Recomeçar o terço"
                        className="pressable flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1.5 shrink-0"
                    >
                        <RotateCcw size={14} aria-hidden="true" />
                        Recomeçar
                    </button>
                ) : undefined}
            />
            <div className="p-6 pb-0 flex-1 w-full flex flex-col max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto relative">
            {rosaryMode === 'advanced' ? (
                /* ── Mysteries-only mode: all five on one page, prayed at the
                   user's own pace, closed with a single complete button. ── */
                <div className="flex-1 flex flex-col mt-4 pb-8 relative z-10 w-full">
                    <div className="lg:max-w-md">{modePicker}</div>
                    <div className="space-y-3 mb-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
                        {mysteries[todayMysteryClass].map((m) => (
                            <article
                                key={m.id}
                                className="surface rounded-3xl p-5"
                            >
                                <span className="inline-block px-3 py-1 bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-700 dark:text-liturgy-400 text-xs font-bold uppercase tracking-widest rounded-xl mb-3">
                                    {m.mysteryNum}º Mistério
                                </span>
                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-2">
                                    {m.title}
                                </h2>
                                <p className="content-text italic text-zinc-700 dark:text-zinc-300 whitespace-pre-line mb-2">
                                    {m.description}
                                </p>
                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    Fruto: {m.fruit}
                                </p>
                            </article>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => { haptic('complete'); handleFinishRosary(); }}
                        className="pressable h-20 cta-primary rounded-2xl font-bold text-lg flex items-center justify-center gap-3 lg:w-80 lg:self-end"
                    >
                        {t.finish} <Check size={24} />
                    </button>
                </div>
            ) : (
            <div className="flex-1 flex flex-col mt-4 relative z-10 w-full lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8 lg:items-start">
                {/* Today's five mysteries, in a solid card of the season's
                    colour like Home's day card (white on 700 by day, 800 by
                    night, 5.0:1 or better). On a phone only before the first
                    bead; on desktop it stays in the left column the whole way
                    and marks the mystery being prayed. */}
                <section className={`${atStart && !showFinish ? '' : 'hidden lg:block'} lg:sticky lg:top-24 rounded-3xl p-5 mb-4 lg:mb-0 bg-liturgy-700 dark:bg-liturgy-800 text-white`}>
                    <p className="text-xs font-bold uppercase tracking-widest">Hoje rezamos</p>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                        Mistérios {MYSTERY_LABELS[todayMysteryClass]}
                    </h2>
                    <ol className="mt-3 space-y-1.5 text-sm">
                        {mysteries[todayMysteryClass].map((m) => {
                            const current = !atStart && currentStep.decadeIndex === m.mysteryNum;
                            return (
                                <li
                                    key={m.id}
                                    aria-current={current ? 'step' : undefined}
                                    className={`flex gap-2 ${current ? 'font-bold underline decoration-2 underline-offset-4' : ''}`}
                                >
                                    <span className="font-bold tabular-nums">{m.mysteryNum}.</span>
                                    <span>{m.title}</span>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <div className="flex-1 flex flex-col min-w-0 lg:min-h-[calc(100vh-12rem)]">
                    {/* Mode picker — only before starting, where the choice
                        matters. Above the card, so the sticky button at the foot
                        never covers it. */}
                    {atStart && !showFinish && modePicker}

                    {/* Active Step Card — tapping it advances, like turning a bead */}
                    <div
                        onClick={handleNext}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNext(); } }}
                        className="pressable pressable-card surface rounded-3xl p-6 mb-8 min-h-[240px] flex flex-col cursor-pointer select-none"
                    >
                        {/* Keyed by step, so each bead's text enters afresh from
                            the side it was turned towards (see .step-enter-*). */}
                        <div
                            key={currentStepIndex}
                            className={`flex-1 flex flex-col ${direction ? `step-enter-${direction}` : ''}`}
                        >
                            <span className="inline-block px-3 py-1 bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-700 dark:text-liturgy-400 text-xs font-bold uppercase tracking-widest rounded-xl mb-4 self-start shrink-0">
                                {currentStep.title}
                            </span>

                            <div className="flex-1 flex flex-col justify-center overflow-y-auto">
                                <p className={`content-text text-zinc-800 dark:text-zinc-200 whitespace-pre-line ${currentStep.type === 'misterio'
                                    ? 'italic font-medium'
                                    : 'font-medium'
                                    }`}>
                                    {currentStep.content}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Indicators (Only for beginner mode, during a decade) */}
                    {rosaryMode === 'beginner' && currentStep.decadeIndex && currentStep.type !== 'misterio' ? (
                        <div className="mt-auto mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                    Mistério {currentStep.decadeIndex} de 5
                                </span>
                                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                    {currentStep.beadIndex === 0 ? 'Pai Nosso' :
                                        currentStep.beadIndex === 11 ? 'Glória' :
                                            `Conta ${currentStep.beadIndex} de 10`}
                                </span>
                            </div>

                            {/* 12 Beads: 1 PN (0), 10 AM (1-10), 1 Gloria (11).
                                Sized like a physical rosary: the ten contas are
                                the small beads, Pai Nosso and Glória the large
                                markers — clustered, not stretched to the frame. */}
                            <div className="flex justify-center gap-2.5 items-center">
                                {[...Array(12)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`rounded-full transition-[background-color,border-color,transform,box-shadow] duration-300 shrink-0 ${i === 0 || i === 11
                                            ? 'h-5 w-5 border-2 border-current' // PN and Gloria
                                            : 'h-2.5 w-2.5' // Ave Marias
                                            } ${(currentStep.beadIndex !== undefined && i < currentStep.beadIndex)
                                                ? 'bg-liturgy-700 border-liturgy-700 dark:bg-liturgy-500 dark:border-liturgy-500' // Past (3:1 or better on the page in every season)
                                                : i === currentStep.beadIndex
                                                    ? 'bg-liturgy-700 border-liturgy-700 dark:bg-liturgy-400 dark:border-liturgy-400 scale-125 shadow-md shadow-liturgy-500/20' // Current
                                                    : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800' // Future
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-auto mb-8 h-12"></div> // Spacer
                    )}

                    {/* Action row: back-step + big advance button. Stuck to the
                        foot of the viewport — see StickyActions. */}
                    <StickyActions clearsBottomBar={atStart}>
                        {!atStart && (
                            <button
                                type="button"
                                onClick={handleBackStep}
                                aria-label="Passo anterior"
                                className="pressable w-16 shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl flex items-center justify-center"
                            >
                                <Undo2 size={22} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="pressable flex-1 h-20 cta-primary rounded-2xl font-bold text-lg flex items-center justify-center gap-3"
                        >
                            {currentStepIndex === sequence.length - 1 ? (
                                <>{t.finish} <Check size={24} /></>
                            ) : (
                                <>{currentStep.type === 'misterio' ? 'Iniciar Mistério' :
                                    currentStep.type === 'intro' ? 'Iniciar Terço' :
                                        currentStep.type === 'salve_rainha' ? 'Concluir Terço' :
                                            'Continuar'} <ChevronRight size={24} /></>
                            )}
                        </button>
                    </StickyActions>
                </div>
            </div>
            )}

            {/* Finish — a centred alert that asks for its button: Amém is
                the close, so the scrim does not dismiss it. */}
            {showFinish && (
                <Sheet
                    ref={finishSheet}
                    variant="alert"
                    dismissible={false}
                    labelledBy="rosary-finish-title"
                    className="text-center space-y-5 !p-8"
                    onClose={() => {
                        setShowFinish(false);
                        setCurrentStepIndex(0);
                        navigate('/');
                    }}
                >
                    <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <PartyPopper size={32} />
                    </div>
                    <h2 id="rosary-finish-title" className="text-2xl font-bold text-zinc-900 dark:text-white">Graças a Deus!</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                        Concluíste o Santo Terço de hoje. <br />
                        Que Nossa Senhora interceda por ti e pelos teus.
                    </p>
                    {isCompletedToday(streaks.rosary) && (
                        <p className="text-sm font-semibold text-orange-500">
                            🔥 {streaks.rosary.days} {streaks.rosary.days === 1 ? 'dia seguido' : 'dias seguidos'}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => finishSheet.current?.close()}
                        className="pressable w-full py-3 px-6 cta-primary rounded-xl font-semibold"
                    >
                        Amém
                    </button>
                </Sheet>
            )}
            </div>
        </div>
    );
}
