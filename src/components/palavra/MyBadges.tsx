import { useEffect, useState } from 'react';
import { Award, Loader2 } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';
import { useTranslations } from '@/lib/i18n';

type Publishing = 'idle' | 'saving' | 'done' | 'failed';

/**
 * The signed-in identity's badges, in Perfil, with the button that puts them
 * on their Nostr profile.
 *
 * That button is the whole point of the feature. An award is an event on a
 * relay that nothing displays; NIP-58 has the *recipient* publish a kind-30008
 * list saying which badges to show, and that list is what makes them appear
 * beside a person's name in Damus, Amethyst, Primal and the rest. Winning is
 * the publisher's doing; showing it is not something this app should do on
 * someone's behalf, so it is a button and never automatic.
 */
export function MyBadges({ pubkey }: { pubkey: string }) {
    const t = useTranslations().palavra;
    const [badges, setBadges] = useState<EarnedBadge[] | null>(null);
    const [publishing, setPublishing] = useState<Publishing>('idle');

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/badges')
            .then(({ fetchBadges }) => fetchBadges(pubkey))
            .then((earned) => { if (!cancelled) setBadges(earned); })
            .catch((error: unknown) => {
                console.warn('Could not load badges.', error);
                if (!cancelled) setBadges([]);
            });
        return () => { cancelled = true; };
    }, [pubkey]);

    // Nothing to show and nothing to explain: someone who has never placed
    // doesn't need a section about badges taking up their profile page.
    if (badges !== null && badges.length === 0) return null;

    const onPublish = async () => {
        if (!badges) return;
        setPublishing('saving');
        try {
            const { setPalavraProfileBadges } = await import('@/lib/palavra/badges');
            await setPalavraProfileBadges(pubkey, badges);
            setPublishing('done');
        } catch (error) {
            // Includes the deliberate refusal when the existing list can't be
            // read — publishing then would strip badges from other issuers.
            console.warn('Could not update the profile badges.', error);
            setPublishing('failed');
        }
    };

    return (
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-medium">{t.badgesTitle}</p>

            {badges === null ? (
                <p className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    {t.badgesLoading}
                </p>
            ) : (
                <>
                    <ul className="mt-3 space-y-2">
                        {badges.map((badge) => (
                            <li key={badge.coord} className="flex items-center gap-3">
                                <span className="h-9 w-9 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Award size={18} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold truncate">{badge.name}</span>
                                    {badge.description && (
                                        <span className="block text-xs text-zinc-500 truncate">{badge.description}</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="text-xs text-zinc-500 mt-3">{t.badgesPublishHelp}</p>
                    <button
                        onClick={onPublish}
                        disabled={publishing === 'saving'}
                        className="mt-2 w-full py-2 px-4 rounded-xl font-medium text-sm bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300 hover:bg-liturgy-500/20 transition-colors disabled:opacity-60"
                    >
                        {publishing === 'saving' ? t.badgesPublishing
                            : publishing === 'done' ? t.badgesPublished
                                : publishing === 'failed' ? t.badgesPublishFailed
                                    : t.badgesPublish}
                    </button>
                </>
            )}
        </div>
    );
}
