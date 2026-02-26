import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Check, PartyPopper } from "lucide-react";
import { useAppStore } from "@/store/app";
import { useTranslations } from "@/lib/i18n";
import { getMysteryForToday, generateRosarySequence } from "@/lib/rosary";

export default function Rosary() {
    const { rosaryMode, incrementStreak } = useAppStore();
    const t = useTranslations().rosary;
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showFinish, setShowFinish] = useState(false);

    const todayMysteryClass = getMysteryForToday();

    const sequence = useMemo(() => {
        return generateRosarySequence(todayMysteryClass, rosaryMode);
    }, [todayMysteryClass, rosaryMode]);

    const currentStep = sequence[currentStepIndex];

    const handleFinishRosary = async () => {
        incrementStreak('rosary');
        setShowFinish(true);

        const { publishStreakToNostr } = await import('@/lib/nostr');
        publishStreakToNostr();
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

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentStepIndex]);

    return (
        <div className="p-6 pt-12 pb-8 flex-1 w-full flex flex-col max-w-md mx-auto relative overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-liturgy-100 to-transparent dark:from-liturgy-900/20 -z-10 mix-blend-multiply opacity-50"></div>

            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => window.history.back()}
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 p-2 rounded-full"
                >
                    <ChevronRight className="rotate-180" size={24} />
                </button>
                <div className="flex-1 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Terço</h1>
                        <p className="text-zinc-500 text-sm capitalize">Mistérios {todayMysteryClass}</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col mt-4 relative z-10">
                {/* Active Step Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 mb-8 min-h-[240px] flex flex-col">
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

                {/* Big Action Button */}
                <button
                    onClick={handleNext}
                    className="w-full h-20 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl shadow-zinc-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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

            {/* Finish Modal Overlay */}
            {showFinish && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center space-y-5 animate-in zoom-in-95">
                        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <PartyPopper size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Graças a Deus!</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Concluiu o Santo Terço de hoje. <br />
                            Que Nossa Senhora interceda por si e pelos seus.
                        </p>
                        <button
                            onClick={() => {
                                setShowFinish(false);
                                window.history.back();
                            }}
                            className="w-full py-3 px-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-semibold transition-all active:scale-[0.97] hover:opacity-90"
                        >
                            Amém
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
