import { useEffect, useState } from "react";
import { RELAYS, pingRelay } from "@/lib/pool";
import { useTranslations } from "@/lib/i18n";

export function RelayStatus() {
    const t = useTranslations().profile;
    // Absent while measuring; null once a relay has failed to answer.
    const [pings, setPings] = useState<Record<string, number | null>>({});

    useEffect(() => {
        for (const url of RELAYS) {
            pingRelay(url).then((ms) => setPings((current) => ({ ...current, [url]: ms })));
        }
    }, []);

    return (
        <section className="surface rounded-3xl p-6 mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 wrap-anywhere mb-4">{t.relays}</h2>
            <ul className="grid lg:grid-cols-2 gap-x-8 gap-y-2">
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
        </section>
    );
}
