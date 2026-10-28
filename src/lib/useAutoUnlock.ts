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
        if (tried.current || !autoUnlock || !locked) return;
        tried.current = true;
        unlockIfNeeded().catch(() => {});
    }, [autoUnlock, locked]);
}
