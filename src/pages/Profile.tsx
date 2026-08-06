import { useState, useEffect, useRef } from "react";
import { useAuthStore, localNsec, localPrivkeyHex } from "@/store/auth";
import type { BunkerLogin } from "@/lib/signer";
import { useAppStore, CONTENT_FONT_SCALE, SCROLL_LEVELS, type ThemeMode, type FontSize, type FontFamily, type AutoScrollSpeed } from "@/store/app";
import type { RosaryBeadMode } from "@/lib/rosary";
import { Settings, Moon, Sun, Monitor, Bell, Type, User, Save, Gauge, Clock, Upload, Copy, Check, Eye, EyeOff, TriangleAlert, Smartphone, QrCode, Lock, LockOpen } from "lucide-react";
import { nip19 } from "nostr-tools";
import { QRCodeSVG } from "qrcode.react";
import { fileToAvatarDataUrl } from "@/lib/image";
import { passkeysAvailable } from "@/lib/keyVault";
import { CANONICAL_HOURS } from "@/lib/hours";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "@/lib/i18n";
import { fetchNostrProfile, publishNostrProfile } from "@/lib/nostr";
import { isPushConfigured, enablePushReminder, disablePushReminder } from "@/lib/push";

/** Long enough to cover picking an hour then a minute, short enough that the
    registration still feels immediate. */
const REMINDER_SYNC_DEBOUNCE_MS = 600;

export default function Profile() {
    const { login, lockedPubkey, protectedKey, isLocked, setProtectedKey, unlockWithKey, signIn, loginWithNip07, loginWithPrivateKey, generateLocalKey, logout, setProfile } = useAuthStore();
    // One login record replaces the old pubkey/privkey/isNip07/bunker
    // quadruple; everything the page used to branch on is its `type`.
    const pubkey = login?.pubkey ?? lockedPubkey;
    const isNip07 = login?.type === 'extension';
    const bunker = login?.type === 'bunker';
    // Only a locally held key has an nsec to show — NIP-07 and remote
    // signers never hand the secret to the page. The login record already
    // stores it in the bech32 form other clients ask for.
    const nsec = useAuthStore(localNsec) ?? "";
    // The passkey vault predates the login record and speaks hex.
    const privkeyHex = useAuthStore(localPrivkeyHex);
    const { theme, setTheme, notificationTime, setNotificationTime, hourReminders, setHourReminder, pushSubscribed, rosaryMode, setRosaryMode, fontSize, setFontSize, fontFamily, setFontFamily, shareStreaks, setShareStreaks, autoScrollSpeed, setAutoScrollSpeed } = useAppStore();
    const t = useTranslations().profile;

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [profilePicture, setProfilePicture] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const [pictureError, setPictureError] = useState("");
    const [isProcessingPicture, setIsProcessingPicture] = useState(false);
    const pictureInputRef = useRef<HTMLInputElement>(null);

    // Custom key input
    const [customKey, setCustomKey] = useState("");
    const [keyError, setKeyError] = useState("");

    // NIP-07 extensions inject window.nostr asynchronously, so an absence at
    // first render doesn't mean there is none — poll briefly before concluding.
    const [hasNip07, setHasNip07] = useState(() => typeof window !== 'undefined' && !!window.nostr);
    const [nip07Error, setNip07Error] = useState("");
    useEffect(() => {
        if (hasNip07) return;
        const startedAt = Date.now();
        const id = window.setInterval(() => {
            if (window.nostr) {
                setHasNip07(true);
                window.clearInterval(id);
            } else if (Date.now() - startedAt > 3000) {
                window.clearInterval(id);
            }
        }, 200);
        return () => window.clearInterval(id);
    }, [hasNip07]);

    // Installed to the home screen (Android WebAPK / iOS standalone), where
    // extensions don't reach the page.
    const isInstalledApp = typeof window !== 'undefined' && (
        window.matchMedia?.('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );

    // The store action rethrows; as a bare onClick that became an unhandled
    // rejection and the tap looked like it did nothing at all.
    const handleNip07Login = async () => {
        setNip07Error("");
        try {
            await loginWithNip07();
        } catch (error) {
            setNip07Error(error instanceof Error && error.message !== 'Nostr extension not found'
                ? `${t.nip07Failed} ${error.message}`
                : t.nip07Failed);
        }
    };

    // NIP-46 remote signer (Amber and friends)
    const [signerPending, setSignerPending] = useState(false);
    const [signerError, setSignerError] = useState("");
    const [signerHint, setSignerHint] = useState("");
    const [waitToken, setWaitToken] = useState(0);
    const [bunkerUri, setBunkerUri] = useState("");
    /** The pending `nostrconnect://` request, when it is being shown as a QR
        code — i.e. only for the signer-on-another-device path. */
    const [connectUri, setConnectUri] = useState("");

    // Waiting in silence is the worst version of this: the signer may be
    // asking for approval through a notification the user never sees. Say so
    // while there is still time to act on it, not only once it has failed.
    useEffect(() => {
        if (!signerPending) return;
        let cancelled = false;
        let timer: number | undefined;
        import('@/lib/signer')
            .then(({ SIGNER_APPROVAL_HINT, SIGNER_HINT_DELAY_MS }) => {
                if (cancelled) return;
                timer = window.setTimeout(() => setSignerHint(SIGNER_APPROVAL_HINT), SIGNER_HINT_DELAY_MS);
            })
            .catch(() => {});
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [signerPending, waitToken]);

    // Identifies the attempt currently on screen. Cancelling or re-arming bumps
    // it, so a wait that was already in flight can't sign the user in after
    // they cancelled, or flip the pending state back for an attempt nobody is
    // watching any more.
    const signerAttempt = useRef(0);

    const awaitSigner = async (connected: Promise<BunkerLogin>) => {
        const attempt = ++signerAttempt.current;
        setSignerHint("");
        // The hint timer keys on this, so a re-armed wait (a resume while one
        // is already pending) restarts it. Without that the hint is cleared
        // above and never scheduled again, hiding the warning exactly when
        // the user is still waiting for an approval.
        setWaitToken(attempt);
        const isCurrent = () => attempt === signerAttempt.current;
        setSignerPending(true);
        try {
            const bunkerLogin = await connected;
            if (!isCurrent()) return;
            signIn(bunkerLogin);
        } catch (error) {
            if (!isCurrent()) return;
            setSignerError(error instanceof Error ? error.message : 'Não foi possível ligar ao assinador.');
            // The secret in it is single-use, so a failed request can never be
            // answered — leaving its QR on screen would only invite a scan
            // that goes nowhere.
            setConnectUri("");
            const { clearPendingConnection } = await import('@/lib/signer');
            clearPendingConnection();
        } finally {
            if (isCurrent()) setSignerPending(false);
        }
    };

    /**
     * Both signer paths make the same request; they differ only in how it
     * reaches the signer. `app` hands it to a signer on this device as a deep
     * link, `qr` puts it on screen for one running somewhere else.
     *
     * Either way the reply comes back as an ephemeral event on a live
     * subscription, so it only lands while this page is listening — hence the
     * resume below.
     */
    const handleSignerConnect = async (mode: 'app' | 'qr') => {
        setSignerError("");
        try {
            const { startBunkerConnection } = await import('@/lib/signer');
            const { uri, connected } = startBunkerConnection({ qr: mode === 'qr' });
            // Cleared first, not just set for `qr`: a code left over from an
            // earlier attempt carries a secret this request doesn't use, so
            // showing it during the app flow would invite a scan that can
            // never be answered.
            setConnectUri(mode === 'qr' ? uri : "");
            const waiting = awaitSigner(connected);
            if (mode === 'app') window.location.href = uri;
            await waiting;
        } catch (error) {
            // A failed chunk load or a throw before the wait even starts would
            // otherwise be an unhandled rejection with nothing on screen.
            signerAttempt.current++;
            setSignerPending(false);
            setConnectUri("");
            setSignerError(error instanceof Error ? error.message : 'Não foi possível ligar ao assinador.');
            const { clearPendingConnection } = await import('@/lib/signer').catch(() => ({ clearPendingConnection: () => {} }));
            clearPendingConnection();
        }
    };

    const handleCancelSigner = async () => {
        // Bump first: any wait already in flight is now stale and must not be
        // able to complete a login behind the user's back.
        signerAttempt.current++;
        setSignerPending(false);
        setConnectUri("");
        setSignerError("");
        const { clearPendingConnection } = await import('@/lib/signer').catch(() => ({ clearPendingConnection: () => {} }));
        clearPendingConnection();
    };

    // Opening the signer app can freeze this page or drop its relay socket.
    // On the way back, pick the attempt up again rather than leaving a button
    // spinning against a subscription that is no longer listening.
    useEffect(() => {
        if (pubkey) return;
        let cancelled = false;

        const resume = async () => {
            try {
                const { readPendingConnection, resumeBunkerConnection } = await import('@/lib/signer');
                if (cancelled || !readPendingConnection()) return;
                const resumed = resumeBunkerConnection();
                // Re-arming supersedes whatever was waiting: awaitSigner bumps
                // the attempt id, so the old wait's result is ignored rather
                // than racing this one.
                if (resumed) {
                    // Same request as before the reload: if it was on screen as
                    // a QR, it still is — the code is only stale once the
                    // attempt itself is.
                    if (resumed.qr) setConnectUri(resumed.uri);
                    awaitSigner(resumed.connected);
                }
            } catch {
                // Nothing is awaiting this; a failure here just means no resume.
            }
        };

        resume();
        const onVisible = () => { if (document.visibilityState === 'visible') resume(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
        };
        // Runs for the signed-out page only; awaitSigner is stable enough here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pubkey]);

    const handleBunkerUriLogin = async () => {
        const input = bunkerUri.trim();
        if (!input) {
            setSignerError('Cole o endereço do seu assinador.');
            return;
        }
        setSignerError("");
        try {
            const { connectWithBunkerUri } = await import('@/lib/signer');
            // Supersedes any QR attempt: that code carries a single-use
            // secret belonging to a request this one replaces, so it has to
            // leave the screen rather than invite a scan nothing can answer.
            setConnectUri("");
            // Through awaitSigner like the deep link, so Cancelar invalidates
            // this wait too — otherwise cancelling still ended in a login when
            // the signer eventually answered.
            await awaitSigner(connectWithBunkerUri(input));
        } catch (error) {
            signerAttempt.current++;
            setSignerPending(false);
            setSignerError(error instanceof Error ? error.message : 'Não foi possível ligar ao assinador.');
        }
    };

    // ── Passkey protection for a locally stored key ──────────────────────
    const [vaultBusy, setVaultBusy] = useState(false);
    const [vaultError, setVaultError] = useState("");
    // A local key is the only thing worth protecting: NIP-07 and remote
    // signers never hand this device the secret in the first place.
    const hasLocalKey = Boolean(nsec || protectedKey);
    const canOfferPasskey = hasLocalKey && !isNip07 && !bunker && passkeysAvailable();

    const runVaultAction = async (action: () => Promise<void>) => {
        setVaultError("");
        setVaultBusy(true);
        try {
            await action();
        } catch (error) {
            // A cancelled prompt is a NotAllowedError, not a failure worth
            // shouting about — everything else gets its message shown.
            if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
                setVaultError(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
            }
        } finally {
            setVaultBusy(false);
        }
    };

    const handleProtectKey = () => runVaultAction(async () => {
        if (!privkeyHex) throw new Error('A chave tem de estar desbloqueada.');
        const { protectKey } = await import('@/lib/keyVault');
        const stored = await protectKey(privkeyHex, profileName || 'mORA');
        // The login stays usable for this session; persistence drops it.
        setProtectedKey(stored);
    });

    const handleUnlockKey = () => runVaultAction(async () => {
        if (!protectedKey) return;
        const { unlockKey } = await import('@/lib/keyVault');
        unlockWithKey(await unlockKey(protectedKey));
    });

    const handleRemoveProtection = () => runVaultAction(async () => {
        if (!nsec) throw new Error('Desbloqueie a chave primeiro.');
        setProtectedKey(null);
    });

    // Keys shown in their bech32 form (NIP-19) — that is what other Nostr
    // clients ask for, and what the user can carry to another device.
    const npub = pubkey ? nip19.npubEncode(pubkey) : "";
    const [nsecRevealed, setNsecRevealed] = useState(false);
    const [copied, setCopied] = useState<'npub' | 'nsec' | null>(null);

    // Revealing is per-visit: leaving the page re-hides the secret.
    useEffect(() => () => setNsecRevealed(false), []);

    const copyKey = async (which: 'npub' | 'nsec', value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(which);
            window.setTimeout(() => setCopied(null), 2000);
        } catch {
            // Clipboard denied (insecure context, permissions) — the key is
            // on screen to copy by hand.
        }
    };

    const handlePictureFile = async (file: File | undefined) => {
        if (!file) return;
        setPictureError("");
        setIsProcessingPicture(true);
        try {
            setProfilePicture(await fileToAvatarDataUrl(file));
        } catch (error) {
            setPictureError(error instanceof Error ? error.message : 'Não foi possível usar esta imagem.');
        } finally {
            setIsProcessingPicture(false);
            // Let the same file be picked again after an error.
            if (pictureInputRef.current) pictureInputRef.current.value = "";
        }
    };

    // New-identity name
    const [newIdentityName, setNewIdentityName] = useState("");
    const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);

    // A new identity publishes its display name straight away — without one the
    // account shows up as a bare public key everywhere, including the
    // "who prayed today" line on Início.
    const handleCreateIdentity = async () => {
        const name = newIdentityName.trim();
        setIsCreatingIdentity(true);
        try {
            generateLocalKey();
            if (!name) return;
            const profile = { name, display_name: name };
            setProfile(profile);
            try {
                await publishNostrProfile(profile);
            } catch (e) {
                // The identity exists either way; the name can be re-published
                // later from "Editar Perfil".
                console.warn('Identity created, but publishing the name failed:', e);
            }
        } finally {
            setIsCreatingIdentity(false);
        }
    };

    useEffect(() => {
        if (pubkey) {
            fetchNostrProfile(pubkey).then(p => {
                if (p) {
                    setProfileName(p.name || p.display_name || "");
                    setProfilePicture(p.picture || "");
                }
            });
        }
    }, [pubkey]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const newProfile = { name: profileName, picture: profilePicture };
            await publishNostrProfile(newProfile);
            setProfile(newProfile);
            setIsEditingProfile(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    // A push subscription carries every time this device wants reminding at,
    // so any change — rosary time or an Hour — re-registers the whole set.
    // With a push server configured the reminders arrive with the app closed;
    // otherwise they fall back to the in-app timer.
    //
    // <input type="time"> fires a change per component (hour, then minute, and
    // repeatedly while stepping), and each registration is a permission prompt,
    // a pushManager.subscribe and a POST. So: debounce until the value settles,
    // then run registrations one at a time, dropping any that a newer edit has
    // already superseded — otherwise two in-flight POSTs can land out of order
    // and the server keeps the older schedule.
    const syncTimerRef = useRef<number | undefined>(undefined);
    const syncSeqRef = useRef(0);
    const syncQueueRef = useRef<Promise<unknown>>(Promise.resolve());

    useEffect(() => () => window.clearTimeout(syncTimerRef.current), []);

    const syncReminders = (nextTime: string | null, nextHours: Record<string, string>) => {
        const times = [...new Set([
            ...(nextTime ? [nextTime] : []),
            ...Object.values(nextHours),
        ])].sort();

        window.clearTimeout(syncTimerRef.current);
        const seq = ++syncSeqRef.current;
        syncTimerRef.current = window.setTimeout(() => {
            syncQueueRef.current = syncQueueRef.current
                // One failed registration must not stall every later one.
                .catch(() => {})
                .then(async () => {
                    if (seq !== syncSeqRef.current) return;
                    if (times.length === 0) {
                        await disablePushReminder();
                    } else if (isPushConfigured()) {
                        await enablePushReminder(times);
                    } else if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                        await Notification.requestPermission();
                    }
                });
        }, REMINDER_SYNC_DEBOUNCE_MS);
    };

    const clearNotification = () => {
        setNotificationTime(null);
        syncReminders(null, hourReminders);
    };

    const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value || null;
        setNotificationTime(time);
        syncReminders(time, hourReminders);
    };

    // Switching an Hour on seeds it with its traditional time; the user can
    // then move it. Switching off removes it from the schedule entirely.
    const setHourTime = (hourId: string, time: string | null) => {
        const nextHours = { ...hourReminders };
        if (time) nextHours[hourId] = time; else delete nextHours[hourId];
        setHourReminder(hourId, time);
        syncReminders(notificationTime, nextHours);
    };

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title={t.title} subtitle={t.subtitle} />
            <div className="p-6 max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto flex-1 w-full">
            {/* Desktop: settings and identity side by side */}
            <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

            {/* Application Settings Section */}
            <section className="surface rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Settings className="text-zinc-400" size={20} />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t.settings}</h2>
                </div>

                <div className="space-y-6">
                    {/* Theme Preference */}
                    <div>
                        <p className="text-sm font-medium mb-3">{t.theme}</p>
                        <div className="flex gap-2">
                            {(['light', 'dark', 'system'] as ThemeMode[]).map((tMode) => (
                                <button
                                    key={tMode}
                                    onClick={() => setTheme(tMode)}
                                    className={`flex-1 py-2 px-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${theme === tMode
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {tMode === 'light' ? <Sun size={18} /> : tMode === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
                                    <span className="text-xs font-medium">
                                        {tMode === 'light' ? t.light : tMode === 'dark' ? t.dark : t.system}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Family */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Type className="text-zinc-400" size={16} />
                            <p className="text-sm font-medium">Tipo de Letra</p>
                        </div>
                        <div className="flex gap-2">
                            {([['system', 'Predefinido'], ['serif', 'Serifada'], ['sans', 'Sem Serifa']] as [FontFamily, string][]).map(([fam, label]) => (
                                <button
                                    key={fam}
                                    onClick={() => setFontFamily(fam)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-center transition-colors ${fontFamily === fam
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <span className={`text-xs font-medium ${fam === 'serif' ? 'font-serif' : fam === 'sans' ? 'font-sans' : ''}`}>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Size */}
                    <div>
                        <p className="text-sm font-medium mb-3">Tamanho do Texto</p>
                        <div className="flex gap-2 items-stretch">
                            {(Object.keys(CONTENT_FONT_SCALE) as FontSize[]).map((sz) => (
                                <button
                                    key={sz}
                                    onClick={() => setFontSize(sz)}
                                    aria-label={`Tamanho ${sz}`}
                                    aria-pressed={fontSize === sz}
                                    className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center transition-colors ${fontSize === sz
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <span className="font-semibold leading-none" style={{ fontSize: CONTENT_FONT_SCALE[sz].size }}>A</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Auto-scroll Default Speed */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Gauge className="text-zinc-400" size={16} />
                            <p className="text-sm font-medium">Velocidade do Auto-scroll</p>
                        </div>
                        <div role="group" aria-label="Velocidade do Auto-scroll" className="flex gap-2">
                            {SCROLL_LEVELS.map((level, idx) => (
                                <button
                                    type="button"
                                    key={level.label}
                                    onClick={() => setAutoScrollSpeed(idx as AutoScrollSpeed)}
                                    aria-pressed={autoScrollSpeed === idx}
                                    className={`flex-1 py-2 px-3 rounded-xl text-center transition-colors ${autoScrollSpeed === idx
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <span className="text-xs font-medium">{level.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">Velocidade inicial da leitura automática na Missa</p>
                    </div>

                    {/* Rosary Mode — segmented so both options are always visible */}
                    <div>
                        <p className="text-sm font-medium mb-3">{t.rosaryMode}</p>
                        <div role="group" aria-label={t.rosaryMode} className="flex gap-2">
                            {([['beginner', 'Guiado', 'Todas as orações, conta a conta'], ['advanced', 'Só mistérios', 'Reza as contas ao seu ritmo']] as [RosaryBeadMode, string, string][]).map(([mode, label, desc]) => (
                                <button
                                    key={mode}
                                    onClick={() => setRosaryMode(mode)}
                                    aria-pressed={rosaryMode === mode}
                                    className={`flex-1 py-2 px-3 rounded-xl text-center transition-colors ${rosaryMode === mode
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <span className="text-xs font-semibold block">{label}</span>
                                    <span className="text-[0.65rem] block mt-0.5 opacity-70">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notification Preference */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Bell className="text-zinc-400" size={16} />
                            <p className="text-sm font-medium">{t.notifications}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="time"
                                value={notificationTime || ''}
                                onChange={handleNotificationChange}
                                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-zinc-900 dark:text-zinc-100 flex-1 focus:ring-2 focus:ring-liturgy-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={clearNotification}
                                className="text-xs text-red-500 hover:text-red-600 px-2 py-2"
                            >
                                {t.notificationsOff}
                            </button>
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                            {pushSubscribed
                                ? 'Lembrete ativo — chega mesmo com a aplicação fechada.'
                                : 'Por agora, o lembrete só aparece com a aplicação aberta.'}
                        </p>
                    </div>

                    {/* Liturgy of the Hours reminders — one per canonical Hour */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="text-zinc-400" size={16} />
                            <p className="text-sm font-medium">Liturgia das Horas</p>
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                            Escolha as Horas que quer rezar — cada uma avisa à hora que definir.
                        </p>
                        <div className="space-y-2">
                            {CANONICAL_HOURS.map((hour) => {
                                const time = hourReminders[hour.id];
                                const enabled = Boolean(time);
                                return (
                                    <div key={hour.id} className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={enabled}
                                            aria-label={`Lembrete: ${hour.label}`}
                                            onClick={() => setHourTime(hour.id, enabled ? null : hour.defaultTime)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-liturgy-600 focus:ring-offset-2 ${enabled ? 'bg-liturgy-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </button>
                                        <span className="text-sm flex-1 min-w-0 truncate">{hour.label}</span>
                                        <input
                                            type="time"
                                            value={time ?? hour.defaultTime}
                                            disabled={!enabled}
                                            aria-label={`Hora do lembrete: ${hour.label}`}
                                            onChange={(e) => setHourTime(hour.id, e.target.value || null)}
                                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-40 focus:ring-2 focus:ring-liturgy-500 outline-none"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
            {/* Nostr Identity Section */}
            {pubkey ? (
                <section className="surface rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t.identity}</h2>
                        {!isEditingProfile && (
                            <button onClick={() => setIsEditingProfile(true)} className="text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-700 font-medium flex items-center gap-1">
                                Editar Perfil
                            </button>
                        )}
                    </div>

                    {/* Profile Header */}
                    <div className="flex items-center gap-4 mb-6">
                        {profilePicture ? (
                            <img src={profilePicture} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                <User size={24} />
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-lg dark:text-zinc-100">{profileName || 'Anónimo'}</h3>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                {t.authenticated} {bunker ? 'Assinador remoto' : isNip07 ? 'NIP-07' : 'Chave Local'}
                            </div>
                        </div>
                    </div>

                    {isEditingProfile ? (
                        <div className="space-y-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1 block">Nome</label>
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={e => setProfileName(e.target.value)}
                                    placeholder="O seu nome..."
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-liturgy-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1 block">Imagem de Perfil</label>
                                <div className="flex items-center gap-3">
                                    {profilePicture ? (
                                        <img src={profilePicture} alt="" className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                            <User size={20} />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => pictureInputRef.current?.click()}
                                        disabled={isProcessingPicture}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-colors disabled:opacity-50"
                                    >
                                        {isProcessingPicture ? (
                                            <div className="w-4 h-4 border-2 border-zinc-400/40 border-t-zinc-500 rounded-full animate-spin" />
                                        ) : (
                                            <Upload size={15} aria-hidden="true" />
                                        )}
                                        Carregar imagem
                                    </button>
                                    {profilePicture && (
                                        <button
                                            type="button"
                                            onClick={() => { setProfilePicture(""); setPictureError(""); }}
                                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                        >
                                            Remover
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={pictureInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={e => handlePictureFile(e.target.files?.[0])}
                                    className="hidden"
                                />
                                {pictureError && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">{pictureError}</p>
                                )}
                                <label className="text-xs font-medium text-zinc-500 mt-3 mb-1 block">ou um endereço (URL)</label>
                                <input
                                    type="url"
                                    value={profilePicture.startsWith('data:') ? '' : profilePicture}
                                    onChange={e => setProfilePicture(e.target.value)}
                                    placeholder={profilePicture.startsWith('data:') ? 'A usar a imagem carregada' : 'https://'}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-liturgy-500 outline-none"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsEditingProfile(false)}
                                    className="flex-1 py-2 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium transition-colors"
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveProfile}
                                    className="flex-1 py-2 px-4 cta-primary rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    Guardar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-xs text-zinc-500">{t.pubkey}</p>
                                    <button
                                        type="button"
                                        onClick={() => copyKey('npub', npub)}
                                        className="text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-700 font-medium flex items-center gap-1"
                                    >
                                        {copied === 'npub'
                                            ? <><Check size={12} aria-hidden="true" /> Copiado</>
                                            : <><Copy size={12} aria-hidden="true" /> Copiar</>}
                                    </button>
                                </div>
                                <code className="text-xs break-all bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg block">
                                    {npub}
                                </code>
                            </div>

                            {/* Passkey protection for the stored key. */}
                            {canOfferPasskey && (
                                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium flex items-center gap-1.5">
                                                {protectedKey ? <Lock size={13} aria-hidden="true" /> : <LockOpen size={13} aria-hidden="true" />}
                                                {protectedKey ? 'Chave protegida' : 'Chave guardada sem proteção'}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {protectedKey
                                                    ? (isLocked
                                                        ? 'Desbloqueie para sincronizar e ver a chave. As orações continuam a contar neste dispositivo.'
                                                        : 'Encriptada neste dispositivo, desbloqueada nesta sessão.')
                                                    : 'Encripte a chave com a biometria do dispositivo. Fica ilegível para quem aceda ao armazenamento do navegador.'}
                                            </p>
                                        </div>
                                        {protectedKey && !isLocked && (
                                            <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400">
                                                Ativa
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        {!protectedKey && (
                                            <button
                                                type="button"
                                                onClick={handleProtectKey}
                                                disabled={vaultBusy || !nsec}
                                                className="flex-1 py-2 px-3 rounded-lg bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                                            >
                                                Proteger com biometria
                                            </button>
                                        )}
                                        {protectedKey && isLocked && (
                                            <button
                                                type="button"
                                                onClick={handleUnlockKey}
                                                disabled={vaultBusy}
                                                className="flex-1 py-2 px-3 rounded-lg bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                                            >
                                                Desbloquear
                                            </button>
                                        )}
                                        {protectedKey && !isLocked && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveProtection}
                                                disabled={vaultBusy}
                                                className="py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                Remover proteção
                                            </button>
                                        )}
                                    </div>
                                    {vaultError && <p className="text-red-500 text-xs mt-2">{vaultError}</p>}
                                </div>
                            )}

                            {/* The secret key exists only for locally generated
                                identities — with NIP-07 the extension keeps it.
                                It is the only way to carry this identity (and
                                its streaks) to another device, so it has to be
                                reachable, but never on screen by default. */}
                            {protectedKey && isLocked && (
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">Chave privada</p>
                                    <p className="text-xs text-zinc-500">
                                        Protegida. Desbloqueie acima para a ver ou copiar.
                                    </p>
                                </div>
                            )}
                            {nsec && (
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-xs text-zinc-500">Chave privada</p>
                                        <div className="flex items-center gap-3">
                                            {nsecRevealed && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyKey('nsec', nsec)}
                                                    className="text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-700 font-medium flex items-center gap-1"
                                                >
                                                    {copied === 'nsec'
                                                        ? <><Check size={12} aria-hidden="true" /> Copiado</>
                                                        : <><Copy size={12} aria-hidden="true" /> Copiar</>}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setNsecRevealed(v => !v)}
                                                aria-pressed={nsecRevealed}
                                                className="text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-700 font-medium flex items-center gap-1"
                                            >
                                                {nsecRevealed
                                                    ? <><EyeOff size={12} aria-hidden="true" /> Ocultar</>
                                                    : <><Eye size={12} aria-hidden="true" /> Mostrar</>}
                                            </button>
                                        </div>
                                    </div>
                                    {nsecRevealed ? (
                                        <>
                                            <code className="text-xs break-all bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg block">
                                                {nsec}
                                            </code>
                                            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500 mt-2">
                                                <TriangleAlert size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                                                Quem tiver esta chave assume a sua identidade. Guarde-a num sítio seguro e nunca a partilhe.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-zinc-500">
                                            Use-a para entrar na mesma conta noutro dispositivo, para manter os seus dados.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Streak + settings sync — opt-in, encrypted before leaving the device */}
                    <div className="flex items-center justify-between gap-4 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <div>
                            <p className="text-sm font-medium">Sincronizar entre dispositivos</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Guarda as suas sequências de oração e preferências (tema, tipo de letra, velocidade de leitura)
                                na rede, encriptadas — só os seus dispositivos as conseguem ler.
                                O seu nome de perfil pode aparecer a outras pessoas na lista de quem rezou hoje.
                            </p>
                        </div>
                        <button
                            onClick={() => setShareStreaks(!shareStreaks)}
                            role="switch"
                            aria-checked={shareStreaks}
                            aria-label="Sincronizar entre dispositivos"
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-liturgy-600 focus:ring-offset-2 ${shareStreaks ? 'bg-liturgy-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${shareStreaks ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    <button
                        onClick={logout}
                        className="mt-6 w-full py-2 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 rounded-xl font-medium transition-colors"
                    >
                        {t.logout}
                    </button>
                </section>
            ) : (
                <section className="surface rounded-2xl p-6">
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.loginPrompt}
                        </p>

                        {/* Signer apps are the phone's answer — they are not
                            extensions and never inject window.nostr. Three
                            ways in, in order of how little the user has to do:
                            open the app on this device, scan a code with a
                            signer on another one, or paste an address. */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                                <Smartphone size={15} aria-hidden="true" />
                                Entrar com assinador
                            </p>
                            <p className="text-xs text-zinc-500">
                                Abre a sua aplicação de assinatura para aprovar a ligação. A chave nunca sai de lá.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleSignerConnect('app')}
                                disabled={signerPending}
                                className="w-full py-3 px-4 cta-primary rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {signerPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Abrir aplicação de assinatura
                            </button>

                            {/* For a signer that isn't on this device: the same
                                request, in a form another device can read. */}
                            <button
                                type="button"
                                onClick={() => handleSignerConnect('qr')}
                                disabled={signerPending}
                                className="w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                <QrCode size={15} aria-hidden="true" />
                                O assinador está noutro dispositivo
                            </button>

                            {/* Opens on failure: after a lost approval this is
                                the way through, and the request that was just
                                approved cannot be retried. */}
                            <details className="px-1" open={!!signerError}>
                                <summary className="text-xs text-liturgy-600 dark:text-liturgy-400 cursor-pointer">
                                    Não resultou? Colar o endereço do assinador
                                </summary>
                                <div className="space-y-2 mt-2">
                                    <p className="text-xs text-zinc-500">
                                        No Amber (ou outro assinador): adicione uma aplicação, copie o endereço
                                        <span className="font-mono"> bunker://</span> e cole-o aqui — também aceita
                                        um identificador NIP-05 (nome@dominio). Ligar por aqui não depende de
                                        apanhar a resposta enquanto o navegador está suspenso.
                                    </p>
                                    <input
                                        type="text"
                                        value={bunkerUri}
                                        onChange={e => { setBunkerUri(e.target.value); setSignerError(""); }}
                                        placeholder="bunker://... ou nome@dominio"
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-liturgy-500 outline-none placeholder:text-zinc-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBunkerUriLogin}
                                        disabled={signerPending}
                                        className="w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                                    >
                                        Ligar ao assinador
                                    </button>
                                </div>
                            </details>

                            {/* Announced: the hint exists for someone with no
                                other signal that anything is wrong, so it has
                                to reach a screen reader that isn't re-scanning
                                the page. */}
                            {signerPending && (
                                <div aria-live="polite">
                                    <div className="flex items-center justify-between gap-2 px-1">
                                        <p className="text-xs text-zinc-500">A ligar ao assinador...</p>
                                        <button
                                            type="button"
                                            onClick={handleCancelSigner}
                                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0"
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    {/* The same request as the deep link, in a
                                        form a signer on another device can
                                        take. White surround whatever the
                                        theme: a QR inverted by dark mode is
                                        one many scanners refuse. */}
                                    {connectUri && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs text-zinc-500 px-1">
                                                Leia este código com a aplicação de assinatura do outro dispositivo:
                                            </p>
                                            <div className="bg-white p-3 rounded-xl w-fit mx-auto">
                                                <QRCodeSVG
                                                    value={connectUri}
                                                    size={176}
                                                    marginSize={0}
                                                    title="Código de ligação ao assinador"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {signerHint && (
                                        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500 px-1 mt-1">
                                            <TriangleAlert size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                                            {signerHint}
                                        </p>
                                    )}
                                </div>
                            )}
                            {signerError && <p role="alert" className="text-red-500 text-xs px-1">{signerError}</p>}
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={handleNip07Login}
                                disabled={!hasNip07}
                                className="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t.loginNip07}
                            </button>
                            {!hasNip07 && (
                                <p className="text-xs text-zinc-500 px-1">
                                    {isInstalledApp ? t.nip07MissingInApp : t.nip07Missing}
                                </p>
                            )}
                            {nip07Error && <p className="text-red-500 text-xs px-1">{nip07Error}</p>}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="surface-bg px-2 text-zinc-500">{t.or}</span>
                            </div>
                        </div>

                        {/* Custom Key Login */}
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={customKey}
                                onChange={e => {
                                    setCustomKey(e.target.value);
                                    setKeyError("");
                                }}
                                placeholder="Colar chave secreta (nsec ou hex)"
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-liturgy-500 outline-none placeholder:text-zinc-400"
                            />
                            {keyError && <p className="text-red-500 text-xs px-1">{keyError}</p>}
                            <button
                                onClick={() => {
                                    if (!customKey.trim()) {
                                        setKeyError("Por favor, introduza uma chave");
                                        return;
                                    }
                                    try {
                                        loginWithPrivateKey(customKey.trim());
                                    } catch (e) {
                                        setKeyError(e instanceof Error ? e.message : "Chave inválida");
                                    }
                                }}
                                className="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium transition-colors box-border"
                            >
                                Entrar com Chave Privada
                            </button>
                        </div>

                        <div className="relative pt-2">
                            <div className="absolute inset-0 flex flex-col justify-center">
                                <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="surface-bg px-2 text-zinc-500">{t.or}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newIdentityName}
                                onChange={(e) => setNewIdentityName(e.target.value)}
                                maxLength={24}
                                placeholder="O seu nome (opcional)"
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-liturgy-500 outline-none placeholder:text-zinc-400"
                            />
                            <button
                                type="button"
                                onClick={handleCreateIdentity}
                                disabled={isCreatingIdentity}
                                className="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium transition-colors disabled:opacity-60"
                            >
                                {isCreatingIdentity ? 'A criar…' : t.createKey}
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500 text-center">
                            {t.keyDisclaimer} O nome é o que aparece aos outros em «já rezou hoje» — pode mudá-lo ou deixá-lo em branco.
                        </p>
                    </div>
                </section>
            )}

            </div>
            </div>
        </div>
    );
}
