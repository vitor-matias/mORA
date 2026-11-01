// The Confissão page's texts: the exams of conscience, what is said in the
// confessional, and the Catechism's answers to the usual doubts. Quoted from:
// - Opus Dei Portugal (opusdei.org/pt-pt): the three exams by age of March
//   2016, the guide «A Confissão: guia passo a passo» (Rodolfo Valdés, Juan
//   José Silvestre) and the «Guia para a confissão» poster made for the
//   parish of Our Lady Queen of Peace, Dublin;
// - Pope Francis's exam from «Custodisci il cuore» (LEV, 2015), in the
//   Portuguese of the Dicastério para a Evangelização's «24 Horas para o
//   Senhor» subsidy (2025, pp. 9-10);
// - the Catecismo da Igreja Católica, Portuguese edition on vatican.va.
// Spelling and capitals follow the Devocionário (pre-1990: «acções», «actos»,
// «reflectir»; «Missa», «Ele» for God; «» quotes); the wording does not change.

export interface ExamSection {
    title?: string;
    /** One line of the source each. A line can hold several related
        questions, and is marked as one: that is how the source groups them. */
    questions: readonly string[];
}

export interface Exam {
    id: 'criancas' | 'jovens' | 'adultos' | 'francisco';
    /** Chip label. */
    label: string;
    intro?: string;
    sections: readonly ExamSection[];
    source: string;
}

const INTRO = `A confissão é a oportunidade de pedir perdão a Deus e de receber a sua misericórdia. Antes de se confessar, reserve alguns momentos de silêncio para reflectir no que fez e que possa ter prejudicado outras pessoas, e o que pode fazer para se tornar num cristão melhor. Uma confissão sincera permite a renovação da alma e a sua abertura à graça de Deus. As questões que se seguem podem ajudar a reflectir sobre as acções pelas quais deve pedir perdão.`;

export const EXAMS: readonly Exam[] = [
    {
        id: 'criancas',
        label: 'Crianças',
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-criancas/',
        sections: [{
            questions: [
                'Rezo as minhas orações?',
                'Fui à Missa aos domingos?',
                'Falei do nome de Deus sem necessidade?',
                'Estive desatento ou portei-me mal na Missa ou na Igreja?',
                'Ajudei lá em casa?',
                'Fui egoísta ou não tratei com carinho os meus pais e os meus irmãos?',
                'Obedeci aos meus pais e aos meus professores?',
                'Partilho os meus brinquedos com as outras crianças?',
                'Fui impaciente? Fiquei irritado ou fui invejoso?',
                'Fui egoísta ou insisti com teimosia em fazer a minha vontade?',
                'Estou distraído e perco tempo durante as aulas?',
                'Faço os trabalhos de casa o melhor que posso? Copiei nos testes?',
                'Andei à bulha com os meus amigos e colegas?',
                'Magoei alguém, dizendo mal dessa pessoa a outros?',
                'Menti?',
                'Roubei alguma coisa? Parti ou estraguei alguma coisa dos outros?',
                'Dou bom exemplo?',
                'Tenho incentivado os outros a fazer coisas erradas?',
                'Fui egoísta nos meus pensamentos e acções?',
                'Tenho ciúmes dos outros?',
                'Deixei alguém fora dos meus jogos?',
                'Rezei pelas pessoas e tentei ajudá-las a ficar mais perto de Deus?',
            ],
        }],
    },
    {
        id: 'jovens',
        label: 'Jovens',
        intro: INTRO,
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-jovens/',
        sections: [{
            questions: [
                'Neguei ou abandonei a minha fé? Tenho a preocupação de conhecê-la melhor? Recusei-me a defender a minha fé ou fiquei envergonhado dela?',
                'Disse o nome de Deus em vão? Pratiquei o espiritismo? Manifestei falta de respeito pelas pessoas, lugares ou coisas santas?',
                'Faltei voluntariamente à Missa aos domingos ou dias de preceito? Esqueci-me de Deus, descuidando as minhas orações?',
                'Recebi a Sagrada Comunhão tendo algum pecado grave não confessado?',
                'Comunguei sem a devida reverência e sem o devido agradecimento?',
                'Fui prestável em casa? Deixei de dar carinho aos meus pais?',
                'Fui impaciente, fiquei irritado ou fui invejoso? Guardei ressentimentos ou fiquei relutante em perdoar? Estive de mau humor ou cedi à ironia? Julguei mal ou senti ódio por alguém?',
                'Deixei de estudar com empenho na escola? Cedi à preguiça? Tive falta de respeito para com os meus professores ou outros adultos?',
                'Fui violento ou participei em brigas?',
                'Fiz mal a alguma pessoa insultando-a ou falando mal dela? Revelei algum segredo ou disse coisas somente para fazer mal a outros?',
                'Tive pensamentos impuros? Falei de maneira obscena? Cometi actos impuros sozinho ou com outras pessoas? Vi imagens ou vídeos pornográficos?',
                'Contei mentiras para me desculpar, para magoar os outros ou para enaltecer a minha imagem?',
                'Roubei alguma coisa? Estraguei de propósito o que era dos outros? Fiz algum acto de vandalismo?',
                'Tenho inveja dos outros, da sua aparência, da sua popularidade, do seu trabalho, do seu dinheiro? Deixo que o meu coração fique preso ao desejo de possuir?',
                'Encorajei outros a comportarem-se mal?',
                'Consumi álcool em excesso? Usei drogas?',
                'Fui vaidoso ou egoísta nos meus pensamentos ou acções?',
                'Preferi a minha comodidade, fugindo do serviço aos outros? Tive a preocupação de aproximar os outros de Deus, com o meu exemplo e a minha palavra?',
            ],
        }],
    },
    {
        id: 'adultos',
        label: 'Adultos',
        intro: INTRO,
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-adultos/',
        sections: [{
            questions: [
                'Neguei ou abandonei a minha fé? Tenho a preocupação de conhecê-la melhor? Recusei-me a defender a minha fé ou tive vergonha dela? Existe algum aspecto da minha fé que eu ainda não aceito?',
                'Disse o nome de Deus em vão? Pratiquei o espiritismo ou coloquei a minha confiança em bruxos ou horóscopos? Manifestei falta de respeito pelas pessoas, lugares ou coisas santas?',
                'Faltei voluntariamente à Missa aos domingos ou dias de preceito?',
                'Recebi a Sagrada Comunhão tendo algum pecado grave não confessado?',
                'Recebi a Comunhão sem agradecimento ou sem a devida reverência?',
                'Fui impaciente, fiquei irritado ou fui invejoso?',
                'Guardei ressentimentos ou fiquei relutante em perdoar?',
                'Fui violento nas palavras ou acções com outros?',
                'Colaborei ou encorajei alguém a fazer um aborto ou a destruir embriões humanos, a praticar eutanásia ou qualquer outro meio de acabar com a vida?',
                'Tive ódio ou fiz juízos críticos, em pensamentos ou acções? Olhei os outros com desprezo?',
                'Falei mal dos outros, levando à má-língua?',
                'Abusei de bebidas alcoólicas? Usei drogas?',
                'Vi vídeos ou sites pornográficos? Cometi actos impuros, sozinho ou com outras pessoas? Vivo com alguém como se fosse casado, sem que o seja?',
                'Se sou casado, procuro amar o meu cônjuge mais do que a qualquer outra pessoa? Coloco o meu casamento em primeiro lugar? E os meus filhos? Tenho uma atitude aberta a novos filhos?',
                'Trabalho de modo desordenado, ocupando o tempo e energias que deveria dedicar à minha família e amigos?',
                'Fui orgulhoso ou egoísta nos meus pensamentos e acções? Deixei de ajudar os pobres e os necessitados? Gastei dinheiro com o meu conforto e luxo pessoal, esquecendo as minhas responsabilidades para com os outros e para com a Igreja?',
                'Disse mentiras? Fui honesto e diligente no meu trabalho? Roubei ou enganei alguém no trabalho?',
                'Cedi à preguiça? Preferi a comodidade ao invés do serviço aos outros? Descuidei a minha responsabilidade de aproximar os outros de Deus, com o meu exemplo e a minha palavra?',
            ],
        }],
    },
    {
        id: 'francisco',
        label: 'Papa Francisco',
        intro: 'O exame de consciência que o Papa Francisco ofereceu aos fiéis em 2015, em «Custodisci il cuore». Para adultos, em três partes.',
        source: 'https://www.evangelizatio.va/content/dam/pcpne/image/24ore/2025/PT%20Sussidio%2024ore%2025.pdf',
        sections: [
            {
                title: 'Para com Deus',
                questions: [
                    'Só me dirijo a Deus em caso de necessidade?',
                    'Vou à Missa aos domingos e dias de preceito?',
                    'Começo e termino o dia com a oração?',
                    'Invoco o nome de Deus, da Virgem, dos Santos em vão?',
                    'Tenho vergonha de me mostrar cristão?',
                    'O que faço para crescer espiritualmente? Como? Quando?',
                    'Revolto-me perante os desígnios de Deus?',
                    'Exijo que Ele faça a minha vontade?',
                ],
            },
            {
                title: 'Para com os outros',
                questions: [
                    'Sei perdoar, compadecer-me, ajudar o próximo?',
                    'Caluniei, roubei, desprezei os pequenos e indefesos?',
                    'Sou invejoso, colérico, parcial?',
                    'Preocupo-me com os pobres e os doentes?',
                    'Envergonho-me do meu irmão, da minha irmã?',
                    'Sou honesto e justo com todos, ou alimento a «cultura do desperdício»?',
                    'Incitei os outros a fazer o mal?',
                    'Observo a moral conjugal e familiar ensinada pelo Evangelho?',
                    'Como vivo a minha responsabilidade educativa para com os meus filhos? Honro e respeito os meus pais?',
                    'Rejeitei a vida assim que foi concebida?',
                    'Extingui o dom da vida? Ajudei a fazê-lo?',
                    'Respeito o ambiente?',
                ],
            },
            {
                title: 'Para consigo mesmo',
                questions: [
                    'Sou um pouco mundano e um pouco crente?',
                    'Exagero a comer, a beber, a fumar, a divertir-me?',
                    'Preocupo-me demasiado com a minha saúde física, com os meus bens?',
                    'Como é que utilizo o meu tempo? Sou preguiçoso?',
                    'Quero ser servido?',
                    'Amo e cultivo a pureza do coração, dos pensamentos e das acções?',
                    'Cultivo a vingança, guardo rancor?',
                    'Sou manso, humilde, construtor de paz?',
                ],
            },
        ],
    },
];

export const EXAM_GUIDE_URL = 'https://opusdei.org/pt-pt/article/guia-breve-confissao-jubileu-misericordia/';
export const CATECHISM_URL = 'https://www.vatican.va/archive/cathechism_po/index_new/prima-pagina-cic_po.html';

/** Our own cue, above every exam: the list is a reminder, not a script. */
export const HOW_TO = 'Cada pergunta marca-se com um toque. A lista que se forma é só um lembrete: na confissão, dizemos os pecados por palavras nossas.';

/** From the guide: the questions are a help, not a form. It opens «Servem»;
    the subject is named here because the sentence no longer follows them. */
export const EXAM_NOTE = `As perguntas servem apenas como uma orientação: o mais importante é entrar no próprio coração e admitir as próprias faltas. Se queremos, durante a confissão podemos pedir ao sacerdote que nos ajude propondo-nos outras questões.`;

/** The guide's «4 C» of a good confession. */
export const FOUR_CS: readonly (readonly [string, string])[] = [
    ['Clara', 'indicar qual foi a falta específica, sem acrescentar desculpas.'],
    ['Concreta', 'referir o acto ou pensamento preciso, não usar frases genéricas.'],
    ['Concisa', 'evitar dar explicações ou descrições desnecessárias.'],
    ['Completa', 'sem calar nenhum pecado grave, vencendo a vergonha.'],
];

/** The guide on contrition: sorrow need not be felt to be real. */
export const CONTRITION_NOTE = `Por vezes, o arrependimento chega com um sentimento intenso de dor ou vergonha, que nos ajuda a emendar-nos. No entanto, não é indispensável sentir esse tipo de dor; o importante é compreender que agimos mal, ter desejos de melhorar como cristãos e fazer o propósito de não voltar a cometer essas faltas.`;

export const PENANCE_NOTE = `A satisfação consiste no cumprimento de certos actos de penitência (orações, alguma mortificação, etc.), que o confessor indica ao penitente para reparar o dano causado pelo pecado. É uma ocasião também para dar graças a Deus pelo perdão recebido e renovar o propósito de não voltar a pecar.`;

/** The Catechism's answers to what people ask before confessing. The
    question is our own wording; the answer is the Catechism's. */
export const DOUBTS: readonly { question: string; answer: string; cic: string }[] = [
    {
        question: 'O que torna um pecado grave?',
        cic: '1857, 1860',
        answer: `Para que um pecado seja mortal, requerem-se, em simultâneo, três condições: «É pecado mortal o que tem por objecto uma matéria grave, e é cometido com plena consciência e de propósito deliberado».

A ignorância involuntária pode diminuir, ou mesmo desculpar, a imputabilidade duma falta grave. […] Os impulsos da sensibilidade e as paixões podem também diminuir o carácter voluntário e livre da falta. O mesmo se diga de pressões externas e de perturbações patológicas.`,
    },
    {
        question: 'Tenho de dizer todos os pecados? E se me esquecer de algum?',
        cic: '1456',
        answer: `«Os penitentes devem, na confissão, enumerar todos os pecados mortais de que têm consciência, após se terem seriamente examinado […]». «Quando os fiéis se esforçam por confessar todos os pecados de que se lembram, não se pode duvidar de que os apresentam todos ao perdão da misericórdia divina.»`,
    },
    {
        question: 'Vale a pena confessar pecados leves?',
        cic: '1458',
        answer: `Sem ser estritamente necessária, a confissão das faltas quotidianas (pecados veniais) é contudo vivamente recomendada pela Igreja. Com efeito, a confissão regular dos nossos pecados veniais ajuda-nos a formar a nossa consciência, a lutar contra as más inclinações, a deixarmo-nos curar por Cristo, a progredir na vida do Espírito.`,
    },
    {
        question: 'O sacerdote pode contar a alguém?',
        cic: '1467',
        answer: `Dada a delicadeza e a grandeza deste ministério e o respeito devido às pessoas, a Igreja declara que todo o sacerdote que ouve confissões está obrigado a guardar segredo absoluto sobre os pecados que os seus penitentes lhe confessaram, sob penas severíssimas. Tão pouco pode servir-se dos conhecimentos que a confissão lhe proporciona sobre a vida dos penitentes. Este segredo, que não admite excepções, é chamado «sigilo sacramental», porque aquilo que o penitente manifestou ao sacerdote fica «selado» pelo sacramento.`,
    },
    {
        question: 'E se não me puder confessar?',
        cic: '1452',
        answer: `Quando procedente do amor de Deus, amado sobre todas as coisas, a contrição é dita «perfeita» (contrição de caridade). Uma tal contrição perdoa as faltas veniais: obtém igualmente o perdão dos pecados mortais, se incluir o propósito firme de recorrer, logo que possível, à confissão sacramental.`,
    },
];

export type RiteLine =
    | { who: 'penitente' | 'sacerdote'; text: string }
    /** A cue in the app's own words, or a prayer from the Devocionário by id. */
    | { who: 'nota'; text: string; prayerId?: string };

/** Under the «No confessionário» heading: the greeting, the counsel and the
    dismissal are the priest's own, so the dialogue is a guide, not a script. */
export const RITE_NOTE = 'As palavras do sacerdote podem variar.';

/** The Dublin poster's five steps. The spoken lines are the poster's, except
    the Sign of the Cross and the act of contrition, which the Devocionário
    carries in the form prayed in Portugal, and the absolution, which is the
    full formula as the Catechism gives it (n.º 1449). */
export const RITE: readonly (readonly RiteLine[])[] = [
    [
        { who: 'nota', text: 'Depois dos cumprimentos, fazemos o sinal da cruz:' },
        { who: 'penitente', text: 'Em nome do Pai e do Filho e do Espírito Santo.' },
        { who: 'sacerdote', text: 'O Senhor esteja no teu coração para que confesses os teus pecados com espírito arrependido.' },
    ],
    [
        { who: 'penitente', text: 'Já se passaram… dias / semanas / anos desde a minha última confissão.' },
        { who: 'nota', text: 'Se não sabemos ao certo, basta um número aproximado.' },
        { who: 'penitente', text: 'Os meus pecados são…' },
        { who: 'nota', text: 'Confessamos os pecados por palavras nossas, começando pelos mais graves.' },
    ],
    [
        { who: 'nota', text: 'O sacerdote dá-nos alguns conselhos e indica-nos uma penitência, habitualmente uma oração.' },
    ],
    [
        { who: 'nota', text: 'Exprimimos o arrependimento com um acto de contrição:', prayerId: 'acto-de-contricao-simples' },
    ],
    [
        { who: 'nota', text: 'Com a fórmula da absolvição, é o próprio Jesus que nos perdoa:' },
        { who: 'sacerdote', text: 'Deus, Pai de misericórdia, que, pela morte e ressurreição de seu Filho, reconciliou o mundo consigo e enviou o Espírito Santo para a remissão dos pecados, te conceda, pelo ministério da Igreja, o perdão e a paz. E Eu te absolvo dos teus pecados em nome do Pai, e do Filho e do Espírito Santo.' },
        { who: 'nota', text: 'Respondemos:' },
        { who: 'penitente', text: 'Amen.' },
        { who: 'nota', text: 'No fim, o sacerdote despede-nos em paz.' },
    ],
];
