import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Check, PartyPopper, Undo2, RotateCcw } from "lucide-react";
import { useAppStore, isCompletedToday } from "@/store/app";
import type { RosaryBeadMode } from "@/lib/rosary";
import { useTranslations } from "@/lib/i18n";
import { getMysteryForToday, generateRosarySequence, mysteries, MYSTERY_LABELS } from "@/lib/rosary";
import { formatISODate } from "@/lib/format";

export default function Rosary() {
    const navigate = useNavigate();
    const { rosaryMode, setRosaryMode, setRosarySession, streaks, incrementStreak } = useAppStore();
    const t = useTranslations().rosary;

    const todayStr = formatISODate(new Date());
    const todayMysteryClass = getMysteryForToday();

    // Resume an unfinished session from today (same mode); otherwise start fresh.
    const [currentStepIndex, setCurrentStepIndex] = useState(() => {
        const session = useAppStore.getState().rosarySession;
        if (session && session.date === formatISODate(new Date()) && session.mode === useAppStore.getState().rosaryMode) {
            return session.step;
        }
        return 0;
    });
    const [showFinish, setShowFinish] = useState(false);

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

    const handleNext = () => {
        // Vibrate lightly on click if supported
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }

        if (currentStepIndex < sequence.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            handleFinishRosary();
        }
    };

    const handleBackStep = () => {
        setCurrentStepIndex(prev => Math.max(0, prev - 1));
    };

    const handleRestart = () => {
        setCurrentStepIndex(0);
        setRosarySession(null);
    };

    const changeMode = (mode: RosaryBeadMode) => {
        setRosaryMode(mode);
        setCurrentStepIndex(0);
        setRosarySession(null);
    };

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentStepIndex]);

    const atStart = currentStepIndex === 0;

    // Shared by both layouts: guided shows it only before starting, the
    // mysteries-only page always shows it (there is no "started" state).
    const modePicker = (
        <div className="mb-6">
            <div role="group" aria-label="Modo do terço" className="flex w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
                {([['beginner', 'Guiado'], ['advanced', 'Só mistérios']] as [RosaryBeadMode, string][]).map(([mode, label]) => (
                    <button
                        key={mode}
                        onClick={() => changeMode(mode)}
                        aria-pressed={rosaryMode === mode}
                        className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${rosaryMode === mode
                            ? 'glass-panel text-liturgy-700 dark:text-liturgy-400'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-2">
                {rosaryMode === 'beginner'
                    ? 'Todas as orações, conta a conta.'
                    : 'Os cinco mistérios numa só página — reze as contas ao seu ritmo.'}
            </p>
        </div>
    );

    return (
        <div className="p-6 pt-12 pb-8 flex-1 w-full flex flex-col max-w-md mx-auto relative overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-liturgy-100 to-transparent dark:from-liturgy-900/20 -z-10 mix-blend-multiply opacity-50"></div>

            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/')}
                    aria-label="Voltar ao início"
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 p-2 rounded-full"
                >
                    <ChevronRight className="rotate-180" size={24} />
                </button>
                <div className="flex-1 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-halo">Terço</h1>
                        <p className="text-zinc-500 text-sm">Mistérios {MYSTERY_LABELS[todayMysteryClass]}</p>
                    </div>
                    {rosaryMode === 'beginner' && !atStart && !showFinish && (
                        <button
                            onClick={handleRestart}
                            aria-label="Recomeçar o terço"
                            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 py-1.5"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            Recomeçar
                        </button>
                    )}
                </div>
            </header>

            {rosaryMode === 'advanced' ? (
                /* ── Mysteries-only mode: all five on one page, prayed at the
                   user's own pace, closed with a single complete button. ── */
                <div className="flex-1 flex flex-col mt-4 relative z-10">
                    {modePicker}
                    <div className="space-y-3 mb-8">
                        {mysteries[todayMysteryClass].map((m) => (
                            <article
                                key={m.id}
                                className="glass-panel rounded-3xl p-5"
                            >
                                <span className="inline-block px-3 py-1 bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 text-xs font-bold uppercase tracking-wider rounded-xl mb-3">
                                    {m.mysteryNum}º Mistério
                                </span>
                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-2">
                                    {m.title}
                                </h2>
                                <p className="content-text italic text-zinc-700 dark:text-zinc-300 whitespace-pre-line mb-2">
                                    {m.description}
                                </p>
                                <p className="text-xs font-medium text-zinc-500">
                                    Fruto: {m.fruit}
                                </p>
                            </article>
                        ))}
                    </div>
                    <button
                        onClick={handleFinishRosary}
                        className="h-20 cta-primary rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        {t.finish} <Check size={24} />
                    </button>
                </div>
            ) : (
            <div className="flex-1 flex flex-col mt-4 relative z-10">
                {/* Active Step Card — tapping it advances, like turning a bead */}
                <div
                    onClick={handleNext}
                    className="glass-panel rounded-3xl p-6 mb-8 min-h-[240px] flex flex-col cursor-pointer select-none active:scale-[0.995] transition-transform"
                >
                    <span className="inline-block px-3 py-1 bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 text-xs font-bold uppercase tracking-wider rounded-xl mb-4 self-start shrink-0">
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

                {/* Mode picker — only before starting, where the choice matters */}
                {atStart && !showFinish && modePicker}

                {/* Progress Indicators (Only for beginner mode, during a decade) */}
                {rosaryMode === 'beginner' && currentStep.decadeIndex && currentStep.type !== 'misterio' ? (
                    <div className="mt-auto mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-medium text-zinc-500">
                                Mistério {currentStep.decadeIndex} de 5
                            </span>
                            <span className="text-sm font-medium text-zinc-500">
                                {currentStep.beadIndex === 0 ? 'Pai Nosso' :
                                    currentStep.beadIndex === 11 ? 'Glória' :
                                        `Conta ${currentStep.beadIndex} de 10`}
                            </span>
                        </div>

                        {/* 12 Beads: 1 PN (0), 10 AM (1-10), 1 Gloria (11) */}
                        <div className="flex justify-between gap-1 items-center">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`rounded-full transition-all duration-300 ${i === 0 || i === 11
                                        ? 'h-4 w-4 border-2 border-current' // Special beads (PN and Gloria)
                                        : 'flex-1 h-3' // Ave Marias
                                        } ${(currentStep.beadIndex !== undefined && i < currentStep.beadIndex)
                                            ? 'bg-liturgy-500 border-liturgy-500' // Past
                                            : i === currentStep.beadIndex
                                                ? 'bg-liturgy-600 border-liturgy-600 scale-125 shadow-md shadow-liturgy-500/20' // Current
                                                : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800' // Future
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-auto mb-8 h-12"></div> // Spacer
                )}

                {/* Action row: back-step + big advance button */}
                <div className="flex items-stretch gap-3">
                    {!atStart && (
                        <button
                            onClick={handleBackStep}
                            aria-label="Passo anterior"
                            className="w-16 shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl flex items-center justify-center transition-all active:scale-[0.96]"
                        >
                            <Undo2 size={22} />
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className="flex-1 h-20 cta-primary rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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
                </div>
            </div>
            )}

            {/* Finish Modal Overlay */}
            {showFinish && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="glass-panel rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-5 animate-in zoom-in-95">
                        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <PartyPopper size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Graças a Deus!</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Concluiu o Santo Terço de hoje. <br />
                            Que Nossa Senhora interceda por si e pelos seus.
                        </p>
                        {isCompletedToday(streaks.rosary) && (
                            <p className="text-sm font-semibold text-orange-500">
                                🔥 {streaks.rosary.days} {streaks.rosary.days === 1 ? 'dia seguido' : 'dias seguidos'}
                            </p>
                        )}
                        <button
                            onClick={() => {
                                setShowFinish(false);
                                setCurrentStepIndex(0);
                                navigate('/');
                            }}
                            className="w-full py-3 px-6 cta-primary rounded-xl font-semibold transition-all active:scale-[0.97] hover:opacity-90"
                        >
                            Amém
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
