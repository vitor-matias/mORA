import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';

type State = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * Posts the emoji grid as an ordinary Nostr note, so it shows up in every
 * client rather than only in mORA.
 *
 * Always an explicit press. Nothing about finishing a game publishes text on
 * someone's behalf — the automatic publish is the structured result event, and
 * that one is behind its own opt-in.
 */
export function ShareToNostr({
    onShare,
    alreadyShared = false,
}: {
    onShare: () => Promise<void>;
    /** This day's grid has been posted before. */
    alreadyShared?: boolean;
}) {
    const [state, setState] = useState<State>('idle');

    const share = async () => {
        setState('sending');
        try {
            await onShare();
            setState('sent');
        } catch (error) {
            console.warn('Could not publish the Palavra note.', error);
            setState('failed');
            // Back to idle so it can be tried again — relays fail transiently
            // and a permanently dead button would be the wrong lesson.
            window.setTimeout(() => setState('idle'), 3000);
        }
    };

    // Gone once it has been posted — but only on a later visit. Checking
    // `state` too keeps the confirmation on screen for the press that just
    // happened, instead of the button vanishing the instant it succeeds and
    // leaving no sign it worked.
    if (alreadyShared && state === 'idle') return null;

    return (
        <button
            type="button"
            onClick={share}
            disabled={state === 'sending' || state === 'sent'}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-xl px-4 py-3
                       bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200
                       hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors
                       active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
            {state === 'sending' && <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> A publicar…</>}
            {state === 'sent' && <><Check size={16} aria-hidden="true" /> Publicado no Nostr</>}
            {state === 'failed' && <>Não foi possível publicar</>}
            {state === 'idle' && <><Send size={16} aria-hidden="true" /> Publicar no Nostr</>}
        </button>
    );
}
