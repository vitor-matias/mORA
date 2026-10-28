import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/store/auth";

/**
 * One-tap passkey unlock for a protected key, so starting a session doesn't
 * mean a detour through Perfil. Renders nothing unless the key is locked.
 */
export function UnlockKeyCard() {
    const protectedKey = useAuthStore((s) => s.protectedKey);
    const isLocked = useAuthStore((s) => s.isLocked);
    const unlockWithKey = useAuthStore((s) => s.unlockWithKey);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (!protectedKey || !isLocked) return null;

    const unlock = async () => {
        setError("");
        setBusy(true);
        try {
            const { unlockKey } = await import('@/lib/keyVault');
            unlockWithKey(await unlockKey(protectedKey));
        } catch (e) {
            // A cancelled prompt is a NotAllowedError — not worth an error line.
            if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
                setError(e instanceof Error ? e.message : 'Não foi possível desbloquear.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="relative z-10 surface rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <Lock size={18} className="shrink-0 text-liturgy-600 dark:text-liturgy-400" aria-hidden="true" />
                <p className="flex-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Chave protegida. Desbloqueie para sincronizar.
                </p>
                <button
                    type="button"
                    onClick={unlock}
                    disabled={busy}
                    className="shrink-0 py-2 px-3 rounded-lg bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                    Desbloquear
                </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </section>
    );
}
