import { Fragment } from 'react';
import { splitVersicle, VERSICLE_GLYPH } from '@/lib/versicles';

// Rubrics are red in every printed book. The breviary view paints its V./R.
// markers with the API's literal red so both renders match; this matches it.
const RUBRIC = 'text-[#ff0000]';

/**
 * A prayer body with its "V." / "R." markers shown as the liturgical ℣ and ℟
 * in rubric red. Newlines are rendered as written (the element is
 * whitespace-pre-line), so the data files stay plain text and the clipboard
 * copy keeps the same line breaks.
 */
export function PrayerText({ text, className = '' }: { text: string; className?: string }) {
    return (
        <p className={`whitespace-pre-line ${className}`}>
            {text.split('\n').map((line, i) => {
                const { mark, rest } = splitVersicle(line);
                return (
                    <Fragment key={i}>
                        {i > 0 && '\n'}
                        {mark ? (
                            <>
                                <span className={RUBRIC} aria-hidden="true">{VERSICLE_GLYPH[mark]}</span>
                                <span className="sr-only">{mark}.</span>
                                {' '}
                                {rest}
                            </>
                        ) : (
                            line
                        )}
                    </Fragment>
                );
            })}
        </p>
    );
}
