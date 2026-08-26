import { useState } from 'react';
import { Award } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';

/**
 * One badge, as a list row: the art, its name, and what it was for.
 *
 * Shared by the player sheet and Perfil so the two can't drift — they show the
 * same thing to two audiences, and the interesting case is the same in both: a
 * definition whose art fails to load. The medal stands in then, because a badge
 * that renders as a blank square reads as broken rather than as won.
 */
export function BadgeItem({ badge }: { badge: EarnedBadge }) {
    const [broken, setBroken] = useState(false);
    const art = badge.thumb || badge.image;

    return (
        <li className="flex items-center gap-3">
            <span className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-amber-500/10 flex items-center justify-center">
                {art && !broken
                    ? <img
                        src={art}
                        alt=""
                        // Origin only, as everywhere else this app loads a
                        // remote image: the host learns the request came from
                        // here and nothing about where in the app.
                        referrerPolicy="origin"
                        className="h-full w-full object-contain"
                        onError={() => setBroken(true)}
                    />
                    : <Award size={18} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{badge.name}</span>
                {badge.description && (
                    <span className="block text-xs text-zinc-500 truncate">{badge.description}</span>
                )}
            </span>
        </li>
    );
}
