import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Calendar, Filter } from "lucide-react";
import { fetchDailyLiturgy } from "@/lib/liturgy";
import type { DailyLiturgy } from "@/lib/liturgy";
import { useAppStore } from "@/store/app";

export default function Liturgy() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOnlyReadings, setShowOnlyReadings] = useState(true);

    const { incrementStreak, liturgicalDescription } = useAppStore();

    useEffect(() => {
        async function loadLiturgy() {
            setLoading(true);
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const data = await fetchDailyLiturgy(dateStr);
            setLiturgy(data);
            if (data?.saintOfDay !== 'Sem Ligação') {
                incrementStreak('liturgy');
                const { publishStreakToNostr } = await import('@/lib/nostr');
                publishStreakToNostr();
            }
            setLoading(false);
        }

        loadLiturgy();
    }, [incrementStreak]);

    const displayHtml = useMemo(() => {
        if (!liturgy?.htmlContent) return '';
        if (!showOnlyReadings) return liturgy.htmlContent;

        // Try to extract only from LEITURA I up to the end of EVANGELHO
        const html = liturgy.htmlContent;
        const startIdx = html.indexOf('<p><strong>LEITURA I');
        const endOblatas = html.indexOf('<p><strong>Oração sobre as oblatas');
        const endCredo = html.indexOf('<p><strong>Credo'); // some solemnities have Credo before oblatas

        let endIdx = html.length;
        if (endCredo > startIdx) {
            endIdx = endCredo;
        } else if (endOblatas > startIdx) {
            endIdx = endOblatas;
        }

        if (startIdx !== -1) {
            let extracted = html.substring(startIdx, endIdx);
            // Remove Acclamation before Gospel if we only want readings
            extracted = extracted.replace(/<p><strong>ACLAMAÇÃO ANTES DO EVANGELHO<\/strong>[\s\S]*?(?=<p><strong>EVANGELHO<\/strong>)/i, '');
            return extracted;
        }

        return html; // fallback
    }, [liturgy, showOnlyReadings]);

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="max-w-md mx-auto flex-1 w-full flex flex-col">
            <header className={`sticky top-0 z-30 bg-[#FAF9F6]/90 dark:bg-[#121212]/90 backdrop-blur-md flex flex-col shrink-0 border-b transition-all duration-300 ${isScrolled
                ? 'p-4 pt-6 gap-2 border-zinc-200/50 dark:border-zinc-800/50 shadow-sm'
                : 'p-6 pt-12 gap-4 border-transparent'
                }`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.history.back()}
                        className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 rounded-full shadow-sm transition-all duration-300 flex-shrink-0 ${isScrolled ? 'p-1.5' : 'p-2'
                            }`}
                    >
                        <ChevronRight className="rotate-180" size={isScrolled ? 20 : 24} />
                    </button>
                    <div className="min-w-0">
                        <h1 className={`font-bold tracking-tight text-zinc-900 dark:text-zinc-50 transition-all duration-300 truncate ${isScrolled ? 'text-xl' : 'text-3xl'
                            }`}>Missa Diária</h1>
                        <p className={`text-zinc-500 capitalize font-medium mt-0.5 transition-all duration-300 truncate ${isScrolled ? 'text-xs opacity-80' : 'text-sm'
                            }`}>{liturgy?.saintOfDay || 'A carregar...'}</p>
                    </div>
                </div>
            </header>

            <div className="p-6 pt-2 space-y-6 flex-1 flex flex-col">

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-amber-500 animate-spin"></div>
                        <p className="text-zinc-400">A obter leituras de hoje...</p>
                    </div>
                ) : liturgy ? (
                    <div className="space-y-6 flex-1 flex flex-col">
                        {/* Header Info Banner */}
                        <div className="bg-liturgy-50 dark:bg-liturgy-950/20 border border-liturgy-100 dark:border-liturgy-900/50 rounded-2xl p-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-liturgy-600 dark:text-liturgy-400" size={24} />
                                <div>
                                    <p className="font-semibold text-liturgy-900 dark:text-liturgy-100 capitalize">
                                        {new Date(liturgy.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                    {liturgicalDescription && (
                                        <p className="text-sm mt-1 text-liturgy-800 dark:text-liturgy-300 leading-snug whitespace-pre-line">
                                            {liturgicalDescription}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Filter Toggle */}
                        <div className="flex items-center justify-end">
                            <button
                                onClick={() => setShowOnlyReadings(!showOnlyReadings)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showOnlyReadings
                                    ? 'bg-liturgy-100 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-400 border-liturgy-200 dark:border-liturgy-800'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                <Filter size={16} />
                                {showOnlyReadings ? 'Apenas Leituras' : 'Missal Completo'}
                            </button>
                        </div>

                        {/* Mass Readings */}
                        <article className="
                        flex-1
                        content-text
                        text-justify
                        text-zinc-800 dark:text-zinc-200 
                        [&_p]:mb-5 
                        [&_p:last-child]:mb-0
                        [&_strong]:font-bold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100
                        [&_em]:italic [&_em]:text-zinc-700 dark:[&_em]:text-zinc-300
                        [&_i]:italic [&_i]:text-zinc-700 dark:[&_i]:text-zinc-300
                        [&_br]:mb-2
                    ">
                            <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                        </article>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                        <p className="text-zinc-500">Não foi possível carregar a liturgia de hoje.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
