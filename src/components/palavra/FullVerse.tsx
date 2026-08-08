import { Fragment } from 'react';

/** Anything that would otherwise be a regex operator. */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The complete verse, with the answer picked out wherever it occurs.
 *
 * Matched case-insensitively because the text carries natural capitalisation
 * ("No princípio havia o Verbo") while the answer arrives uppercased from the
 * cipher — but the *original* casing is what gets rendered, so the sentence
 * still reads as it was written.
 *
 * Whole words only, or `graça` would light up inside `desgraça`. \b is no use
 * here: it is defined on [A-Za-z0-9_], so it fires in the middle of accented
 * Portuguese, and `\bfé\b` would match the "fé" in "fé," but not the one in
 * "féis". Lookarounds on an explicit letter class handle accents correctly.
 */
export function FullVerse({ text, highlight }: { text: string; highlight: string }) {
    if (!highlight) return <>{text}</>;

    const letter = 'A-Za-zÀ-ÖØ-öø-ÿ';
    let parts: string[];
    try {
        parts = text.split(
            new RegExp(`(?<![${letter}])(${escapeRegExp(highlight)})(?![${letter}])`, 'gi'),
        );
    } catch {
        // Lookbehind is old news in every browser this app targets, but a
        // failure here should cost the highlight, not the passage.
        return <>{text}</>;
    }

    // String.split with a capturing group interleaves the matches at odd
    // indices, so the separators are the words to mark.
    return (
        <>
            {parts.map((part, i) => (i % 2 === 1
                ? <strong key={i} className="font-bold">{part}</strong>
                : <Fragment key={i}>{part}</Fragment>
            ))}
        </>
    );
}
