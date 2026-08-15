import { Play, Pause, Minus, Plus } from "lucide-react";
import { SCROLL_LEVELS } from "@/store/app";
import type { AutoScroll } from "@/lib/useAutoScroll";

/** Start/stop button — sidebar (desktop) and inline toolbar (mobile). */
export function AutoScrollButton({ scroll }: { scroll: AutoScroll }) {
    return (
        <button
            type="button"
            onClick={scroll.toggle}
            disabled={!scroll.isScrolling && scroll.atPageEnd}
            aria-label={scroll.isScrolling ? 'Parar auto-scroll' : 'Iniciar auto-scroll'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border w-full justify-center lg:justify-start disabled:opacity-40 disabled:cursor-not-allowed ${
                scroll.isScrolling
                    ? 'bg-liturgy-100 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-300 border-liturgy-200 dark:border-liturgy-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
        >
            {scroll.isScrolling ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
            {scroll.isScrolling ? 'Parar scroll' : 'Auto-scroll'}
        </button>
    );
}

/**
 * Speed row for the desktop sidebar. Nothing to adjust while stopped, so it
 * shows only during a scroll (on mobile the speed lives in the FAB pill).
 *
 * Hidden rather than unmounted: unmounting made the sidebar grow by the row's
 * height the instant the scroll started, which shoved the button the reader
 * had just clicked out from under the cursor. Hiding it holds that space, so
 * pressing play changes nothing about the layout.
 *
 * `invisible` is visibility:hidden, which already takes the two buttons out of
 * the tab order and the accessibility tree — measured, not assumed. It has to
 * stay that: swapping it for `opacity-0` or `sr-only` would leave them
 * focusable behind an invisible row. `inert` is the belt to that braces, and
 * also blocks pointer events and find-in-page.
 */
export function AutoScrollSpeedRow({ scroll }: { scroll: AutoScroll }) {
    return (
        <div
            inert={!scroll.isScrolling}
            className={`flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800${
                scroll.isScrolling ? '' : ' invisible'
            }`}
        >
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Velocidade</span>
            <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-1 py-0.5">
                <button
                    type="button"
                    onClick={scroll.slower}
                    aria-label="Mais lento"
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    <Minus size={15} />
                </button>
                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold w-3 text-center select-none">
                    {SCROLL_LEVELS[scroll.speed].label}
                </span>
                <button
                    type="button"
                    onClick={scroll.faster}
                    aria-label="Mais rápido"
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2"
                >
                    <Plus size={15} />
                </button>
            </div>
        </div>
    );
}

/** Floating start button / speed pill — mobile and tablet only. */
export function AutoScrollFab({ scroll }: { scroll: AutoScroll }) {
    return (
        <div className="lg:hidden fixed bottom-24 right-4 z-40">
            {scroll.isScrolling ? (
                /* One cohesive pill: speed on the left, pause on the right.
                   Semi-transparent so text scrolling behind it stays
                   readable. */
                <div className="flex items-stretch h-12 rounded-full bg-zinc-900/60 dark:bg-zinc-800/60 backdrop-blur-md shadow-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={scroll.slower}
                        aria-label="Mais lento"
                        className="pl-4 pr-2.5 flex items-center text-zinc-300 hover:text-white active:text-white transition-colors"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="flex items-center text-white text-sm font-semibold tabular-nums w-4 justify-center select-none">
                        {SCROLL_LEVELS[scroll.speed].label}
                    </span>
                    <button
                        type="button"
                        onClick={scroll.faster}
                        aria-label="Mais rápido"
                        className="pl-2.5 pr-3 flex items-center text-zinc-300 hover:text-white active:text-white transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                    <div className="w-px my-3 bg-white/20" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={scroll.toggle}
                        aria-label="Parar auto-scroll"
                        className="pl-3.5 pr-4 flex items-center text-white transition-colors"
                    >
                        <Pause size={17} fill="currentColor" strokeWidth={0} />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={scroll.toggle}
                    disabled={scroll.atPageEnd}
                    aria-label="Iniciar auto-scroll"
                    className="h-12 w-12 rounded-full shadow-xl flex items-center justify-center bg-zinc-900/60 dark:bg-zinc-100/70 backdrop-blur-md text-white dark:text-zinc-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Play size={17} fill="currentColor" strokeWidth={0} className="translate-x-px" />
                </button>
            )}
        </div>
    );
}
