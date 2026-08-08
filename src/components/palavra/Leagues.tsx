import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, LogOut, Plus, Users } from 'lucide-react';
import type { League, LeagueStanding } from '@/lib/palavra/leagues';
import { MAX_GUESSES } from '@/lib/palavra/types';
import { formatDuration } from './playerLabel';
import { Player } from './Player';
import { useTranslations } from '@/lib/i18n';

type Busy = null | 'creating' | 'joining' | 'leaving';

export function Leagues({
    pubkey,
    date,
    revealResults,
}: {
    pubkey: string;
    date: string;
    /** False until the day's puzzle is finished — the league list and its
        controls still work, only the standings are held back. */
    revealResults: boolean;
}) {
    const t = useTranslations().palavra;
    const [leagues, setLeagues] = useState<League[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [loadedStandings, setLoadedStandings] = useState<{ coord: string; rows: LeagueStanding[] } | null>(null);
    const standings = selected && loadedStandings?.coord === selected ? loadedStandings.rows : null;
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [invite, setInvite] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { fetchMyLeagueCoords, fetchLeagues } = await import('@/lib/palavra/leagues');
        const coords = await fetchMyLeagueCoords(pubkey);
        return fetchLeagues(coords);
    }, [pubkey]);

    useEffect(() => {
        let cancelled = false;
        load()
            .then((result) => { if (!cancelled) setLeagues(result); })
            .catch((err) => {
                console.warn('Could not load leagues.', err);
                if (!cancelled) setLeagues([]);
            });
        return () => { cancelled = true; };
    }, [load]);

    // Standings follow the selected league; nothing is fetched until one is
    // opened, since each is a fan-out across every member's relays. Stamped
    // with the coordinate they belong to rather than cleared up front — see
    // the same pattern in Leaderboard.
    useEffect(() => {
        if (!selected || !revealResults) return;
        let cancelled = false;
        import('@/lib/palavra/leagues')
            .then(({ fetchLeagueStandings }) => fetchLeagueStandings(selected, date))
            .then((result) => { if (!cancelled) setLoadedStandings({ coord: selected, rows: result }); })
            .catch((err) => {
                console.warn('Could not load standings.', err);
                if (!cancelled) setLoadedStandings({ coord: selected, rows: [] });
            });
        return () => { cancelled = true; };
    }, [selected, date, revealResults]);

    const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>) => {
        setBusy(kind);
        setError(null);
        try {
            await action();
            setLeagues(await load());
        } catch (err) {
            console.warn(`Could not ${kind} the league.`, err);
            setError(t.leagueActionFailed);
        } finally {
            setBusy(null);
        }
    };

    const copyInvite = async (league: League) => {
        const { leagueInvite } = await import('@/lib/palavra/leagues');
        try {
            await navigator.clipboard.writeText(leagueInvite(league));
            setCopied(league.coord);
            window.setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.warn('Could not copy the invite.', err);
        }
    };

    if (leagues === null) {
        return (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                {t.loadingLeagues}
            </p>
        );
    }

    const field = 'flex-1 min-w-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm '
        + 'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-liturgy-500';
    const action = 'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold cta-primary '
        + 'disabled:opacity-50 transition-colors active:scale-[0.98]';

    return (
        <div className="space-y-4">
            {leagues.length === 0 && (
                <p className="text-sm text-zinc-500">
                    {t.emptyLeagues}
                </p>
            )}

            <ul className="space-y-2">
                {leagues.map((league) => (
                    <li key={league.coord} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 p-3">
                            <button
                                type="button"
                                onClick={() => setSelected(selected === league.coord ? null : league.coord)}
                                aria-expanded={selected === league.coord}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left text-sm font-semibold"
                            >
                                <Users size={15} className="shrink-0 text-zinc-400" aria-hidden="true" />
                                <span className="truncate">{league.name}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => copyInvite(league)}
                                aria-label={t.copyInvite(league.name)}
                                className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                                {copied === league.coord
                                    ? <Check size={15} aria-hidden="true" />
                                    : <Copy size={15} aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => run('leaving', async () => {
                                    const { leaveLeague } = await import('@/lib/palavra/leagues');
                                    await leaveLeague(league.coord);
                                    if (selected === league.coord) setSelected(null);
                                })}
                                aria-label={t.leaveLeague(league.name)}
                                className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                                <LogOut size={15} aria-hidden="true" />
                            </button>
                        </div>

                        {selected === league.coord && (
                            <div className="px-3 pb-3">
                                {!revealResults && (
                                    <p className="text-xs text-zinc-500 py-2">
                                        {t.standingsSpoiler}
                                    </p>
                                )}
                                {revealResults && standings === null && (
                                    <p className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                                        {t.loadingStandings}
                                    </p>
                                )}
                                {revealResults && standings?.length === 0 && (
                                    <p className="text-xs text-zinc-500 py-2">
                                        {t.emptyStandings}
                                    </p>
                                )}
                                {revealResults && standings && standings.length > 0 && (
                                    <ol className="divide-y divide-zinc-200 dark:divide-zinc-700/60">
                                        {standings.map((row, i) => (
                                            <li key={row.pubkey} className="flex items-center gap-3 py-2 text-sm">
                                                <span className="w-4 shrink-0 tabular-nums text-xs text-zinc-400">{i + 1}</span>
                                                <span className={`flex-1 min-w-0 flex ${
                                                    row.pubkey === pubkey ? 'font-semibold text-liturgy-700 dark:text-liturgy-300' : ''
                                                }`}>
                                                    <Player player={row} />
                                                </span>
                                                <span className="shrink-0 tabular-nums text-zinc-500 text-xs">
                                                    {row.solved ? `${row.tries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}
                                                </span>
                                                <span className="shrink-0 tabular-nums text-xs text-zinc-400 w-14 text-right">
                                                    {formatDuration(row.ms)}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t.newLeagueName}
                        maxLength={40}
                        aria-label={t.newLeagueName}
                        className={field}
                    />
                    <button
                        type="button"
                        disabled={busy !== null || !newName.trim()}
                        onClick={() => run('creating', async () => {
                            const { createLeague } = await import('@/lib/palavra/leagues');
                            await createLeague(newName);
                            setNewName('');
                        })}
                        className={action}
                        // Icon-only, and both icons are aria-hidden, so
                        // without this the button announces as just "button".
                        // The join button beside it is fine — it has a label.
                        aria-label={t.createLeague}
                    >
                        {busy === 'creating'
                            ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            : <Plus size={15} aria-hidden="true" />}
                    </button>
                </div>

                <div className="flex gap-2">
                    <input
                        value={invite}
                        onChange={(e) => setInvite(e.target.value)}
                        placeholder={t.invitePlaceholder}
                        aria-label={t.invitePlaceholder}
                        className={field}
                    />
                    <button
                        type="button"
                        disabled={busy !== null || !invite.trim()}
                        onClick={async () => {
                            // Checked before `run`, which reports every throw
                            // as "try again" — the wrong advice for a string
                            // that will never parse however often it is
                            // retried.
                            const { parseInvite } = await import('@/lib/palavra/leagues');
                            const coord = parseInvite(invite);
                            if (!coord) { setError(t.inviteInvalid); return; }
                            run('joining', async () => {
                                const { joinLeague } = await import('@/lib/palavra/leagues');
                                await joinLeague(coord);
                                setInvite('');
                            });
                        }}
                        className={action}
                    >
                        {t.joinLeague}
                    </button>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            {/* Said plainly, because a user could act on believing otherwise. */}
            <p className="text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {t.unlistedBefore}<strong>{t.unlistedBold}</strong>{t.unlistedAfter}
            </p>
        </div>
    );
}
