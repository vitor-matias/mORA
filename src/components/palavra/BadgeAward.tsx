import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';
import { useTranslations } from '@/lib/i18n';
import { BadgeItem } from './BadgeItem';
import { Sheet, type SheetHandle } from '@/components/Sheet';

type Publishing = 'idle' | 'saving' | 'done' | 'failed';

/**
 * "You won a badge" — shown once per badge, per device, per identity.
 *
 * The one action it offers is accepting the award onto the Nostr profile: a
 * kind-30008 list the *recipient* signs, which is what makes a badge appear
 * beside their name in Damus, Amethyst and the rest. It is a button and never
 * automatic for the same reason it is a button in Perfil — it changes what
 * strangers see next to someone's name, so it is theirs to decide. Dismissing
 * costs nothing: the badge is already won, and Perfil keeps the same button.
 */
export function BadgeAward({
    recipient,
    badges,
    onClose,
}: {
    /** Who won them. Fixed when the award was read, not looked up at publish
        time: the two dynamic imports below give a sign-out room to land
        mid-publish, and asking who is signed in *then* could write these
        badges onto whoever signed in next. Passing it here means the writer's
        signer check catches the switch and refuses. */
    recipient: string;
    badges: EarnedBadge[];
    onClose: () => void;
}) {
    const t = useTranslations().palavra;
    const closeRef = useRef<HTMLButtonElement>(null);
    const sheet = useRef<SheetHandle>(null);
    const close = () => sheet.current?.close();
    const [publishing, setPublishing] = useState<Publishing>('idle');

    const onPublish = async () => {
        setPublishing('saving');
        try {
            const { setPalavraProfileBadges } = await import('@/lib/palavra/badges');
            // The award names its recipient, and that is the only identity
            // whose list this can be added to — the publish refuses if the
            // signer turns out to be someone else.
            await setPalavraProfileBadges(recipient, badges);
            setPublishing('done');
        } catch (error) {
            // Includes the deliberate refusal when the current list can't be
            // read: publishing then would strip badges from other issuers.
            console.warn('Could not update the profile badges.', error);
            setPublishing('failed');
        }
    };

    // A centred alert rather than a sheet: an announcement, not a task.
    // Focus, Escape, the Tab trap and the keystrokes Palavra must not see
    // are Sheet's.
    return (
        <Sheet
            ref={sheet}
            variant="alert"
            onClose={onClose}
            labelledBy="badge-award-title"
            initialFocus={closeRef}
            className="space-y-4"
        >
            <div className="flex items-start justify-between gap-4">
                <h2 id="badge-award-title" className="text-xl font-bold page-title">
                    {t.badgeAwardTitle(badges.length)}
                </h2>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label={t.badgeAwardClose}
                    className="pressable pressable-small shrink-0 -m-1 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                    <X size={20} />
                </button>
            </div>

            <ul className="space-y-3">
                {badges.map((badge) => <BadgeItem key={badge.coord} badge={badge} />)}
            </ul>

            <p className="text-xs text-zinc-500">{t.badgesPublishHelp}</p>

            <button
                type="button"
                onClick={onPublish}
                disabled={publishing === 'saving' || publishing === 'done'}
                className="pressable w-full cta-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
                {publishing === 'saving' ? t.badgesPublishing
                    : publishing === 'done' ? t.badgesPublished
                        : publishing === 'failed' ? t.badgesPublishFailed
                            : t.badgesPublish}
            </button>
            <button
                type="button"
                onClick={close}
                className="pressable w-full rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
                {publishing === 'done' ? t.badgeAwardDone : t.badgeAwardLater}
            </button>

            {/* The button's own label is the only visible signal, and a
                label changing under an activated button is not reliably
                announced. This says it once, to assistive tech only. */}
            <p role="status" aria-live="polite" className="sr-only">
                {publishing === 'done' ? t.badgesPublished
                    : publishing === 'failed' ? t.badgesPublishFailed
                        : ''}
            </p>
        </Sheet>
    );
}
