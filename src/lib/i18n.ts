const translations = {
    home: {
        greeting: "Bom dia.",
        whatToPray: "O que vamos rezar hoje?",
        progress: "O seu Progresso (Terço)",
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
        identity: "A tua Identidade Nostr",
        pubkey: "Chave Pública (npub)",
        authenticated: "Autenticado via",
        logout: "Terminar Sessão",
        loginPrompt: "Para guardar o teu progresso e interagir com a comunidade, escolhe uma forma de entrar:",
        loginNip07: "Entrar com Extensão Nostr",
        or: "ou",
        createKey: "Criar Chave Anónima",
        keyDisclaimer: "Criaremos uma chave secreta no teu dispositivo. Nenhuma informação pessoal é necessária.",
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
