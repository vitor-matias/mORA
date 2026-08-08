import { User } from 'lucide-react';
import { shortPubkey } from './playerLabel';
import { useTranslations } from '@/lib/i18n';

export interface PlayerRef {
    pubkey: string;
    name?: string;
    picture?: string;
}

/**
 * How a person appears in every list: avatar, then name.
 *
 * The npub is the fallback, not the default — it identifies nobody to a
 * reader. It still has to exist, because a Nostr identity is under no
 * obligation to publish a kind-0, and a blank cell would be worse.
 */
export function Player({ player, you = false }: { player: PlayerRef; you?: boolean }) {
    const t = useTranslations().palavra;
    return (
        <span className="flex-1 min-w-0 flex items-center gap-2">
            <span
                aria-hidden="true"
                className="h-6 w-6 shrink-0 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center"
            >
                {player.picture
                    ? <img
                        src={player.picture}
                        alt=""
                        loading="lazy"
                        // A profile picture is a third-party URL of unknown
                        // size; without object-cover a tall one distorts the
                        // row. onError falls back to the placeholder rather
                        // than leaving a broken-image glyph in the list.
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    : <User size={13} className="text-zinc-400" />}
            </span>
            <span className="truncate">
                {player.name || shortPubkey(player.pubkey)}
                {you && <span className="ml-1.5 text-xs font-normal">{t.you}</span>}
            </span>
        </span>
    );
}
