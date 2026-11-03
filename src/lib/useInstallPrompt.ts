import { useSyncExternalStore } from "react";

// Chromium only, so not in lib.dom.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<unknown> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferred(event: BeforeInstallPromptEvent | null) {
    deferred = event;
    listeners.forEach((listener) => listener());
}

// At module scope rather than in an effect: the browser fires this once, early
// in the page's life, and a listener added when a page mounts can miss it.
if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        setDeferred(event as BeforeInstallPromptEvent);
    });
    window.addEventListener("appinstalled", () => setDeferred(null));
}

/** True while the browser offers an install that promptInstall() can open. */
export function useCanInstall() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        () => deferred !== null,
    );
}

// An event can only prompt once. After a refusal the browser fires a new one,
// which brings the button back.
export function promptInstall() {
    const event = deferred;
    setDeferred(null);
    event?.prompt();
}
