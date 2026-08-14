import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Mark } from '@/lib/palavra/types';
import { useTranslations } from '@/lib/i18n';

type Copy = ReturnType<typeof useTranslations>['palavra'];

const MARK_CLASS: Record<Mark, string> = {
    correct: 'palavra-tile-correct',
    present: 'palavra-tile-present',
    absent: 'palavra-tile-absent',
};

const MARK_LABEL = (t: Copy): Record<Mark, string> => ({
    correct: t.markCorrect,
    present: t.markPresent,
    absent: t.markAbsent,
});

/**
 * One illustrative guess row: every tile plain except the one letter the
 * caption is about, coloured with its mark. Mirrors the real board (Grid.tsx)
 * closely enough to teach it, without pretending to be a playable row.
 */
function ExampleRow({
    word,
    highlightIndex,
    mark,
    caption,
}: {
    word: string;
    highlightIndex: number;
    mark: Mark;
    caption: string;
}) {
    const t = useTranslations().palavra;
    const letters = [...word];
    // Inline, not a Tailwind grid-cols-N class: the column count varies per
    // example and a template-literal class name never survives the Tailwind
    // scan. Grid.tsx sizes the real board the same way for the same reason.
    const gridStyle = {
        gridTemplateColumns: `repeat(${letters.length}, minmax(0, 1fr))`,
        maxWidth: `${letters.length * 2.75}rem`,
    };

    return (
        <div>
            <div className="grid gap-1.5 mx-auto" style={gridStyle}>
                {letters.map((letter, i) => {
                    const isHighlight = i === highlightIndex;
                    return (
                        <div
                            key={i}
                            className={`palavra-tile ${isHighlight ? MARK_CLASS[mark] : ''}`}
                        >
                            {isHighlight && (
                                <span className="sr-only">{`${letter}, ${MARK_LABEL(t)[mark]}. `}</span>
                            )}
                            <span aria-hidden={isHighlight}>{letter}</span>
                        </div>
                    );
                })}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">{caption}</p>
        </div>
    );
}

/**
 * The "Como jogar" explainer. Shown once, the first time the game loads on a
 * device (see `seenTutorial` in the palavra store), and reachable afterwards
 * from the header's help button.
 */
export function HowToPlay({ onClose }: { onClose: () => void }) {
    const t = useTranslations().palavra;
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="how-to-play-title"
                onClick={(event) => event.stopPropagation()}
                className="surface rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] overflow-y-auto space-y-5 animate-in zoom-in-95"
            >
                <div className="flex items-start justify-between gap-4">
                    <h2 id="how-to-play-title" className="text-xl font-bold page-title">
                        {t.howToPlayTitle}
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={t.howToPlayClose}
                        className="shrink-0 -m-1 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    <p>{t.howToPlayIntro}</p>
                    <p>{t.howToPlaySubmit}</p>
                    <p>{t.howToPlayColors}</p>
                </div>

                <hr className="border-zinc-200 dark:border-zinc-800" />

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-500">{t.howToPlayExamples}</h3>
                    <ExampleRow word="TERRA" highlightIndex={0} mark="correct" caption={t.howToPlayExampleCorrect} />
                    <ExampleRow word="SENHOR" highlightIndex={1} mark="present" caption={t.howToPlayExamplePresent} />
                    <ExampleRow word="PROFETA" highlightIndex={2} mark="absent" caption={t.howToPlayExampleAbsent} />
                </div>

                <hr className="border-zinc-200 dark:border-zinc-800" />

                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    <strong className="text-zinc-800 dark:text-zinc-100">{t.howToPlayDaily}</strong>
                    {' '}{t.howToPlayReveal}
                </p>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full cta-primary rounded-xl px-4 py-3 text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                    {t.howToPlayCta}
                </button>
            </div>
        </div>
    );
}
