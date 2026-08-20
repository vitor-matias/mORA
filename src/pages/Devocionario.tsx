import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Star, ChevronRight, X, Copy, Check, BookMarked, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore } from "@/store/app";
import {
    PRAYERS,
    PRAYER_CATEGORIES,
    getPrayer,
    prayerOfTheDay,
    searchPrayers,
    type Prayer,
    type PrayerCategoryId,
} from "@/lib/devotional";

/** "Favoritas" behaves like a category chip but is not one — it filters by the
    reader's own list rather than by where a prayer belongs in the book. */
const FAVOURITES = '__favoritas__';
type Filter = PrayerCategoryId | typeof FAVOURITES | null;

const CATEGORY_LABEL = new Map(PRAYER_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * The Devocionário: the traditional prayers of the Church in European
 * Portuguese, searchable and starrable.
 *
 * One route serves both panes (`/devocionario/:prayerId?`). Below lg the two
 * swap — the list is the page until a prayer is opened, and the header's back
 * orb returns to the list instead of Home. From lg up they sit side by side,
 * list on the left (sticky, scrolling on its own) and the prayer on the right,
 * the same arrangement the Diretório Litúrgico uses.
 */
export default function Devocionario() {
    const { prayerId } = useParams();
    const prayer = getPrayer(prayerId);

    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>(null);

    const favourites = useAppStore((s) => s.favouritePrayers);
    const toggleFavourite = useAppStore((s) => s.togglePrayerFavourite);

    const results = useMemo(() => {
        if (filter !== FAVOURITES) return searchPrayers(query, filter);
        // Favourites keep the order they were starred in, so the newest is at
        // the top; searching within them still filters, but must not reshuffle.
        const matching = new Set(searchPrayers(query, null).map((p) => p.id));
        return favourites
            .map((id) => getPrayer(id))
            .filter((p): p is Prayer => !!p && matching.has(p.id));
    }, [query, filter, favourites]);

    // From lg up the index scrolls inside its own column, so a new search
    // has to bring it back to the top — otherwise the best matches are found
    // above the fold the reader is left looking at.
    const indexRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        indexRef.current?.scrollTo({ top: 0 });
    }, [query, filter]);

    // The suggestion belongs to the unfiltered view — once the reader is
    // looking for something specific, a second thing to read is noise.
    const showSuggestion = !query && filter === null;
    const suggestion = prayerOfTheDay();

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader
                title="Devocionário"
                subtitle="As orações da tradição da Igreja"
                backTo={prayer ? '/devocionario' : '/'}
            />

            <div className="p-6 max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto w-full flex-1 flex flex-col lg:flex-row lg:gap-8 lg:items-start">
                {/* Index column */}
                <div ref={indexRef} className={`w-full space-y-4 lg:w-96 lg:shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1 ${
                    prayer ? 'hidden lg:block' : ''
                }`}>
                    <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Procurar oração…"
                            aria-label="Procurar oração"
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

                    {/* Category chips — a horizontal rail on a phone, wrapping
                        into a block on desktop where there is width for it. */}
                    <div className="-mx-6 px-6 lg:mx-0 lg:px-0 overflow-x-auto lg:overflow-visible">
                        <div className="flex gap-2 w-max lg:w-auto lg:flex-wrap">
                            <Chip label="Todas" active={filter === null} onClick={() => setFilter(null)} />
                            {favourites.length > 0 && (
                                <Chip
                                    label="Favoritas"
                                    active={filter === FAVOURITES}
                                    onClick={() => setFilter(FAVOURITES)}
                                    icon={<Star size={12} className="fill-current" aria-hidden="true" />}
                                />
                            )}
                            {PRAYER_CATEGORIES.map((category) => (
                                <Chip
                                    key={category.id}
                                    label={category.label}
                                    active={filter === category.id}
                                    onClick={() => setFilter(category.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {showSuggestion && (
                        <Link
                            to={`/devocionario/${suggestion.id}`}
                            className="block surface surface-accent rounded-2xl px-4 py-3 transition-all active:scale-[0.99]"
                        >
                            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1">
                                Sugestão de hoje
                            </p>
                            <p className="text-sm font-semibold leading-snug text-liturgy-900 dark:text-liturgy-100">
                                {suggestion.title}
                            </p>
                            {suggestion.note && (
                                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{suggestion.note}</p>
                            )}
                        </Link>
                    )}

                    <p className="text-xs text-zinc-400 dark:text-zinc-500 px-1">
                        {results.length === PRAYERS.length
                            ? `${PRAYERS.length} orações`
                            : `${results.length} de ${PRAYERS.length} orações`}
                    </p>

                    {results.length === 0 ? (
                        <p className="text-sm text-zinc-500 px-1 py-6">
                            {filter === FAVOURITES
                                ? 'Nenhuma das suas orações favoritas corresponde a esta procura.'
                                : 'Nenhuma oração corresponde a esta procura.'}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {results.map((entry) => (
                                <li key={entry.id}>
                                    <Link
                                        to={`/devocionario/${entry.id}`}
                                        aria-current={entry.id === prayer?.id ? 'true' : undefined}
                                        className={`group flex items-center gap-3 px-4 py-3 surface rounded-2xl transition-all active:scale-[0.99] ${
                                            entry.id === prayer?.id ? 'surface-accent' : ''
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold leading-snug">{entry.title}</h3>
                                            <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                                {entry.note ?? CATEGORY_LABEL.get(entry.category)}
                                            </p>
                                        </div>
                                        {favourites.includes(entry.id) && (
                                            <Star size={13} className="shrink-0 text-liturgy-500 fill-current" aria-label="Favorita" />
                                        )}
                                        <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Reading column */}
                <div className={`flex-1 min-w-0 w-full ${prayer ? '' : 'hidden lg:block'}`}>
                    {prayer ? (
                        <PrayerView
                            prayer={prayer}
                            isFavourite={favourites.includes(prayer.id)}
                            onToggleFavourite={() => toggleFavourite(prayer.id)}
                        />
                    ) : (
                        <div className="surface rounded-3xl px-6 py-16 text-center">
                            <BookMarked size={28} className="mx-auto text-liturgy-500 mb-3" aria-hidden="true" />
                            <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
                                Escolha uma oração da lista, ou procure pelo nome — «terço», «Fátima», «pelos doentes».
                            </p>
                        </div>
                    )}
                </div>
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

function PrayerView({ prayer, isFavourite, onToggleFavourite }: {
    prayer: Prayer;
    isFavourite: boolean;
    onToggleFavourite: () => void;
}) {
    const [copied, setCopied] = useState(false);
    // Keyed by id: opening another prayer must not inherit the previous one's
    // "Copiado" flash or its expanded Latin.
    const [shownFor, setShownFor] = useState(prayer.id);
    if (shownFor !== prayer.id) {
        setShownFor(prayer.id);
        setCopied(false);
    }

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`${prayer.title}\n\n${prayer.text}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard permission denied or unavailable — the text is on
            // screen and selectable, so there is nothing to recover from.
        }
    };

    return (
        <article className="surface rounded-3xl p-6 lg:p-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1.5">
                {CATEGORY_LABEL.get(prayer.category)}
            </p>
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight page-title leading-tight">
                    {prayer.title}
                </h2>
                <div className="flex items-center gap-1 shrink-0 -mt-1">
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={copied ? 'Oração copiada' : 'Copiar oração'}
                        className="p-2 rounded-full text-zinc-400 hover:text-liturgy-600 dark:hover:text-liturgy-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        {copied ? <Check size={18} className="text-liturgy-600 dark:text-liturgy-400" /> : <Copy size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={onToggleFavourite}
                        aria-pressed={isFavourite}
                        aria-label={isFavourite ? 'Remover das favoritas' : 'Guardar nas favoritas'}
                        className={`p-2 rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                            isFavourite
                                ? 'text-liturgy-600 dark:text-liturgy-400'
                                : 'text-zinc-400 hover:text-liturgy-600 dark:hover:text-liturgy-400'
                        }`}
                    >
                        <Star size={18} className={isFavourite ? 'fill-current' : ''} />
                    </button>
                </div>
            </div>
            {prayer.note && (
                <p className="text-sm text-zinc-500 mt-2 leading-snug">{prayer.note}</p>
            )}

            <p className="content-text text-zinc-800 dark:text-zinc-200 whitespace-pre-line mt-6">
                {prayer.text}
            </p>

            {/* Some of these are prayed on beads rather than read — hand those
                over to the player that counts the beads. */}
            {prayer.chapletId && (
                <Link
                    to={`/coroas/${prayer.chapletId}`}
                    className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold cta-primary rounded-xl px-3.5 py-2.5 transition-colors active:scale-[0.98]"
                >
                    Rezar conta a conta <ArrowRight size={15} aria-hidden="true" />
                </Link>
            )}

            {prayer.latin && (
                <details
                    // Keyed by the prayer: `open` lives on the DOM node, so
                    // without this React reuses the element and the next
                    // prayer opens with its Latin already expanded.
                    key={prayer.id}
                    className="mt-8 border-t border-zinc-200/70 dark:border-zinc-700/60 pt-4"
                >
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 select-none">
                        Em latim
                    </summary>
                    <p className="content-text text-zinc-600 dark:text-zinc-400 whitespace-pre-line mt-4">
                        {prayer.latin}
                    </p>
                </details>
            )}
        </article>
    );
}
