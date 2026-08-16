import { lazy, Suspense, useState } from 'react';
import { User } from 'lucide-react';
import { shortPubkey } from './playerLabel';
import { useTranslations } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';

// Lazy, and loaded only once someone taps a name. The sheet pulls in the badge
// reader and the contact-list writer, neither of which any board needs to
// render — and this component is on every row of every board.
const PlayerSheet = lazy(() =>
    import('./PlayerSheet').then((m) => ({ default: m.PlayerSheet })));

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
    const [brokenPicture, setBrokenPicture] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const me = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey ?? null);

    return (
        <>
        {/* A button, not a row-level handler: every board renders this inside a
            list item, and making the name itself the control is what gets it
            keyboard focus and a role a screen reader can announce. The sheet
            lives here rather than in each board so all four — daily, monthly,
            duels, leagues — get it without any wiring. */}
        <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={t.playerOpen(player.name || shortPubkey(player.pubkey))}
            className="flex-1 min-w-0 flex items-center gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-zinc-500/10 transition-colors"
        >
            <span
                aria-hidden="true"
                className="h-6 w-6 shrink-0 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center"
            >
                {player.picture && !brokenPicture
                    ? <img
                        src={player.picture}
                        alt=""
                        loading="lazy"
                        // Origin only, not `no-referrer`.
                        //
                        // The concern this answers is that the host — chosen
                        // by whoever wrote the profile — would otherwise learn
                        // which page each reader of this board is on. Sending
                        // the origin alone withholds that: they see that the
                        // request came from this app, and nothing about where
                        // in it.
                        //
                        // `no-referrer` went further and cost the feature:
                        // avatars that load fine elsewhere in the app came
                        // back 403 here, because a request with no Referer at
                        // all is what hotlink protection is built to block.
                        referrerPolicy="origin"
                        // A picture is a third-party URL of unknown size;
                        // without object-cover a tall one distorts the row.
                        className="h-full w-full object-cover"
                        // State, not style: hiding the <img> left an empty
                        // circle, because the icon is the other branch of this
                        // ternary and so never rendered. Logged as well — a
                        // picture that silently becomes a placeholder gives
                        // its owner nothing to go on.
                        onError={() => {
                            console.warn(
                                `Could not load a profile picture: ${player.picture}. `
                                + 'The host may block hotlinking, or the URL may be gone.',
                            );
                            setBrokenPicture(true);
                        }}
                    />
                    : <User size={13} className="text-zinc-400" />}
            </span>
            <span className="truncate">
                {player.name || shortPubkey(player.pubkey)}
                {you && <span className="ml-1.5 text-xs font-normal">{t.you}</span>}
            </span>
        </button>
        {sheetOpen && (
            // No fallback: the sheet is a modal over the page, and a spinner
            // in its place would be a second thing flashing on screen for the
            // moment the chunk takes to arrive.
            <Suspense fallback={null}>
                <PlayerSheet player={player} you={me} onClose={() => setSheetOpen(false)} />
            </Suspense>
        )}
        </>
    );
}
