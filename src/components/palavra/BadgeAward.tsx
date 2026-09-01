import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';
import { useTranslations } from '@/lib/i18n';
import { BadgeItem } from './BadgeItem';

type Publishing = 'idle' | 'saving' | 'done' | 'failed';

// Same set HowToPlay traps focus over — kept generic rather than hardcoded to
// this dialog's buttons, which change with the publishing state.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const [publishing, setPublishing] = useState<Publishing>('idle');

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => previouslyFocused?.focus();
    }, []);

    // Palavra listens for bare letters at the page level and would read them
    // as guesses; every keystroke made in here stops at the dialog.
    const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        event.stopPropagation();
        if (event.key === 'Escape') { onClose(); return; }
        if (event.key !== 'Tab') return;
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="badge-award-title"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onDialogKeyDown}
                className="surface rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in zoom-in-95"
            >
                <div className="flex items-start justify-between gap-4">
                    <h2 id="badge-award-title" className="text-xl font-bold page-title">
                        {t.badgeAwardTitle(badges.length)}
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={t.badgeAwardClose}
                        className="shrink-0 -m-1 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
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
                    className="w-full cta-primary rounded-xl px-4 py-3 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-60"
                >
                    {publishing === 'saving' ? t.badgesPublishing
                        : publishing === 'done' ? t.badgesPublished
                            : publishing === 'failed' ? t.badgesPublishFailed
                                : t.badgesPublish}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
            </div>
        </div>
    );
}
