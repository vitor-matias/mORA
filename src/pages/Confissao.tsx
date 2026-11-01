import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eraser, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrayerText } from "@/components/PrayerText";
import { getPrayer } from "@/lib/devotional";
import { CATECHISM_URL, CONTRITION_NOTE, DOUBTS, EXAM_GUIDE_URL, EXAM_NOTE, EXAMS, FOUR_CS, HOW_TO, PENANCE_NOTE, RITE, RITE_NOTE, type Exam, type RiteLine } from "@/lib/confession";

// An installed app stays in memory for hours: whoever picks up the unlocked
// phone later must not find the marks still there.
const FORGET_AFTER_HIDDEN_MS = 15 * 60_000;

const TABS = [
    { id: 'exame', label: 'Exame' },
    { id: 'duvidas', label: 'Dúvidas' },
    { id: 'como', label: 'Como confessar' },
] as const;
type Tab = typeof TABS[number]['id'];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                    ? 'cta-primary'
                    : 'surface text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
        >
            {label}
        </button>
    );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
    return <h2 id={id} className="text-lg font-bold tracking-tight mb-3">{children}</h2>;
}

function Line({ line }: { line: RiteLine }) {
    if (line.who === 'nota') {
        const prayer = line.prayerId ? getPrayer(line.prayerId) : undefined;
        return (
            <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">{line.text}</p>
                {prayer && <Spoken who="penitente" text={prayer.text} />}
            </>
        );
    }
    return <Spoken who={line.who} text={line.text} />;
}

function Spoken({ who, text }: { who: 'penitente' | 'sacerdote'; text: string }) {
    const priest = who === 'sacerdote';
    return (
        <div className={`rounded-2xl px-4 py-3 ${priest ? 'bg-liturgy-50 dark:bg-liturgy-900/30 ml-6' : 'surface mr-6'}`}>
            <p className={`text-[0.65rem] font-bold uppercase tracking-widest mb-1 ${priest ? 'text-liturgy-700 dark:text-liturgy-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {priest ? 'Sacerdote' : 'Eu'}
            </p>
            <PrayerText text={text} className="content-text text-zinc-800 dark:text-zinc-200" />
        </div>
    );
}

/**
 * Reconciliação (/reconciliacao): an exam of conscience to choose from, the Catechism's answers to
 * the usual doubts, then what is said in the confessional. What the penitent
 * marks lives in this component's state and nowhere else (no store, no
 * storage, no URL, no sync, no share): leaving the page, or 15 minutes away
 * from the app, forgets it. confession.test.ts holds that line.
 */
export default function Confissao() {
    // The tabs only choose what is shown: the marks live here, above them,
    // so moving between tabs keeps them.
    const [tab, setTab] = useState<Tab>('exame');
    const [examId, setExamId] = useState<Exam['id']>('adultos');
    // Keyed by exam, section and line, so marks survive switching exams.
    const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
    const examHeading = useRef<HTMLHeadingElement>(null);
    const exam = EXAMS.find((e) => e.id === examId) ?? EXAMS[0];
    const toggle = (key: string) => setMarked((prev) => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        return next;
    });
    const clear = () => {
        setMarked(new Set());
        examHeading.current?.focus();
    };
    // Only the open exam's marks: a parent who switches to Crianças to go
    // through it with a child must not show the child their own list.
    const toTell = exam.sections.flatMap((section, s) => section.questions.flatMap((question, i) => {
        const key = `${exam.id}-${s}-${i}`;
        return marked.has(key) ? [{ key, question }] : [];
    }));

    useEffect(() => {
        let hiddenAt = 0;
        const onVisibility = () => {
            if (document.hidden) hiddenAt = Date.now();
            else if (hiddenAt && Date.now() - hiddenAt > FORGET_AFTER_HIDDEN_MS) setMarked(new Set());
        };
        const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setMarked(new Set()); };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow);
        };
    }, []);

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title="Reconciliação" subtitle="Exame de consciência e o que dizer" backTo="/" />
            <div className="p-6 pb-8 w-full max-w-md lg:max-w-2xl mx-auto space-y-10">
                <div role="tablist" aria-label="Reconciliação" className="flex gap-1 surface rounded-2xl p-1">
                    {TABS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            id={`confissao-tab-${id}`}
                            aria-selected={tab === id}
                            aria-controls={`confissao-panel-${id}`}
                            onClick={() => setTab(id)}
                            // Sized by label, not in equal thirds: «Como confessar» needs
                            // twice the width of «Exame» on a phone.
                            className={`flex-auto min-w-0 min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors ${
                                tab === id
                                    ? 'bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {/* Wraps to two lines rather than clipping, on a narrow
                                phone or with a large text size. */}
                            <span className="block leading-tight">{label}</span>
                        </button>
                    ))}
                </div>

                {tab === 'exame' && (
                    <div role="tabpanel" id="confissao-panel-exame" aria-labelledby="confissao-tab-exame" className="space-y-10">
                        <p className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            <Lock size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                            Nada do que se marca aqui é guardado pela aplicação nem sai deste aparelho. As marcas apagam-se ao sair da página ou passados 15 minutos fora da aplicação.
                        </p>

                        <section aria-labelledby="exame">
                            <h2 id="exame" ref={examHeading} tabIndex={-1} className="text-lg font-bold tracking-tight mb-3 outline-none">Exame de consciência</h2>
                            {/* Chip rail: scrolls sideways on a phone, wraps on desktop. */}
                            <div className="-mx-6 px-6 lg:mx-0 lg:px-0 overflow-x-auto lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <div role="group" aria-label="Escolher o exame" className="flex gap-2 w-max lg:w-auto lg:flex-wrap">
                                    {EXAMS.map((e) => (
                                        <Chip key={e.id} label={e.label} active={e.id === exam.id} onClick={() => setExamId(e.id)} />
                                    ))}
                                </div>
                            </div>
                            {exam.intro && <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-4">{exam.intro}</p>}
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-3">{HOW_TO} {EXAM_NOTE}</p>
                            {exam.sections.map((section, s) => (
                                <div key={`${exam.id}-${s}`} className="mt-5">
                                    {section.part && <p className="text-sm italic text-liturgy-700 dark:text-liturgy-300 leading-snug mb-3">{section.part}</p>}
                                    {section.title && <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{section.title}</h3>}
                                    <ul className="space-y-2">
                                        {section.questions.map((question, i) => {
                                            const key = `${exam.id}-${s}-${i}`;
                                            const on = marked.has(key);
                                            return (
                                                <li key={key}>
                                                    <button
                                                        type="button"
                                                        aria-pressed={on}
                                                        onClick={() => toggle(key)}
                                                        className="pressable w-full text-left flex gap-3 p-3 rounded-xl surface"
                                                    >
                                                        <span className={`mt-1 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center ${
                                                            on ? 'bg-liturgy-600 border-liturgy-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                                                        }`}>
                                                            {on && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                                                        </span>
                                                        <span className="text-base leading-snug text-zinc-800 dark:text-zinc-200">{question}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </section>

                        {toTell.length > 0 && (
                            <section aria-labelledby="levar" className="p-4 surface rounded-2xl">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <h2 id="levar" className="text-base font-bold">Para levar à confissão</h2>
                                    <button
                                        type="button"
                                        onClick={clear}
                                        className="pressable pressable-small min-h-11 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 px-2.5 rounded-lg"
                                    >
                                        <Eraser size={14} aria-hidden="true" /> Limpar
                                    </button>
                                </div>
                                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                                    {toTell.map(({ key, question }) => <li key={key}>{question}</li>)}
                                </ol>
                    </section>
                )}
                </div>
                )}

                {tab === 'duvidas' && (
                    <div role="tabpanel" id="confissao-panel-duvidas" aria-labelledby="confissao-tab-duvidas">
                        <div className="space-y-2">
                            {DOUBTS.map((doubt) => (
                                <details key={doubt.cic} className="surface rounded-xl px-4 py-3">
                                    <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200 select-none">
                                        {doubt.question}
                                    </summary>
                                    <PrayerText text={doubt.answer} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mt-3" />
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Catecismo da Igreja Católica, n.º {doubt.cic}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'como' && (
                    <div role="tabpanel" id="confissao-panel-como" aria-labelledby="confissao-tab-como" className="space-y-10">
                        <section aria-labelledby="confessionario">
                            <SectionTitle id="confessionario">No confessionário</SectionTitle>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug -mt-1 mb-4">{RITE_NOTE}</p>
                            <ol className="space-y-6">
                                {RITE.map((lines, n) => (
                                    <li key={n} className="flex gap-3">
                                        <span className="h-7 w-7 shrink-0 rounded-full icon-chip text-liturgy-700 dark:text-liturgy-300 text-sm font-bold flex items-center justify-center" aria-hidden="true">
                                            {n + 1}
                                        </span>
                                        <div className="flex-1 min-w-0 space-y-2">
                                            {lines.map((line, i) => <Line key={i} line={line} />)}
                                            {/* How to say the sins belongs with saying them. */}
                                            {n === 1 && (
                                                <dl className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug space-y-1 pt-1">
                                                    {FOUR_CS.map(([term, gloss]) => (
                                                        <div key={term}><dt className="inline font-semibold text-zinc-800 dark:text-zinc-200">{term}:</dt> <dd className="inline">{gloss}</dd></div>
                                                    ))}
                                                </dl>
                                            )}
                                            {/* Opened in place: a link to the Devocionário would leave
                                                the page and lose the marks. */}
                                            {n === 3 && (
                                                <>
                                                    <details className="text-sm">
                                                        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400 underline select-none">Ou a fórmula longa do Acto de contrição</summary>
                                                        <div className="mt-2"><Spoken who="penitente" text={getPrayer('acto-de-contricao')?.text ?? ''} /></div>
                                                    </details>
                                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">{CONTRITION_NOTE}</p>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section aria-labelledby="penitencia">
                            <SectionTitle id="penitencia">Cumprir a penitência</SectionTitle>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{PENANCE_NOTE}</p>
                        </section>
                    </div>
                )}

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed text-balance">
                    Exames e guia: <a href={EXAM_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="underline">Opus Dei Portugal</a> e
                    paróquia de Our Lady Queen of Peace (Dublin); exame pelos mandamentos: <a href={EXAMS.find((e) => e.id === 'mandamentos')?.source} target="_blank" rel="noopener noreferrer" className="underline">Ritual da Penitência</a> (Secretariado Nacional de Liturgia); exame do Papa Francisco: <a href={EXAMS.find((e) => e.id === 'francisco')?.source} target="_blank" rel="noopener noreferrer" className="underline">Dicastério para a Evangelização</a>;
                    {' '}<a href={CATECHISM_URL} target="_blank" rel="noopener noreferrer" className="underline">Catecismo da Igreja Católica</a>.
                    {' '}Para rever o dia antes de dormir, o <Link to="/devocionario/exame-de-consciencia" className="underline">Exame de consciência</Link> do Devocionário.
                </p>
            </div>
        </div>
    );
}
