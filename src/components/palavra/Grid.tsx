import type { Mark } from '@/lib/palavra/types';
import { MAX_GUESSES } from '@/lib/palavra/types';
import { useTranslations } from '@/lib/i18n';

type Copy = ReturnType<typeof useTranslations>['palavra'];

const MARK_LABEL = (t: Copy): Record<Mark, string> => ({
    correct: t.markCorrect,
    present: t.markPresent,
    absent: t.markAbsent,
});

export interface PlayedRow {
    guess: string;
    marks: Mark[];
}

const MARK_CLASS: Record<Mark, string> = {
    correct: 'palavra-tile-correct',
    present: 'palavra-tile-present',
    absent: 'palavra-tile-absent',
};



/**
 * The board: six rows of `length` tiles.
 *
 * Sized from the word length rather than fixed, since the answer runs from
 * five to eight letters. The tile cap and the `min()` together mean a
 * five-letter board stays comfortably large on a desktop while an eight-letter
 * one still fits inside the padding of a 375px phone.
 */
export function Grid({
    played,
    draft,
    length,
    rejected = false,
}: {
    played: PlayedRow[];
    /** What the player is typing now — empty once the game is over. */
    draft: string;
    length: number;
    /** Briefly true when a guess was refused, to nudge the active row. */
    rejected?: boolean;
}) {
    const t = useTranslations().palavra;
    const showDraft = played.length < MAX_GUESSES;
    const blankRows = Math.max(0, MAX_GUESSES - played.length - (showDraft ? 1 : 0));

    const gridStyle = {
        gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))`,
        // Three limits, smallest wins. Width alone isn't enough: tiles are
        // square, so on a wide-but-short desktop window a board sized only to
        // the column is tall enough to push the keyboard off screen.
        //
        // The third term is the height budget — the viewport minus roughly
        // what everything else on the page occupies (header, verse, keyboard,
        // padding), split across the six rows. Subtracting a constant rather
        // than taking a flat fraction of vh is what lets a tall window run the
        // tiles up to their full 3.5rem while a 720px laptop still fits
        // without scrolling, instead of shrinking every screen to suit the
        // smallest one.
        maxWidth: `min(100%, ${length * 3.5}rem, calc((100vh - 30rem) / 6 * ${length}))`,
        // Letters shrink with the tiles so an eight-letter board doesn't clip.
        fontSize: `clamp(0.9rem, ${Math.floor(52 / length)}vw, 1.6rem)`,
    };

    return (
        <div className="space-y-1.5" role="group" aria-label={t.board}>
            {played.map((row, rowIndex) => (
                <div key={`played-${rowIndex}`} className="grid gap-1.5 mx-auto" style={gridStyle}>
                    {[...row.guess].map((letter, i) => (
                        <div
                            key={i}
                            className={`palavra-tile palavra-reveal ${MARK_CLASS[row.marks[i]]}`}
                            // Each tile lands a beat after the one before it.
                            style={{ animationDelay: `${i * 80}ms` }}
                        >
                            <span className="sr-only">{`${letter}, ${MARK_LABEL(t)[row.marks[i]]}. `}</span>
                            <span aria-hidden="true">{letter}</span>
                        </div>
                    ))}
                </div>
            ))}

            {showDraft && (
                <div
                    className={`grid gap-1.5 mx-auto ${rejected ? 'palavra-shake' : ''}`}
                    style={gridStyle}
                >
                    {Array.from({ length }, (_, i) => (
                        <div
                            key={i}
                            className={`palavra-tile ${draft[i] ? 'palavra-tile-filled' : ''}`}
                        >
                            {draft[i] ?? ''}
                        </div>
                    ))}
                </div>
            )}

            {Array.from({ length: blankRows }, (_, rowIndex) => (
                <div key={`blank-${rowIndex}`} className="grid gap-1.5 mx-auto" style={gridStyle} aria-hidden="true">
                    {Array.from({ length }, (_, i) => (
                        <div key={i} className="palavra-tile" />
                    ))}
                </div>
            ))}
        </div>
    );
}
