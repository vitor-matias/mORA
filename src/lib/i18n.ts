const translations = {
    home: {
        greeting: "Bom dia.",
        whatToPray: "O que vamos rezar hoje?",
        progress: "O seu Progresso",
        streakDays: "dias",
        consecutively: "seguidos",
        rosaryTitle: "Santo Terço",
        rosaryDesc: "Reze e medite os mistérios diários",
        liturgyTitle: "Missa Diária",
        liturgyDesc: "Leituras e meditação da missa de hoje",
        hoursTitle: "Liturgia das Horas",
        hoursDesc: "Ofício, Laudes, Hora Intermédia, Vésperas e Completas",
        profileTitle: "Perfil & Progresso",
        profileDesc: "O seu Streak e configurações"
    },
    profile: {
        title: "Perfil",
        subtitle: "A tua identidade e configurações.",
        identity: "Cópia de segurança e sincronização",
        pubkey: "Identificador público",
        authenticated: "Autenticado via",
        logout: "Terminar Sessão",
        loginPrompt: "O seu progresso fica guardado neste dispositivo. Se quiser uma cópia de segurança portátil (opcional, para utilizadores avançados):",
        loginNip07: "Entrar com Extensão Nostr",
        nip07Missing: "Não foi detetada nenhuma extensão Nostr neste navegador.",
        // Android installs a PWA as its own app, and browser extensions don't
        // reach it — the extension button can never work there, so say so
        // instead of leaving a button that does nothing.
        nip07MissingInApp: "Não foi detetada nenhuma extensão Nostr. Na aplicação instalada as extensões não ficam disponíveis — abra o mORA no navegador para entrar com a extensão, ou use a sua chave secreta abaixo.",
        nip07Failed: "Não foi possível entrar com a extensão.",
        or: "ou",
        createKey: "Criar identidade anónima",
        keyDisclaimer: "Criamos uma chave secreta guardada apenas neste dispositivo. Não é preciso e-mail nem dados pessoais.",
        settings: "Configurações",
        theme: "Tema da Aplicação",
        light: "Claro",
        dark: "Escuro",
        system: "Sistema",
        language: "Idioma",
        notifications: "Notificação Diária (Terço)",
        notificationsOff: "Desativado",
        notificationsSet: "Definir Hora",
        rosaryMode: "Modo do Terço",
        rosaryBeginner: "Iniciante",
        rosaryAdvanced: "Avançado",
        rosaryBeginnerToggle: "Ativar Modo Iniciante",
        rosaryAdvancedToggle: "Ativar Modo Avançado"
    },
    rosary: {
        finish: "Concluir Terço",
        nextMystery: "Próximo Mistério",
        finishMystery: "Concluir Mistério",
        nextBead: "Próxima Avé Maria"
    }
} as const;

export function useTranslations() {
    return translations;
}
