import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { unlockIfNeeded } from "@/lib/nostr";

/** With "Desbloquear ao abrir" on, asks for the passkey once per app start.
    Off, the key stays locked until something has to be signed. iOS may refuse
    a prompt no tap started; then the key unlocks at the next signature. */
export function useAutoUnlock() {
    const autoUnlock = useAuthStore((s) => s.autoUnlock);
    const locked = useAuthStore((s) => s.isLocked && Boolean(s.protectedKey));
    const tried = useRef(false);
    useEffect(() => {
        // Decided once, at app open. Re-checked later, locking the key from
        // Início with the switch on would put the prompt straight back up.
        if (tried.current) return;
        tried.current = true;
        if (autoUnlock && locked) unlockIfNeeded().catch(() => {});
    }, [autoUnlock, locked]);
}
