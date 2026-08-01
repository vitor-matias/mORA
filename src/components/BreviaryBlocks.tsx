// Renders assembled breviary blocks (src/lib/breviary/assemble.ts) to
// look the same as the API-served office: section headers in the page's
// liturgy palette, in-content rubrics (labels, antiphon markers, V./R.)
// in the API's literal red, headers sized like its h3 markup.

import type { AssembledSection } from "@/lib/breviary/assemble";
import type { ComumBlock } from "@/lib/breviary/comum";

// The API office paints its rubrics with literal inline red
// (#ff0000) — match it exactly so both renders look the same.
const RED = 'text-[#ff0000]';

const KIND_LABEL: Record<string, string> = {
    'hino': 'Hino',
    'leitura': 'Leitura breve',
    'responsório': 'Responsório breve',
    'preces': 'Preces',
    'oração': 'Oração',
    'salmodia': 'Salmodia',
};

// Responsories and preces are dialogue: the V./R. markers stay red while
// the spoken line keeps the content colour.
function DialogueLines({ text }: { text: string }) {
    return (
        <div className="space-y-0.5">
            {text.split('\n').map((line, i) => {
                const m = line.match(/^([VR]\.)\s*(.*)$/);
                return (
                    <p key={i}>
                        {m ? (
                            <>
                                <span className={RED}>{m[1]}</span> {m[2]}
                            </>
                        ) : (
                            line
                        )}
                    </p>
                );
            })}
        </div>
    );
}

function AntLabel({ block }: { block: ComumBlock }) {
    const label = block.kind === 'ant-benedictus'
        ? 'Ant. Bened.'
        : block.kind === 'ant-magnificat'
            ? 'Ant. Magnif.'
            : `Ant.${block.n ? ` ${block.n}` : ''}`;
    return <span className={RED}>{label} </span>;
}

function Block({ block }: { block: ComumBlock }) {
    // Audience variant and seasonal alternatives keep their rubric label —
    // choosing between them is the reader's call, as in the printed book.
    const contextLabel = [block.variant, block.season].filter(Boolean).join(' — ');

    return (
        <div className="content-text text-zinc-800 dark:text-zinc-200">
            {contextLabel && (
                <p className={`text-sm mb-1 ${RED}`}>{contextLabel}</p>
            )}

            {block.kind === 'rubrica' || block.kind === 'introdução' ? (
                <p className={RED}>{block.text}</p>
            ) : block.kind === 'salmo' ? (
                <div>
                    <p className={`text-sm font-semibold text-center mb-2 ${RED}`}>{block.ref}</p>
                    <div className="space-y-0.5">
                        {block.verses?.map((v, i) => (
                            <p key={i}>
                                {v.n !== undefined && (
                                    <sup className={`text-[0.65em] mr-1 ${RED}`}>{v.n}</sup>
                                )}
                                {v.text}
                            </p>
                        ))}
                    </div>
                </div>
            ) : block.kind.startsWith('ant') ? (
                <p><AntLabel block={block} />{block.text}</p>
            ) : (
                <div>
                    {(KIND_LABEL[block.kind] || block.ref) && (
                        <p className="mt-6 mb-2 first:mt-0 flex items-baseline justify-between gap-2">
                            {KIND_LABEL[block.kind] && (
                                <span className={`text-base font-bold ${RED}`}>
                                    {KIND_LABEL[block.kind]}
                                </span>
                            )}
                            {block.ref && (
                                <span className={`text-sm ${RED}`}>{block.ref}</span>
                            )}
                        </p>
                    )}
                    {block.kind === 'responsório' || block.kind === 'preces' ? (
                        <DialogueLines text={block.text ?? ''} />
                    ) : (
                        <p className="whitespace-pre-line">{block.text}</p>
                    )}
                </div>
            )}
        </div>
    );
}

export function BreviaryBlocks({ sections }: { sections: AssembledSection[] }) {
    return (
        <div className="space-y-6">
            {sections.map((section) => (
                <div key={section.title} id={`section-${section.title}`} className="space-y-3">
                    {/* Same header style the page gives API-fed sections —
                        only in-content rubrics use the API's literal red. An
                        empty title renders blocks alone (spliced layouts). */}
                    {section.title && (
                        <h3 className="text-sm font-bold text-liturgy-600 dark:text-liturgy-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            {section.title}
                        </h3>
                    )}
                    <div className="space-y-4">
                        {section.blocks.map((block, i) => (
                            <Block key={i} block={block} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
