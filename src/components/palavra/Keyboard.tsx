import { Delete, CornerDownLeft } from 'lucide-react';
import type { Mark } from '@/lib/palavra/types';
import { useTranslations } from '@/lib/i18n';

// No Ç and no accented vowels: answers are folded to plain A–Z (see
// normalizeWord), so a key that produced anything else would be a key that
// can never help. Three rows in the usual pt-PT QWERTY order.
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

const MARK_CLASS: Record<Mark, string> = {
    correct: 'palavra-tile-correct',
    present: 'palavra-tile-present',
    absent: 'palavra-key-absent',
};

type Copy = ReturnType<typeof useTranslations>['palavra'];

const MARK_LABEL = (t: Copy): Record<Mark, string> => ({
    correct: t.keyCorrect,
    present: t.keyPresent,
    absent: t.keyAbsent,
});

export function Keyboard({
    state,
    onLetter,
    onBackspace,
    onEnter,
    disabled = false,
}: {
    /** Best mark each letter has earned so far. */
    state: Record<string, Mark>;
    onLetter: (letter: string) => void;
    onBackspace: () => void;
    onEnter: () => void;
    disabled?: boolean;
}) {
    // Key height yields to a short viewport for the same reason the board
    // does — three rows at a fixed 3.5rem are what tips the page into
    // scrolling on a laptop screen.
    const t = useTranslations().palavra;
    const keyBase = 'flex items-center justify-center rounded-lg font-semibold '
        + 'h-[clamp(2.25rem,5.6vh,3.5rem)] text-sm sm:text-base select-none transition-colors '
        + 'disabled:opacity-50 active:scale-95';
    const plainKey = 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 '
        + 'hover:bg-zinc-300 dark:hover:bg-zinc-600';

    return (
        <div className="space-y-1.5 select-none" role="group" aria-label={t.keyboard}>
            {ROWS.map((row, rowIndex) => (
                <div key={row} className="flex gap-1 sm:gap-1.5 justify-center">
                    {/* The middle row sits half a key in, as on a real
                        keyboard — without it the three rows read as a block. */}
                    {rowIndex === 1 && <div className="w-3 sm:w-4 shrink-0" aria-hidden="true" />}

                    {rowIndex === 2 && (
                        <button
                            type="button"
                            // Tapping a key must not move focus to it.
                            // preventDefault on mousedown stops the
                            // button taking focus without touching the
                            // click, so a tapped key doesn't keep the
                            // focus ring and a later Enter doesn't
                            // re-fire it. Tab-and-Enter still works:
                            // mousedown never fires for that.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={onEnter}
                            disabled={disabled}
                            aria-label={t.confirmWord}
                            className={`${keyBase} ${plainKey} flex-[1.5] min-w-0`}
                        >
                            <CornerDownLeft size={18} aria-hidden="true" />
                        </button>
                    )}

                    {[...row].map((letter) => {
                        const mark = state[letter];
                        return (
                            <button
                                key={letter}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onLetter(letter)}
                                disabled={disabled}
                                aria-label={mark ? `${letter}, ${MARK_LABEL(t)[mark]}` : letter}
                                className={`${keyBase} flex-1 min-w-0 ${mark ? MARK_CLASS[mark] : plainKey}`}
                            >
                                {letter}
                            </button>
                        );
                    })}

                    {rowIndex === 2 && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={onBackspace}
                            disabled={disabled}
                            aria-label={t.deleteLetter}
                            className={`${keyBase} ${plainKey} flex-[1.5] min-w-0`}
                        >
                            <Delete size={18} aria-hidden="true" />
                        </button>
                    )}

                    {rowIndex === 1 && <div className="w-3 sm:w-4 shrink-0" aria-hidden="true" />}
                </div>
            ))}
        </div>
    );
}
