import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches a failed page load and offers a reload.
 *
 * The library pages are code-split, and `lazy` rejects when its chunk cannot
 * be fetched. Without a boundary that rejection reaches the root and React
 * unmounts the whole tree, leaving a blank screen with no way out.
 *
 * This is reachable in production, not just offline: mORA ships as a PWA, so
 * after a deploy a client still holding the previous index.html asks for chunk
 * filenames that no longer exist. Reloading picks up the new index.html, which
 * is exactly what the button does.
 */
export class ChunkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Page failed to load:', error, info.componentStack);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-zinc-500 text-sm max-w-xs leading-relaxed text-balance">
                    Não foi possível abrir esta página. Se a aplicação foi actualizada
                    entretanto, basta recarregar.
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="cta-primary rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                    Recarregar
                </button>
            </div>
        );
    }
}
