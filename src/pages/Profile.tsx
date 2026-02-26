import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useAppStore, type ThemeMode, type FontSize, type FontFamily } from "@/store/app";
import { ChevronRight, Settings, Moon, Sun, Monitor, Bell, Type, User, Save } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fetchNostrProfile, publishNostrProfile } from "@/lib/nostr";

export default function Profile() {
    const { pubkey, isNip07, loginWithNip07, loginWithPrivateKey, generateLocalKey, logout, setProfile } = useAuthStore();
    const { theme, setTheme, notificationTime, setNotificationTime, rosaryMode, toggleRosaryMode, fontSize, setFontSize, fontFamily, setFontFamily } = useAppStore();
    const t = useTranslations().profile;

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [profilePicture, setProfilePicture] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Custom key input
    const [customKey, setCustomKey] = useState("");
    const [keyError, setKeyError] = useState("");

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

    // Handles picking a notification time
    const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        if (time) {
            setNotificationTime(time);
            if (Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
        } else {
            setNotificationTime(null);
        }
    };

    return (
        <div className="p-6 pt-12 max-w-md mx-auto space-y-8 flex-1 w-full flex flex-col">
            <header className="flex items-center gap-4">
                <button
                    onClick={() => window.history.back()}
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 p-2 rounded-full"
                >
                    <ChevronRight className="rotate-180" size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                    <p className="text-zinc-500">{t.subtitle}</p>
                </div>
            </header>


            {/* Application Settings Section */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
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
                        <div className="flex gap-2">
                            {([['small', 'P'], ['medium', 'M'], ['large', 'G'], ['xlarge', 'XG']] as [FontSize, string][]).map(([sz, label]) => (
                                <button
                                    key={sz}
                                    onClick={() => setFontSize(sz)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-center transition-colors ${fontSize === sz
                                        ? 'bg-liturgy-50 dark:bg-liturgy-900/30 text-liturgy-600 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    <span className="text-xs font-medium">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rosary Mode Toggle */}
                    <div className="flex items-center justify-between py-1">
                        <div>
                            <p className="text-sm font-medium">{t.rosaryMode}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                {rosaryMode === 'beginner' ? t.rosaryBeginner : t.rosaryAdvanced}
                            </p>
                        </div>
                        <button
                            onClick={toggleRosaryMode}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-liturgy-600 focus:ring-offset-2 ${rosaryMode === 'beginner' ? 'bg-liturgy-600' : 'bg-zinc-200 dark:bg-zinc-700'
                                }`}
                            role="switch"
                            aria-checked={rosaryMode === 'beginner'}
                        >
                            <span className="sr-only">Toggle Rosary Mode</span>
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rosaryMode === 'beginner' ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                            />
                        </button>
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
                                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-zinc-900 dark:text-zinc-100 flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                                onClick={() => setNotificationTime(null)}
                                className="text-xs text-red-500 hover:text-red-600 px-2"
                            >
                                {t.notificationsOff}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
            {/* Nostr Identity Section */}
            {pubkey ? (
                <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
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
                                {t.authenticated} {isNip07 ? 'NIP-07' : 'Chave Local'}
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
                                <label className="text-xs font-medium text-zinc-500 mb-1 block">URL da Imagem de Perfil</label>
                                <input
                                    type="url"
                                    value={profilePicture}
                                    onChange={e => setProfilePicture(e.target.value)}
                                    placeholder="https://"
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
                                    className="flex-1 py-2 px-4 bg-liturgy-600 hover:bg-liturgy-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
                                <p className="text-xs text-zinc-500 mb-1">{t.pubkey}</p>
                                <code className="text-xs break-all bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg block">
                                    {pubkey}
                                </code>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={logout}
                        className="mt-6 w-full py-2 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 rounded-xl font-medium transition-colors"
                    >
                        {t.logout}
                    </button>
                </section>
            ) : (
                <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.loginPrompt}
                        </p>

                        <button
                            onClick={loginWithNip07}
                            className="w-full py-3 px-4 bg-liturgy-600 hover:bg-liturgy-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {t.loginNip07}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">{t.or}</span>
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
                                    } catch (e: any) {
                                        setKeyError(e.message || "Chave inválida");
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
                                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">{t.or}</span>
                            </div>
                        </div>

                        <button
                            onClick={generateLocalKey}
                            className="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium transition-colors"
                        >
                            {t.createKey}
                        </button>
                        <p className="text-xs text-zinc-500 text-center">
                            {t.keyDisclaimer}
                        </p>
                    </div>
                </section>
            )}

        </div>
    );
}
