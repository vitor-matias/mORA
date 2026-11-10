import { useRef, useState } from "react";
import { RELAYS, pingRelay } from "@/lib/pool";
import { useTranslations } from "@/lib/i18n";

export function RelayStatus() {
    const t = useTranslations().profile;
    // Absent while measuring; null once a relay has failed to answer.
    const [pings, setPings] = useState<Record<string, number | null>>({});
    const latestReading = useRef(0);

    // On opening rather than on mount: nothing is measured for a closed
    // section, and reopening it takes a fresh reading.
    const measure = () => {
        const reading = ++latestReading.current;
        setPings({});
        for (const url of RELAYS) {
            pingRelay(url).then((ms) => {
                // A ping from an earlier opening must not land in this one.
                if (reading === latestReading.current) setPings((current) => ({ ...current, [url]: ms }));
            });
        }
    };

    return (
        <details className="surface rounded-3xl p-6 mt-8" onToggle={(e) => { if (e.currentTarget.open) measure(); }}>
            <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">
                <h2 className="inline text-sm font-semibold uppercase tracking-wider wrap-anywhere">{t.relays}</h2>
            </summary>
            <ul className="grid lg:grid-cols-2 gap-x-8 gap-y-2 mt-4">
                {RELAYS.map((url) => {
                    const ms = pings[url];
                    return (
                        <li key={url} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate">{url.replace(/^wss?:\/\//, "")}</span>
                            <span className={`flex items-center gap-2 shrink-0 text-xs tabular-nums ${ms === null ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                                <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${ms === undefined ? "bg-zinc-300 dark:bg-zinc-600" : ms === null ? "bg-red-500" : "bg-green-500"}`} />
                                {ms === undefined ? t.relayMeasuring : ms === null ? t.relayUnreachable : `${ms} ms`}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </details>
    );
}
