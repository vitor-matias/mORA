import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Undo2, RotateCcw, Clock } from "lucide-react";
import { Rosary } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActions } from "@/components/layout/StickyActions";
import { useAppStore } from "@/store/app";
import type { ChapletMode } from "@/store/app";
import { CHAPLETS, generateChapletSequence, getChaplet, beadsPerGroup } from "@/lib/chaplets";
import type { Chaplet } from "@/lib/chaplets";

/**
 * Coroas e Terços — the chaplets that are not the Rosary, prayed the same
 * way the Rosary page prays it: one bead per tap, so the phone does the
 * counting and the reader does the praying.
 *
 * `/coroas` lists them; `/coroas/:chapletId` walks one. The two share a route
 * component only for the header; the player is its own component, keyed by
 * chaplet id so switching chaplets always starts from the first bead.
 */
export default function Chaplets() {
    const { chapletId } = useParams();
    const chaplet = getChaplet(chapletId);

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader
                title={chaplet ? chaplet.title : 'Coroas e Terços'}
                subtitle={chaplet ? chaplet.shape : 'As devoções que se rezam nas contas'}
                backTo={chaplet ? '/coroas' : '/'}
            />
            {chaplet
                ? <ChapletPlayer key={chaplet.id} chaplet={chaplet} />
                : <ChapletChooser />}
        </div>
    );
}

function ChapletChooser() {
    return (
        <div className="p-6 pb-8 w-full max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto">
            {/* text-balance so the last line never comes out as a stray
                "por si." — the browser evens the lines instead of filling the
                first one and orphaning whatever is left. */}
            <p className="text-sm text-zinc-500 leading-relaxed mb-5 lg:max-w-2xl text-balance">
                Cada coroa reza-se conta a conta, como o terço. Toca para avançar. A aplicação conta por ti.
            </p>
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
                {CHAPLETS.map((chaplet) => (
                    <Link
                        key={chaplet.id}
                        to={`/coroas/${chaplet.id}`}
                        className="group flex items-start gap-4 p-4 surface rounded-2xl transition-all active:scale-[0.99]"
                    >
                        <div className="h-11 w-11 shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Rosary size={20} strokeWidth={2.2} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold leading-tight">{chaplet.title}</h2>
                            <p className="text-zinc-500 text-xs mt-1 leading-snug">{chaplet.subtitle}</p>
                            {/* Duration first: every one of them reads
                                "≈ N minutos", so it is the same width on
                                every card and the shape after it starts in
                                the same place. The other way round, the shape
                                runs from "5 dezenas" to "9 saudações de 1 + 3
                                contas" and the clock wanders 100px down the
                                list. */}
                            <p className="flex items-center gap-3 text-[0.7rem] text-zinc-400 dark:text-zinc-500 mt-2">
                                <span className="flex items-center gap-1">
                                    <Clock size={11} aria-hidden="true" />
                                    {chaplet.duration}
                                </span>
                                <span>{chaplet.shape}</span>
                            </p>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300 dark:text-zinc-600 shrink-0 mt-1" aria-hidden="true" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

/** Both modes share it: guided shows it only before the first bead, where the
    choice still matters; the text mode always shows it. */
function ModePicker({ mode, onChange }: { mode: ChapletMode; onChange: (mode: ChapletMode) => void }) {
    return (
        <div className="mb-8">
            <div role="group" aria-label="Modo da coroa" className="flex w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
                {([['guiado', 'Guiado'], ['resumido', 'Só as orações']] as [ChapletMode, string][]).map(([value, label]) => (
                    <button
                        type="button"
                        key={value}
                        onClick={() => onChange(value)}
                        aria-pressed={mode === value}
                        className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                            mode === value
                                ? 'surface text-liturgy-700 dark:text-liturgy-400'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-2">
                {mode === 'guiado'
                    ? 'Todas as orações, conta a conta.'
                    : 'As orações numa só página — reze nas suas contas, ao seu ritmo.'}
            </p>
        </div>
    );
}

/** Everything the chaplet says, on one page: the opening prayers, the two
    bead prayers written out, what is meditated in each group, and the close.
    For anyone praying on a real rosary, who does not want to tap a bead. */
function ChapletText({ chaplet, picker }: { chaplet: Chaplet; picker: React.ReactNode }) {
    return (
        <div className="p-6 pb-8 w-full max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto">
            <div className="lg:max-w-2xl lg:mx-auto">
                {picker}
                <p className="text-xs text-zinc-500 leading-relaxed mb-6">{chaplet.note}</p>

                <Section title="Para começar">
                    {chaplet.opening.map((prayer, i) => (
                        <Passage key={i} label={prayer.title} text={prayer.text} repeat={prayer.repeat} />
                    ))}
                </Section>

                <Section title="Em cada grupo">
                    <Passage
                        label={`Na conta grande — ${chaplet.largeBead.title}`}
                        text={chaplet.largeBead.text}
                    />
                    <Passage
                        label={`Nas contas pequenas — ${chaplet.smallBead.title}, ${chaplet.smallBeads} ${chaplet.smallBeads === 1 ? 'vez' : 'vezes'}`}
                        text={chaplet.smallBead.text}
                    />
                    {chaplet.afterEachGroup && (
                        <Passage
                            label={`No fim do grupo — ${chaplet.afterEachGroup.title}`}
                            text={chaplet.afterEachGroup.text}
                        />
                    )}
                </Section>

                <Section title={`Os ${chaplet.groups.length} grupos`}>
                    <ol className="space-y-4 list-none">
                        {chaplet.groups.map((group, i) => (
                            <li key={i}>
                                <p className="text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400">
                                    {group.title}
                                </p>
                                {group.meditation && (
                                    <p className="content-text italic text-zinc-700 dark:text-zinc-300 mt-1">
                                        {group.meditation}
                                    </p>
                                )}
                                {group.smallBeadTexts && (
                                    <ul className="mt-2 space-y-1 list-none">
                                        {group.smallBeadTexts.map((text, j) => (
                                            <li key={j} className="content-text text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                                                {text}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section title="Para terminar">
                    {chaplet.ending.map((prayer, i) => (
                        <Passage key={i} label={prayer.title} text={prayer.text} repeat={prayer.repeat} />
                    ))}
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1">
                {title}
            </h2>
            <div className="surface rounded-2xl p-5 space-y-5">{children}</div>
        </section>
    );
}

function Passage({ label, text, repeat }: { label: string; text: string; repeat?: number }) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1">
                {label}{repeat && repeat > 1 ? ` (${repeat} vezes)` : ''}
            </p>
            <p className="content-text text-zinc-800 dark:text-zinc-200 whitespace-pre-line">{text}</p>
        </div>
    );
}

function ChapletPlayer({ chaplet }: { chaplet: Chaplet }) {
    const setBottomBarYielded = useAppStore((s) => s.setBottomBarYielded);
    const mode = useAppStore((s) => s.chapletMode);
    const setMode = useAppStore((s) => s.setChapletMode);

    const sequence = useMemo(() => generateChapletSequence(chaplet), [chaplet]);
    const [stepIndex, setStepIndex] = useState(0);

    const step = sequence[Math.min(stepIndex, sequence.length - 1)];
    const atStart = stepIndex === 0;
    const atEnd = stepIndex === sequence.length - 1;

    // Once praying has started, the floating bar covers the card and sits
    // right under the Continuar button — the same reason the rosary session
    // hides it. Cleared on unmount so it never outlives the page.
    useEffect(() => {
        setBottomBarYielded(mode === 'guiado' && !atStart);
    }, [mode, atStart, setBottomBarYielded]);
    useEffect(() => () => setBottomBarYielded(false), [setBottomBarYielded]);

    // Every bead is a new card — start it at the top of the screen.
    useEffect(() => { window.scrollTo(0, 0); }, [stepIndex]);

    // The last bead is the end of it: there is nothing after the final prayer
    // to advance to, and nothing to record.
    const next = () => {
        if (atEnd) return;
        window.navigator?.vibrate?.(50);
        setStepIndex((i) => i + 1);
    };

    const totalBeads = beadsPerGroup(chaplet);
    const changeMode = (next: ChapletMode) => {
        setMode(next);
        setStepIndex(0);
    };
    const picker = <ModePicker mode={mode} onChange={changeMode} />;

    if (mode === 'resumido') {
        return <ChapletText chaplet={chaplet} picker={picker} />;
    }

    return (
        <div className="p-6 pb-0 flex-1 w-full flex flex-col max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto relative">
            <div className="flex-1 flex flex-col mt-4 relative z-10 w-full lg:max-w-2xl lg:mx-auto">
                {!atStart && (
                    <button
                        type="button"
                        onClick={() => { setStepIndex(0); }}
                        className="self-end flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 py-1.5 mb-2"
                    >
                        <RotateCcw size={14} aria-hidden="true" />
                        Recomeçar
                    </button>
                )}

                {/* The card is the bead: tapping it advances, like turning one. */}
                <div
                    onClick={next}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }}
                    className="surface rounded-3xl p-6 mb-8 min-h-[240px] flex flex-col cursor-pointer select-none active:scale-[0.995] transition-transform"
                >
                    <span className="inline-block px-3 py-1 bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 text-xs font-bold uppercase tracking-wider rounded-xl mb-4 self-start shrink-0">
                        {step.title}
                    </span>
                    <div className="flex-1 flex flex-col justify-center overflow-y-auto">
                        <p className={`content-text text-zinc-800 dark:text-zinc-200 whitespace-pre-line font-medium ${
                            step.kind === 'anuncio' ? 'italic' : ''
                        }`}>
                            {step.content}
                        </p>
                    </div>
                </div>

                {atStart && (
                    <>
                        {picker}
                        <div className="surface rounded-2xl px-4 py-3 mb-8">
                            <p className="text-xs text-zinc-500 leading-relaxed">{chaplet.note}</p>
                        </div>
                    </>
                )}

                {/* Bead strip — only while actually on the beads. */}
                {step.beadIndex !== undefined && step.groupIndex !== undefined ? (
                    <div className="mt-auto mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-medium text-zinc-500">
                                {chaplet.groups[step.groupIndex - 1].title} · {step.groupIndex} de {chaplet.groups.length}
                            </span>
                            <span className="text-sm font-medium text-zinc-500">
                                {step.beadIndex === 0
                                    ? chaplet.largeBead.title
                                    : step.beadIndex > chaplet.smallBeads
                                        ? chaplet.afterEachGroup?.title
                                        : `Conta ${step.beadIndex} de ${chaplet.smallBeads}`}
                            </span>
                        </div>
                        <div className="flex justify-center gap-2.5 items-center flex-wrap">
                            {[...Array(totalBeads)].map((_, i) => {
                                const isMarker = i === 0 || (chaplet.afterEachGroup && i === totalBeads - 1);
                                return (
                                    <div
                                        key={i}
                                        className={`rounded-full transition-all duration-300 shrink-0 ${
                                            isMarker ? 'h-5 w-5 border-2 border-current' : 'h-2.5 w-2.5'
                                        } ${
                                            i < step.beadIndex!
                                                ? 'bg-liturgy-500 border-liturgy-500'
                                                : i === step.beadIndex
                                                    ? 'bg-liturgy-600 border-liturgy-600 scale-125 shadow-md shadow-liturgy-500/20'
                                                    : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800'
                                        }`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="mt-auto mb-8 h-12" />
                )}

                {/* Stuck to the foot of the viewport — see StickyActions. */}
                <StickyActions clearsBottomBar={atStart}>
                    {!atStart && (
                        <button
                            type="button"
                            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                            aria-label="Passo anterior"
                            className="w-16 shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl flex items-center justify-center transition-all active:scale-[0.96]"
                        >
                            <Undo2 size={22} />
                        </button>
                    )}
                    {!atEnd && (
                        <button
                            type="button"
                            onClick={next}
                            className="flex-1 h-20 cta-primary rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            {atStart ? 'Começar' : 'Continuar'} <ChevronRight size={24} />
                        </button>
                    )}
                </StickyActions>
            </div>
        </div>
    );
}

