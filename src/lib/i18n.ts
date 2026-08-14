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
    // Palavra Bíblica do Dia. Entries that interpolate are functions rather
    // than templates with placeholders, so the call site can't pass the
    // arguments in the wrong order and a translator can move them freely.
    palavra: {
        title: "Palavra Bíblica do Dia",
        subtitle: "Um versículo, uma palavra escondida",
        sections: "Secções",
        tabGame: "Jogo",
        tabCommunity: "Comunidade",

        demoMode: "Modo de demonstração — sem publicador de desafios configurado.",
        archiveRecorded: "Já jogaste este dia — este é o teu resultado.",
        archivePractice: "Modo de treino — não conta para o teu registo nem para as classificações.",

        loading: "A carregar o desafio…",
        loadFailed: "Não foi possível carregar o desafio.",
        corrupt: "Este desafio chegou danificado. Tente novamente mais tarde.",

        letters: (n: number) => `${n} letras`,
        hiddenWord: (n: number) => `palavra escondida de ${n} letras`,
        wrongLength: (n: number) => `A palavra tem ${n} letras.`,
        alreadyTried: "Já tentaste essa palavra.",
        shareHeading: (date: string, score: string) => `mORA — Palavra Bíblica do Dia ${date} ${score}`,

        board: "Tabuleiro de jogo",
        keyboard: "Teclado",
        confirmWord: "Confirmar palavra",
        deleteLetter: "Apagar letra",
        // On a tile, read out after the letter: "A, correta."
        markCorrect: "correta",
        markPresent: "noutra posição",
        markAbsent: "não existe",
        // On a key, read out after the letter: "A, na posição certa".
        keyCorrect: "na posição certa",
        keyPresent: "na palavra, noutra posição",
        keyAbsent: "não está na palavra",

        wonFirstTry: "À primeira!",
        wonIn: (tries: number) => `Acertaste em ${tries} tentativas.`,
        lost: "Fica para amanhã.",
        answerWas: "A palavra era",
        record: "O teu registo",
        recordUnchanged: "(inalterado — este jogo não conta)",
        statPlays: "jogos",
        statWins: "vitórias",
        statStreak: "seguidos",
        statBest: "recorde",
        distribution: "Distribuição",
        copyResult: "Copiar resultado",
        shareResult: "Partilhar resultado",
        shared: "Partilhado",
        copied: "Copiado",
        copyFailed: "Não foi possível copiar",
        nextWordIn: (countdown: string) => `Próxima palavra em ${countdown}.`,

        publish: "Publicar no Nostr",
        publishing: "A publicar…",
        published: "Publicado no Nostr",
        publishFailed: "Não foi possível publicar",

        tabBoard: "Do dia",
        tabStreaks: "Seguidos",
        loadingStreaks: "A carregar as sequências…",
        emptyStreaks: "Ainda ninguém tem uma sequência a decorrer.",
        streaksLegend: "Dias seguidos a acertar, entre quem jogou hoje ou ontem. O número é publicado por cada jogador; ✓ marca os que foram confirmados nos relays, por amostragem dos dias da sequência.",
        streakVerified: "Sequência confirmada nos relays",
        tabDuels: "Duelos",
        tabLeagues: "Ligas",
        notSharing: "Está a ver os resultados dos outros. Para aparecer nas classificações, ative a partilha em Perfil.",
        spoiler: "Termina o jogo de hoje para ver os resultados.",
        spoilerWhy: "Quantas tentativas os outros precisaram diz-lhe quão difícil é a palavra.",
        signInHint: "Entre com uma identidade Nostr em Perfil.",
        signInDuels: "Os duelos comparam-no com quem segue no Nostr.",
        signInLeagues: "As ligas precisam de uma identidade Nostr para guardar de quais faz parte.",

        loadingBoard: "A consultar os relays…",
        emptyBoard: "Ainda ninguém publicou o resultado de hoje.",
        emptyBoardArchive: "Ninguém publicou o resultado deste dia.",
        you: "(tu)",

        loadingDuels: "A comparar resultados…",
        emptyDuels: "Nenhum duelo ainda. Os duelos comparam com quem te segue no Nostr, nos dias em que ambos jogaram.",
        duelsLegend: (days: number) => `Vitórias · empates · derrotas, nos últimos ${days} dias. Só contam os dias em que ambos terminaram o jogo.`,
        days: (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`,

        loadingLeagues: "A carregar as tuas ligas…",
        emptyLeagues: "Ainda não pertences a nenhuma liga. Cria uma e partilha o convite, ou cola o convite que recebeste.",
        loadingStandings: "A reunir resultados…",
        emptyStandings: "Ninguém desta liga publicou o resultado de hoje.",
        standingsSpoiler: "Termina o jogo de hoje para ver a classificação desta liga.",
        newLeagueName: "Nome da nova liga",
        createLeague: "Criar liga",
        inviteInvalid: "Esse convite não é válido.",
        invitePlaceholder: "Colar convite (naddr…)",
        joinLeague: "Entrar",
        copyInvite: (name: string) => `Copiar convite para ${name}`,
        leaveLeague: (name: string) => `Sair de ${name}`,
        leagueActionFailed: "Não foi possível concluir. Tente novamente.",
        // Split so "não listada" can be emphasised — the distinction is the
        // whole point of the sentence and a user could act on getting it wrong.
        unlistedBefore: "Uma liga é ",
        unlistedBold: "não listada",
        unlistedAfter: ", não privada: só entra quem tiver o convite, mas os resultados são eventos públicos no Nostr e qualquer pessoa os pode ler.",

        openInBible: "(abre a Bíblia noutro separador)",

        // Home row and the Perfil opt-in.
        homeStreak: (n: number) => ` · ${n} ${n === 1 ? 'seguido' : 'seguidos'}`,
        homeIdle: "Um versículo, uma palavra escondida",
        homeSolved: (tries: number, max: number) => `Resolvida em ${tries}/${max}`,
        homeLost: "Hoje não acertou — nova palavra amanhã",
        shareToggle: "Participar nas classificações da Palavra",
        shareToggleHelp: "Publica o resultado diário da Palavra Bíblica — quantas tentativas e em quanto tempo — de forma pública na rede Nostr, para aparecer nas classificações, nos duelos e nas ligas. A palavra e as tuas tentativas nunca são publicadas. Sem isto continuas a ver as classificações dos outros; apenas não apareces nelas.",

        // The "Como jogar" explainer, shown once on first entry and
        // reachable afterwards from the header.
        howToPlayTitle: "Como jogar",
        howToPlayClose: "Fechar",
        howToPlayIntro: "Descobre a palavra que o versículo de hoje esconde. Tens em 6 tentativas.",
        howToPlaySubmit: "Cada tentativa é uma palavra com o mesmo número de letras da palavra escondida, entre 5 e 8, consoante o versículo do dia. Escreve e confirma com o Enter ⏎.",
        howToPlayColors: "Depois de cada tentativa, a cor das letras muda para mostrar o quão perto estás da solução.",
        howToPlayExamples: "Exemplos",
        howToPlayExampleCorrect: "A letra T está na palavra e na posição certa.",
        howToPlayExamplePresent: "A letra E está na palavra, mas fora desta posição.",
        howToPlayExampleAbsent: "A letra O não está na palavra.",
        howToPlayDaily: "Há um novo versículo todos os dias.",
        howToPlayReveal: "No final, o versículo completo revela-se e podes ver como te saiste face aos outros jogadores.",
        howToPlayCta: "Entendido",
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
