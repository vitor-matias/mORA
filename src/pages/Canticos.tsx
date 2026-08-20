import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, BookMarked, Search, X, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore } from "@/store/app";
import {
    CHANTS,
    CHANT_CATEGORIES,
    chantsByCategory,
    getChant,
    resolveChant,
    searchChants,
    toStanzas,
    type ChantCategoryId,
    type ResolvedChant,
} from "@/lib/chants";

/** Like the Devocionário's, a chip that filters by the reader's own list
    rather than by where a hymn belongs in the year. */
const FAVOURITES = '__favoritos__';
type Filter = ChantCategoryId | typeof FAVOURITES | null;

/**
 * Cânticos — the traditional repertoire, laid out the way a hymnal is: by
 * the season or the occasion it is sung in. Everything here is either a Latin
 * hymn of the Church or a Portuguese hymn the parishes have sung for
 * generations; the ones whose words are also prayed live in the Devocionário
 * and are rendered from there, with a link across.
 *
 * A search cuts across the seasons and returns one ranked list; without a
 * query the chips narrow the page to a season and it stays a hymnal, section
 * by section.
 */
export default function Canticos() {
    const [filter, setFilter] = useState<Filter>(null);
    const [query, setQuery] = useState('');
    const favourites = useAppStore((s) => s.favouriteChants);

    const inFavourites = filter === FAVOURITES;
    const categories = filter === null || inFavourites
        ? CHANT_CATEGORIES
        : CHANT_CATEGORIES.filter((c) => c.id === filter);

    // Starred hymns keep the order they were starred in, newest first, and a
    // search inside them filters without reshuffling.
    const starred = useMemo(() => {
        if (!inFavourites) return null;
        const matching = new Set(searchChants(query, null).map((c) => c.id));
        return favourites
            .map((id) => getChant(id))
            .filter((c): c is NonNullable<typeof c> => !!c && matching.has(c.id))
            .map(resolveChant);
    }, [inFavourites, favourites, query]);

    // A search cuts across the seasons, so it drops the headings and shows one
    // ranked list; without a query the page stays a hymnal, section by section.
    const category = filter === FAVOURITES ? null : filter;
    const results = starred ?? (query ? searchChants(query, category) : null);

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title="Cânticos" subtitle="Os hinos que a Igreja canta" />

            <div className="p-6 pb-8 w-full max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto">
                <div className="relative mb-4">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Procurar cântico…"
                        aria-label="Procurar cântico"
                        className="w-full surface rounded-2xl pl-10 pr-10 py-3 text-sm bg-transparent outline-none focus:border-liturgy-400 dark:focus:border-liturgy-600 transition-colors [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Limpar procura"
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>

                {/* Chip rail — scrolls sideways on a phone, wraps on desktop. */}
                <div className="-mx-6 px-6 lg:mx-0 lg:px-0 overflow-x-auto lg:overflow-visible mb-6">
                    <div className="flex gap-2 w-max lg:w-auto lg:flex-wrap">
                        <Chip label="Todos" active={filter === null} onClick={() => setFilter(null)} />
                        {favourites.length > 0 && (
                            <Chip
                                label="Favoritos"
                                active={inFavourites}
                                onClick={() => setFilter(FAVOURITES)}
                                icon={<Star size={12} className="fill-current" aria-hidden="true" />}
                            />
                        )}
                        {CHANT_CATEGORIES.map((category) => (
                            <Chip
                                key={category.id}
                                label={category.label}
                                active={filter === category.id}
                                onClick={() => setFilter(category.id)}
                            />
                        ))}
                    </div>
                </div>

                <p className="text-xs text-zinc-400 dark:text-zinc-500 px-1 mb-3">
                    {results
                        ? `${results.length} de ${CHANTS.length} cânticos`
                        : `${CHANTS.length} cânticos`}
                </p>

                {results ? (
                    results.length === 0 ? (
                        <p className="text-sm text-zinc-500 px-1 py-6">
                            {inFavourites
                                ? 'Nenhum dos seus cânticos favoritos corresponde a esta procura.'
                                : 'Nenhum cântico corresponde a esta procura.'}
                        </p>
                    ) : (
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
                            {results.map((chant) => (
                                <ChantCard key={chant.id} chant={chant} />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="space-y-8">
                        {categories.map((category) => (
                            <section key={category.id}>
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 px-1">
                                    {category.heading}
                                </h2>
                                <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
                                    {chantsByCategory(category.id).map((chant) => (
                                        <ChantCard key={chant.id} chant={chant} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Chip({ label, active, onClick, icon }: {
    label: string;
    active: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                    ? 'cta-primary'
                    : 'surface text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

/**
 * A sung text, stanza by stanza. The refrain is set apart the way a hymnal
 * sets it apart — indented behind a coloured rule and italic — because on a
 * page of otherwise identical stanzas the one everybody joins in on is the
 * one you need to find without reading.
 */
function Sung({ text, muted = false }: { text: string; muted?: boolean }) {
    const stanzas = toStanzas(text);
    const tone = muted ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200';
    return (
        <div className="space-y-4">
            {stanzas.map((stanza, i) => (
                stanza.isRefrain ? (
                    <div key={i} className="pl-4 border-l-2 border-liturgy-500/60">
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1">
                            Refrão
                        </p>
                        <p className={`content-text whitespace-pre-line italic ${tone}`}>
                            {stanza.text}
                        </p>
                    </div>
                ) : (
                    <p key={i} className={`content-text whitespace-pre-line ${tone}`}>
                        {stanza.text}
                    </p>
                )
            ))}
        </div>
    );
}

function ChantCard({ chant }: { chant: ResolvedChant }) {
    const [open, setOpen] = useState(false);
    const isFavourite = useAppStore((s) => s.favouriteChants.includes(chant.id));
    const toggleFavourite = useAppStore((s) => s.toggleChantFavourite);

    return (
        <article id={chant.id} className="surface rounded-2xl overflow-hidden">
            {/* The star sits beside the disclosure rather than inside it —
                nesting a button in a button is invalid, and starring a hymn
                should not also open it. */}
            <div className="flex items-start">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="flex-1 min-w-0 flex items-start gap-3 pl-5 py-4 text-left"
                >
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold leading-tight">{chant.title}</h3>
                        <p className="text-zinc-500 text-xs mt-1 leading-snug">{chant.note}</p>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`text-zinc-400 shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    onClick={() => toggleFavourite(chant.id)}
                    aria-pressed={isFavourite}
                    aria-label={isFavourite
                        ? `Remover ${chant.title} dos favoritos`
                        : `Guardar ${chant.title} nos favoritos`}
                    className={`shrink-0 mt-3 mr-3 ml-1 p-2 rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                        isFavourite
                            ? 'text-liturgy-600 dark:text-liturgy-400'
                            : 'text-zinc-300 dark:text-zinc-600 hover:text-liturgy-600 dark:hover:text-liturgy-400'
                    }`}
                >
                    <Star size={16} className={isFavourite ? 'fill-current' : ''} />
                </button>
            </div>

            {open && (
                <div className="px-5 pb-5 -mt-1">
                    {/* Portuguese leads, the way it does in the Devocionário —
                        the Latin follows as the second setting, under a rule.
                        A chant sung only in Latin (O sanctissima) has no
                        Portuguese to lead with, so the Latin takes the top
                        slot and loses the label. */}
                    {chant.body && <Sung text={chant.body} />}
                    {chant.latinBody && (
                        <div className={chant.body
                            ? 'mt-5 pt-4 border-t border-zinc-200/70 dark:border-zinc-700/60'
                            : ''
                        }>
                            {chant.body && (
                                <p className="text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-2">
                                    Em latim
                                </p>
                            )}
                            <Sung text={chant.latinBody} muted={!!chant.body} />
                        </div>
                    )}
                    {chant.prayerId && (
                        <Link
                            to={`/devocionario/${chant.prayerId}`}
                            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-liturgy-600 dark:text-liturgy-400 hover:underline"
                        >
                            <BookMarked size={13} aria-hidden="true" />
                            Ver no Devocionário
                        </Link>
                    )}
                </div>
            )}
        </article>
    );
}
