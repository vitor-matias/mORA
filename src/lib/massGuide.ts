// "Missa explicada" — the day's Mass laid out in celebration order for someone
// who doesn't yet know the structure.
//
// The API gives us only the *propers* (the texts that change day to day:
// antiphons, collect, readings, prayer over the offerings). The *Ordinary* —
// the fixed skeleton everyone knows by heart, and a newcomer doesn't — isn't
// in there at all. This module holds that skeleton and threads the day's
// propers through it.
//
// What gets printed, and what doesn't:
//   • The assembly's own parts are printed in full, so the reader can join in.
//   • Everything the assembly only listens to — the priest's presidential
//     prayers, the day's orations and antiphons — is printed too, but collapsed
//     behind a toggle: there for whoever wants to follow along, out of the way
//     of the newcomer trying to see the shape of the celebration. The readings
//     are the exception, and stay open.
//   • Rubrics addressed to the celebrant are left out; each part instead gets
//     a plain-language note and a posture cue. The posture is a badge on the
//     title, always in sight; the note opens from an info button beside it,
//     because someone following the celebration live needs the words before
//     the "why", and printed always-on the explanations stand between every
//     title and the text they introduce.
//
// Texts of the Ordinary © Conferência Episcopal Portuguesa / Secretariado
// Nacional de Liturgia, from the Ordinário da Missa.
//
// Output is an HTML string rather than a component tree so the whole existing
// pipeline in Liturgy.tsx — sanitizing, reading typography, the table of
// contents, scrollspy, autoscroll and read-completion — keeps working unchanged.

import type { MassOrdo } from './massOrdo';

// ---------------------------------------------------------------- structure

/** Who speaks a line. Drives the label and the highlight. */
type Speaker = 'sacerdote' | 'todos' | 'leitor' | 'diacono' | 'celebrante' | 'ministro' | 'comungante';

const SPEAKER_LABELS: Record<Speaker, string> = {
    sacerdote: 'Sacerdote',
    todos: 'Todos',
    leitor: 'Leitor',
    diacono: 'Diácono',
    // The missal gives these lines to "o diácono ou o próprio sacerdote" —
    // and most parishes have no deacon, so naming one would mislead.
    celebrante: 'Sacerdote ou diácono',
    // Communion is often distributed by an extraordinary minister, so this
    // line is not the priest's alone.
    ministro: 'Ministro',
    comungante: 'Quem comunga',
};

/** Posture cues, as used in Portuguese parishes. */
type Posture = 'pe' | 'sentado' | 'joelhos' | 'joelhos-ou-pe' | 'fila';

const POSTURE_LABELS: Record<Posture, string> = {
    pe: 'De pé',
    sentado: 'Sentado',
    joelhos: 'De joelhos',
    'joelhos-ou-pe': 'De joelhos ou de pé',
    fila: 'Em procissão',
};

interface Line {
    who: Speaker;
    /** Verse lines separated by "\n"; rendered with <br>. */
    text: string;
    /** Renders as an "Ou" alternative rather than the main form. */
    variant?: boolean;
    /** Qualifies when this form is used, e.g. "no Tempo Pascal". Shown on the
        alternative's tag, as the missal prints it ("Ou, no Tempo Pascal:"). */
    when?: string;
    /** Continues the current alternative instead of opening a new one — for a
        several-exchange form like the Greek Kyrie, where a fresh call after a
        response would otherwise be tagged as another "Ou". */
    continues?: boolean;
    /** Posture badge shown just above this line, for a part where the posture
        changes partway through. */
    cue?: Posture;
}

/** The day's changing texts, pulled out of the API HTML. */
type ProperSlot = 'entrada' | 'coleta' | 'oblatas' | 'comunhao' | 'poscomunhao';

/** A presidential prayer, printed in full but collapsed behind a toggle. */
interface Celebrant {
    label: string;
    text: string;
}

interface Part {
    id: string;
    title: string;
    posture?: Posture;
    /** Plain-language explanation of what is happening and why. Folded behind
        the title's info button. */
    note?: string;
    /** What the priest does here, described rather than quoted. */
    summary?: string;
    lines?: Line[];
    /** The day's proper text, injected after the note and before the lines. */
    proper?: ProperSlot;
    /** Toggle label; set when the proper should start collapsed. Every proper
        uses this: the antiphons because a sung Mass replaces them with a hymn,
        the orations because the assembly listens rather than reads along and
        answers only the "Amen", which stays visible below. */
    properCollapsed?: string;
    /** Lines that follow the injected proper (typically the "Amen"). */
    after?: Line[];
    /** Presidential prayer shown (collapsed) before this part's lines. */
    celebrant?: Celebrant;
    /** Presidential prayer shown (collapsed) after this part's lines. */
    celebrantAfter?: Celebrant;
    /** Renders the day's readings here, each with its own response. */
    readings?: boolean;
    /** Adds this part to the table of contents. Off by default — the five
        divisions and the readings carry it, and every part on top of that
        would make the chips row unscannable. */
    toc?: boolean;
    /** Include only when the day calls for it. */
    onlyIf?: keyof MassOrdo;
}

interface Division {
    id: string;
    /** Shown as the division heading and as the table-of-contents entry. */
    title: string;
    /** One line on what this whole division is for. */
    intro: string;
    parts: Part[];
}

const DIVISIONS: Division[] = [
    {
        id: 'ritos-iniciais',
        title: 'Ritos Iniciais',
        intro: 'Podemos ter vindo por hábito, porque alguém insistiu, ou à procura de uma coisa '
            + 'a que não sabemos dar nome. Santo Agostinho deu-lho: «Fizestes-nos para Vós, e o '
            + 'nosso coração está inquieto enquanto não repousar em Vós.» A Missa não é uma '
            + 'cerimónia a que se assiste: é um encontro marcado, e antes de qualquer um de nós '
            + 'ter decidido vir já Cristo tinha decidido esperar-nos, não uma multidão anónima, '
            + 'cada um pelo nome. Estes primeiros ritos servem para isso, para nos pôr realmente '
            + 'diante d\'Ele.',
        parts: [
            {
                id: 'entrada',
                title: 'Entrada',
                posture: 'pe',
                note: 'Ficamos de pé enquanto a procissão avança, e no fim o sacerdote beija o altar. '
                    + 'Aquela mesa representa o próprio Cristo, e por isso o primeiro gesto da Missa é '
                    + 'um beijo: não se cumprimenta assim uma ideia, cumprimenta-se assim uma pessoa querida. '
                    + 'Quando a assembleia canta, Ele já está no meio de nós, como prometeu estar onde '
                    + 'dois ou três se reunissem em seu nome. Se não houver cântico, lê-se a antífona '
                    + 'do dia.',
                proper: 'entrada',
                properCollapsed: 'Antífona de entrada',
            },
            {
                id: 'sinal-da-cruz',
                title: 'Sinal da Cruz',
                posture: 'pe',
                note: 'Começamos pelo nome d\'Ele sobre nós. Foram estas as palavras do nosso baptismo, '
                    + 'o dia em que a vida de Deus começou a correr na nossa, e traçá-las agora no '
                    + 'corpo é responder a quem nos escolheu primeiro: pertencemos ao Pai, ao Filho e '
                    + 'ao Espírito Santo, e não como criaturas apenas, mas como filhos. Tudo o que a '
                    + 'Missa vai rezar circula dentro deste nome. Vale a pena fazê-lo devagar e amplo, '
                    + 'da testa ao peito, de um ombro ao outro.',
                lines: [
                    { who: 'sacerdote', text: 'Em nome do Pai e do Filho e do Espírito Santo.' },
                    { who: 'todos', text: 'Amen.' },
                ],
            },
            {
                id: 'saudacao',
                title: 'Saudação',
                posture: 'pe',
                note: 'A saudação não é uma frase de simpatia: é a apresentação de quem realmente '
                    + 'preside. O sacerdote empresta a voz, mas quem nos recebe é Cristo, '
                    + 'presente na assembleia reunida, na Palavra que vai ser proclamada e no pão que '
                    + 'vai ser dado. Respondemos, e nesse vaivém começa uma conversa que já não pára '
                    + 'até ao fim da celebração.',
                // In the missal's own order: the trinitarian greeting is the
                // first form given, with "O Senhor esteja convosco" among the
                // alternatives that follow.
                lines: [
                    {
                        who: 'sacerdote',
                        text: 'A graça de nosso Senhor Jesus Cristo,\no amor do Pai e a comunhão do Espírito Santo\nestejam convosco.',
                    },
                    { who: 'todos', text: 'Bendito seja Deus, que nos reuniu no amor de Cristo.' },
                    { who: 'sacerdote', variant: true, text: 'O Senhor esteja convosco.' },
                    { who: 'todos', variant: true, text: 'Ele está no meio de nós.' },
                ],
            },
            {
                id: 'ato-penitencial',
                title: 'Ato Penitencial',
                posture: 'pe',
                toc: true,
                note: 'Antes de tudo o resto, a verdade sobre nós. Não é para nos sentirmos mal mas para '
                    + 'chegarmos a Deus sem máscaras, que é a única maneira de lá chegar. E não há aqui '
                    + 'casos perdidos: «Deus nunca se cansa de perdoar», insiste o Papa Francisco, «somos '
                    + 'nós que nos cansamos de pedir a sua misericórdia». Guarda-se um silêncio, e vale '
                    + 'a pena usá-lo a sério. Ao dizermos «por minha culpa», batemos levemente no '
                    + 'peito. Há três fórmulas; esta é a mais usada.',
                celebrant: {
                    label: 'Convite do sacerdote',
                    text: 'Irmãos:\nPara celebrarmos dignamente os santos mistérios,\n'
                        + 'reconheçamos que somos pecadores.\n\n'
                        + 'Ou, nos domingos:\n'
                        + 'Na celebração da vitória de Cristo sobre o pecado e a morte,\n'
                        + 'em que somos convidados a morrer para o pecado\n'
                        + 'e a ressurgir para uma vida nova,\n'
                        + 'invoquemos a misericórdia do Pai,\nporque somos pecadores.',
                },
                lines: [
                    {
                        who: 'todos',
                        text: 'Confesso a Deus todo-poderoso\ne a vós, irmãos,\nque pequei muitas vezes,\n'
                            + 'por pensamentos e palavras, atos e omissões,\n'
                            + 'por minha culpa, minha culpa, minha tão grande culpa.\n'
                            + 'E peço à Virgem Maria,\naos anjos e santos,\ne a vós, irmãos,\n'
                            + 'que rogueis por mim a Deus, nosso Senhor.',
                    },
                    {
                        who: 'sacerdote',
                        text: 'Deus todo-poderoso tenha compaixão de nós,\nperdoe os nossos pecados '
                            + 'e nos conduza à vida eterna.',
                    },
                    { who: 'todos', text: 'Amen.' },
                ],
            },
            {
                id: 'kyrie',
                title: 'Senhor, tende piedade',
                posture: 'pe',
                note: '«Kýrie, eléison»: o grito dos cegos e dos leprosos que no Evangelho param Jesus '
                    + 'no meio do caminho. O cego Bartimeu gritou-o à saída de Jericó; a multidão '
                    + 'mandou-o calar, ele gritou mais alto, e Jesus parou e perguntou-lhe: «Que '
                    + 'queres que Eu te faça?» Mesmo quando a Missa inteira era em latim, estas '
                    + 'palavras ficaram sempre em grego, porque algumas coisas se dizem melhor na '
                    + 'língua em que foram gritadas primeiro. Repetimos o que o sacerdote ou o cantor '
                    + 'disser.',
                lines: [
                    { who: 'sacerdote', text: 'Senhor, tende piedade de nós.' },
                    { who: 'todos', text: 'Senhor, tende piedade de nós.' },
                    { who: 'sacerdote', text: 'Cristo, tende piedade de nós.' },
                    { who: 'todos', text: 'Cristo, tende piedade de nós.' },
                    { who: 'sacerdote', text: 'Senhor, tende piedade de nós.' },
                    { who: 'todos', text: 'Senhor, tende piedade de nós.' },
                    // The missal offers the Greek original as an "Ou"
                    // alternative, printed with these accents. One six-line
                    // form, so the later calls continue it rather than each
                    // opening an alternative of its own.
                    { who: 'sacerdote', variant: true, text: 'Kýrie, eléison.' },
                    { who: 'todos', variant: true, text: 'Kýrie, eléison.' },
                    { who: 'sacerdote', variant: true, continues: true, text: 'Christe, eléison.' },
                    { who: 'todos', variant: true, text: 'Christe, eléison.' },
                    { who: 'sacerdote', variant: true, continues: true, text: 'Kýrie, eléison.' },
                    { who: 'todos', variant: true, text: 'Kýrie, eléison.' },
                ],
            },
            {
                id: 'gloria',
                title: 'Glória',
                posture: 'pe',
                onlyIf: 'gloria',
                note: 'Depois de pedirmos, louvamos. A primeira frase é o cântico dos anjos na noite de '
                    + 'Belém, e o resto é quase todo feito de nomes: Senhor Deus, Rei dos céus, '
                    + 'Cordeiro de Deus, Filho unigénito, o Santo, o Altíssimo. Quem ama alguém gosta '
                    + 'de lhe dizer os nomes devagarinho. Reserva-se para os domingos (fora do Advento e da '
                    + 'Quaresma), solenidades e festas.',
                lines: [
                    {
                        who: 'todos',
                        text: 'Glória a Deus nas alturas\ne paz na terra aos homens por Ele amados.\n'
                            + 'Senhor Deus, Rei dos céus, Deus Pai todo-poderoso:\n'
                            + 'nós Vos louvamos,\nnós Vos bendizemos,\nnós Vos adoramos,\nnós Vos glorificamos,\n'
                            + 'nós Vos damos graças, por vossa imensa glória.\n'
                            + 'Senhor Jesus Cristo, Filho unigénito,\n'
                            + 'Senhor Deus, Cordeiro de Deus, Filho de Deus Pai:\n'
                            + 'Vós que tirais o pecado do mundo, tende piedade de nós;\n'
                            + 'Vós que tirais o pecado do mundo, acolhei a nossa súplica;\n'
                            + 'Vós que estais à direita do Pai, tende piedade de nós.\n'
                            + 'Só Vós sois o Santo; só Vós, o Senhor;\nsó Vós, o Altíssimo, Jesus Cristo,\n'
                            + 'com o Espírito Santo, na glória de Deus Pai. Amen.',
                    },
                ],
            },
            {
                id: 'coleta',
                title: 'Oração Coleta',
                posture: 'pe',
                note: '«Oremos», e o silêncio que se segue é o espaço mais pessoal da Missa até aqui: '
                    + 'cada um diz a Cristo, por dentro, aquilo que só ele traz. A oração do sacerdote '
                    + 'recolhe depois esses segredos todos num pedido único, e daí o nome. O «Amen» '
                    + 'entrega-o, e nada do que ali pusemos se perde pelo caminho.',
                proper: 'coleta',
                properCollapsed: 'Ver a oração',
                after: [{ who: 'todos', text: 'Amen.' }],
            },
        ],
    },
    {
        id: 'liturgia-da-palavra',
        title: 'Liturgia da Palavra',
        intro: 'Até aqui falámos nós, agora fala Ele. Quando as leituras são proclamadas, não se '
            + 'recorda a história de um ausente, é Cristo vivo a dirigir-se à assembleia, e '
            + 'dentro dela a cada um. Foi o que aconteceu aos dois discípulos de Emaús, que iam embora '
            + 'desiludidos quando Ele Se pôs a caminhar ao lado deles e a abria as '
            + 'Escrituras: «Não nos ardia o coração?», deram-se conta depois. A mesma frase, '
            + 'ouvida por duzentos, tem maneira de acertar em cada um no sítio certo. Palavra e '
            + 'Eucaristia são duas mesas de uma só refeição, e é a esta que nos sentamos '
            + 'primeiro.',
        parts: [
            // Each reading is rendered with its own response attached, rather
            // than one block of Scripture followed by the acclamations — at
            // Mass the response comes after each reading, and that is what a
            // newcomer needs to see.
            { id: 'leituras', title: 'Leituras', readings: true },
            {
                id: 'homilia',
                title: 'Homilia',
                posture: 'sentado',
                note: 'Um homem fala, mas a conversa continua a ser a mesma. O que Cristo disse há vinte '
                    + 'séculos vem agora à procura da nossa semana, dos nossos nomes, desta cidade. A '
                    + 'palavra decisiva de uma homilia é «hoje». Sentamo-nos e escutamos.',
            },
            {
                id: 'credo',
                title: 'Profissão de Fé',
                posture: 'pe',
                toc: true,
                onlyIf: 'credo',
                note: 'Um dia Jesus fez aos amigos a pergunta que continua a fazer a toda a gente: «E '
                    + 'vós, quem dizeis que Eu sou?» O Credo é a resposta, dada de pé e por inteiro. '
                    + 'Chamou-se-lhe «símbolo», que era um objecto partido em dois: juntavam-se as '
                    + 'metades para provar quem se era. Esta é a nossa metade, recebida e não '
                    + 'inventada, e «creio» está no singular porque a pergunta é feita a cada um. '
                    + 'Diz-se aos domingos e nas solenidades. Às palavras «E encarnou… e Se fez homem» '
                    + 'inclinamo-nos, porque é aí que Deus entra na nossa carne: fez-Se o que nós '
                    + 'somos, escreveu santo Ireneu já no século II, para que pudéssemos ser o que '
                    + 'Ele é.',
                lines: [
                    {
                        who: 'todos',
                        text: 'Creio em um só Deus,\nPai todo-poderoso, Criador do céu e da terra,\n'
                            + 'de todas as coisas visíveis e invisíveis.\n'
                            + 'Creio em um só Senhor, Jesus Cristo,\nFilho unigénito de Deus,\n'
                            + 'nascido do Pai antes de todos os séculos:\n'
                            + 'Deus de Deus, luz da luz,\nDeus verdadeiro de Deus verdadeiro;\n'
                            + 'gerado, não criado, consubstancial ao Pai.\n'
                            + 'Por Ele todas as coisas foram feitas.\n'
                            + 'E por nós, homens, e para nossa salvação desceu dos céus.\n'
                            + 'E encarnou pelo Espírito Santo, no seio da Virgem Maria,\ne Se fez homem.\n'
                            + 'Também por nós foi crucificado sob Pôncio Pilatos;\npadeceu e foi sepultado.\n'
                            + 'Ressuscitou ao terceiro dia, conforme as Escrituras;\n'
                            + 'e subiu aos céus, onde está sentado à direita do Pai.\n'
                            + 'De novo há de vir em sua glória,\npara julgar os vivos e os mortos;\n'
                            + 'e o seu reino não terá fim.\n'
                            + 'Creio no Espírito Santo, Senhor que dá a vida,\ne procede do Pai e do Filho;\n'
                            + 'e com o Pai e o Filho é adorado e glorificado:\nEle que falou pelos profetas.\n'
                            + 'Creio na Igreja una, santa, católica e apostólica.\n'
                            + 'Professo um só batismo para remissão dos pecados.\n'
                            + 'E espero a ressurreição dos mortos,\ne a vida do mundo que há de vir. Amen.',
                    },
                ],
            },
            {
                id: 'oracao-universal',
                title: 'Oração Universal',
                posture: 'pe',
                note: 'Chamam-lhe «oração dos fiéis» porque é aqui que a assembleia exerce o sacerdócio '
                    + 'que recebeu no baptismo: quem está com Cristo traz-Lhe as suas pessoas, que é o '
                    + 'que os amigos fazem. A oração alarga-se por círculos, a Igreja, quem governa, '
                    + 'quem sofre, a nossa comunidade, e dentro deles cabem os nomes que cada um segura '
                    + 'por dentro. A resposta não é fixa; o celebrante anuncia qual é.',
            },
        ],
    },
    {
        id: 'liturgia-eucaristica',
        title: 'Liturgia Eucarística',
        intro: 'Na véspera de morrer, Jesus não deixou um livro nem um monumento: deixou uma '
            + 'refeição, para poder ficar. «Desejei ardentemente comer esta Páscoa convosco», '
            + 'disse nessa noite, e o desejo era d\'Ele antes de ser nosso. «Fazei isto em '
            + 'memória de Mim»: este memorial torna-o presente. A entrega '
            + 'da cruz atravessa o tempo inteiro e chega intacta a este altar. E a Igreja '
            + 'acredita à letra no que aqui se dá: o pão e o vinho tornam-se realmente o Corpo e '
            + 'o Sangue de Cristo. Se não for verdade, nada disto interessa; se for verdade, não '
            + 'há nesta semana nada mais importante do que o que se segue, o mais perto que Ele '
            + 'consegue estar de alguém neste mundo.',
        parts: [
            {
                id: 'apresentacao-dons',
                title: 'Apresentação dos Dons',
                posture: 'sentado',
                note: 'Pão e vinho: o que a terra deu e as nossas mãos fizeram. Cristo não quer entrar '
                    + 'sozinho no sacrifício, pede um pedaço da nossa vida para o unir ao seu: a semana '
                    + 'como ela foi, o trabalho, o que correu bem e correu mal. Ao vinho o sacerdote junta uma gota '
                    + 'de água, rezando em voz baixa para que sejamos participantes da divindade de '
                    + 'quem Se fez participante da nossa humanidade. Aquela gota somos nós, e o que Lhe '
                    + 'entregamos não volta igual. O peditório é parte do mesmo gesto. No fim, '
                    + 'levantamo-nos para responder ao convite «Orai, irmãos».',
                celebrant: {
                    label: 'Bênção do pão e do vinho',
                    text: 'Bendito sejais, Senhor, Deus do universo,\n'
                        + 'pelo pão que recebemos da vossa bondade,\n'
                        + 'fruto da terra e do trabalho do homem,\n'
                        + 'que hoje Vos apresentamos\n'
                        + 'e que para nós se vai tornar pão da vida.\n\n'
                        + 'Bendito sejais, Senhor, Deus do universo,\n'
                        + 'pelo vinho que recebemos da vossa bondade,\n'
                        + 'fruto da videira e do trabalho do homem,\n'
                        + 'que hoje Vos apresentamos\n'
                        + 'e que para nós se vai tornar vinho da salvação.',
                },
                // "Orai, irmãos" closes this same part rather than standing as
                // its own step: it is the invitation over the gifts just
                // presented, not a separate moment of the celebration.
                lines: [
                    { who: 'todos', text: 'Bendito seja Deus para sempre.' },
                    {
                        who: 'sacerdote',
                        cue: 'pe',
                        text: 'Orai, irmãos, para que o meu e vosso sacrifício\nseja aceite por Deus Pai todo-poderoso.',
                    },
                    {
                        who: 'todos',
                        text: 'Receba o Senhor por tuas mãos este sacrifício,\npara glória do seu nome,\n'
                            + 'para nosso bem e de toda a santa Igreja.',
                    },
                ],
            },
            {
                id: 'oblatas',
                title: 'Oração sobre as Oblatas',
                posture: 'pe',
                note: 'O sacerdote pede que Ele aceite o que acabou de ser posto no altar. Deixou de '
                    + 'ser nosso, e é o melhor que lhe podia acontecer. Respondemos «Amen».',
                proper: 'oblatas',
                properCollapsed: 'Ver a oração',
                after: [{ who: 'todos', text: 'Amen.' }],
            },
            {
                id: 'prefacio',
                title: 'Prefácio',
                posture: 'pe',
                note: 'A palavra Eucaristia quer dizer acção de graças, e é aqui que ela começa. '
                    + '«Corações ao alto» não é enfeite: é o pedido para largarmos, por uns minutos, '
                    + 'tudo o que trazemos na cabeça. São Pier Giorgio Frassati, '
                    + 'escreveu o mesmo numa fotografia da sua última escalada, aos 24 anos: «verso '
                    + 'l\'alto», para o alto. O texto muda conforme o dia ou o tempo litúrgico.',
                lines: [
                    { who: 'sacerdote', text: 'O Senhor esteja convosco.' },
                    { who: 'todos', text: 'Ele está no meio de nós.' },
                    { who: 'sacerdote', text: 'Corações ao alto.' },
                    { who: 'todos', text: 'O nosso coração está em Deus.' },
                    { who: 'sacerdote', text: 'Dêmos graças ao Senhor nosso Deus.' },
                    { who: 'todos', text: 'É nosso dever, é nossa salvação.' },
                ],
            },
            {
                id: 'santo',
                title: 'Santo',
                posture: 'pe',
                note: 'As palavras não são nossas: metade é de Isaías, que as ouviu aos anjos, metade da '
                    + 'multidão que recebeu Jesus à entrada de Jerusalém. Juntamos a voz a um louvor '
                    + 'que no céu nunca parou, com a mesma letra dos dois lados: João Paulo II chamou '
                    + 'à Eucaristia «um pedaço de céu que se abre sobre a terra». Repare-se na última '
                    + 'linha: «Bendito O que vem em nome do Senhor.» Vem mesmo.',
                lines: [
                    {
                        who: 'todos',
                        text: 'Santo, Santo, Santo,\nSenhor Deus do Universo.\n'
                            + 'O céu e a terra proclamam a vossa glória.\nHossana nas alturas.\n'
                            + 'Bendito O que vem em nome do Senhor.\nHossana nas alturas.',
                    },
                ],
            },
            {
                id: 'oracao-eucaristica',
                title: 'Oração Eucarística',
                posture: 'joelhos-ou-pe',
                note: 'O centro de tudo: Padre Pio dizia que era mais fácil o mundo existir sem o sol '
                    + 'do que sem a Santa Missa. Quem preside, invisivelmente, é o próprio Cristo: o '
                    + 'sacerdote empresta-Lhe a voz e as mãos. Ajoelhamo-nos depois do Santo, que é a '
                    + 'postura de quem está muito perto de algo demasiado grande (em algumas igrejas '
                    + 'fica-se de pé; seguimos o que a assembleia fizer).',
                summary: 'O sacerdote dá graças ao Pai e estende as duas mãos sobre o pão e o vinho, '
                    + 'pedindo que o Espírito Santo desça sobre eles: chama-se epiclese, e vale a pena '
                    + 'estar atento ao gesto. Depois repete as palavras de Jesus na Última Ceia, eleva '
                    + 'a hóstia e o cálice, e reza pela Igreja, pelo Papa, pelo bispo, pelos vivos e '
                    + 'por quem já morreu. Não assistimos de fora a uma recordação: aquela Ceia '
                    + 'recebe-nos à mesa. Acompanhamos em silêncio. Há várias Orações Eucarísticas; '
                    + 'aqui fica a II, a mais usada nos dias comuns.',
                celebrant: {
                    label: 'Oração Eucarística II — até à consagração',
                    text: 'Vós, Senhor, sois verdadeiramente santo,\nsois a fonte de toda a santidade.\n'
                        + 'Santificai estes dons,\nderramando sobre eles o vosso Espírito,\n'
                        + 'de modo que se convertam, para nós,\n'
                        + 'no Corpo e Sangue de nosso Senhor Jesus Cristo.\n\n'
                        + 'Na hora em que Ele Se entregava,\npara voluntariamente sofrer a morte,\n'
                        + 'tomou o pão e, dando graças, partiu-o\ne deu-o aos seus discípulos, dizendo:\n'
                        + 'Tomai, todos, e comei:\nisto é o meu corpo,\nque será entregue por vós.\n\n'
                        + 'De igual modo, no fim da Ceia,\ntomou o cálice, de novo Vos deu graças\n'
                        + 'e deu-o aos seus discípulos, dizendo:\n'
                        + 'Tomai, todos, e bebei:\neste é o cálice do meu sangue,\n'
                        + 'o sangue da nova e eterna aliança,\nque será derramado por vós e por todos\n'
                        + 'para remissão dos pecados.\nFazei isto em memória de mim.',
                },
            },
            {
                // Its own part, not folded into the Eucharistic Prayer above:
                // this is the assembly's line, and it must not read as part of
                // the collapsed presidential text on either side of it.
                id: 'misterio-da-fe',
                title: 'Mistério da Fé',
                posture: 'joelhos-ou-pe',
                note: 'Repare-se a quem falamos: já não sobre Ele, mas com Ele. São as primeiras '
                    + 'palavras ditas à sua presença acabada de chegar, e trazem os três tempos juntos, '
                    + 'o que fez, o que vive e o que ainda há de vir. Há três fórmulas; a resposta '
                    + 'depende da que o celebrante usar.',
                lines: [
                    { who: 'sacerdote', text: 'Mistério da fé!' },
                    {
                        who: 'todos',
                        text: 'Anunciamos, Senhor, a vossa morte,\nproclamamos a vossa ressurreição.\nVinde, Senhor Jesus!',
                    },
                    { who: 'sacerdote', variant: true, text: 'Mistério admirável da nossa fé!' },
                    {
                        who: 'todos',
                        variant: true,
                        text: 'Quando comemos deste pão\ne bebemos deste cálice,\n'
                            + 'anunciamos, Senhor, a vossa morte,\nesperando a vossa vinda gloriosa.',
                    },
                    { who: 'sacerdote', variant: true, text: 'Mistério da fé para a salvação do mundo!' },
                    {
                        who: 'todos',
                        variant: true,
                        text: 'Glória a Vós, que morrestes na cruz\ne agora viveis para sempre.\n'
                            + 'Salvador do mundo, salvai-nos.\nVinde, Senhor Jesus!',
                    },
                ],
                // The rest of the Eucharistic Prayer follows the acclamation
                // and runs up to the doxology, so it belongs here rather than
                // under a part named for the doxology itself.
                celebrantAfter: {
                    label: 'Oração Eucarística II — depois da consagração',
                    text: 'Celebrando agora, Senhor,\no memorial da morte e ressurreição de vosso Filho,\n'
                        + 'nós Vos oferecemos o pão da vida e o cálice da salvação\n'
                        + 'e Vos damos graças, porque nos admitistes à vossa presença,\n'
                        + 'para Vos servir nestes santos mistérios.\n'
                        + 'Humildemente Vos suplicamos\nque, participando no Corpo e Sangue de Cristo,\n'
                        + 'sejamos reunidos, pelo Espírito Santo, num só corpo.\n\n'
                        + 'Lembrai-Vos, Senhor, da vossa Igreja,\ndispersa por toda a terra,\n'
                        + 'e tornai-a perfeita na caridade,\nem comunhão com o nosso papa N.,\n'
                        + 'o nosso bispo N.\ne todos os ministros sagrados.\n\n'
                        + 'Lembrai-Vos também dos (outros) nossos irmãos,\n'
                        + 'que adormeceram na esperança da ressurreição,\n'
                        + 'e de todos aqueles que na vossa misericórdia\npartiram deste mundo:\n'
                        + 'admiti-os na luz da vossa presença.\n'
                        + 'Tende misericórdia de nós, Senhor,\n'
                        + 'e dai-nos a graça de participar na vida eterna,\n'
                        + 'com a Virgem santa Maria, Mãe de Deus, são José, seu esposo,\n'
                        + 'os bem-aventurados apóstolos\ne todos os santos,\n'
                        + 'que, desde o princípio do mundo, viveram na vossa amizade,\n'
                        + 'para cantarmos os vossos louvores,\npor Jesus Cristo, vosso Filho.',
                },
            },
            {
                id: 'doxologia',
                title: 'Doxologia final',
                posture: 'pe',
                note: 'O sacerdote eleva a hóstia e o cálice: «Por Cristo, com Cristo, em Cristo», três '
                    + 'maneiras de dizer que já não há distância nenhuma. A este «Amen» chama-se o '
                    + 'Grande Amen: uma palavra só, e com ela assinamos tudo o que a Oração '
                    + 'Eucarística rezou em nosso nome. Nas antigas basílicas de Roma dizia-se que '
                    + 'ecoava como um trovão.',
                lines: [
                    {
                        who: 'sacerdote',
                        text: 'Por Cristo, com Cristo, em Cristo,\na Vós, Deus Pai todo-poderoso,\n'
                            + 'na unidade do Espírito Santo,\ntoda a honra e toda a glória\n'
                            + 'agora e para sempre.',
                    },
                    { who: 'todos', text: 'Amen.' },
                ],
            },
        ],
    },
    {
        id: 'ritos-da-comunhao',
        title: 'Ritos da Comunhão',
        intro: 'Tudo na Missa apontava para isto. Quando Jesus disse «a minha carne é verdadeira '
            + 'comida», muitos discípulos acharam a palavra dura demais e deixaram de caminhar com '
            + 'Ele. E Ele não a suavizou, não disse que era só uma metáfora: deixou-os ir, e aos '
            + 'Doze perguntou se também queriam partir. Pedro respondeu pelos que ficaram: para '
            + 'quem iríamos? «Só tu tens palavras de vida eterna.» Qualquer outro alimento se torna '
            + 'parte de quem o come; este inverte a lógica, quem O recebe que é '
            + 'transformado n\'Ele. O mesmo Pedro deixou mais tarde escrita a promessa inteira '
            + '(2 Pe 1, 4): somos chamados a tomar parte na natureza divina, e o que Ele é por '
            + 'natureza dá-no-lo por dom. Vem inteiro a cada pessoa, uma por uma, como se fosse '
            + 'a única.',
        parts: [
            {
                id: 'pai-nosso',
                title: 'Pai Nosso',
                posture: 'pe',
                note: 'Antes de O recebermos, rezamos com as palavras que Ele ensinou aos apóstolos: tratar Deus por '
                    + 'Pai era o modo de Jesus, e é esse que nos empresta. O convite di-lo à letra, '
                    + '«ousamos dizer», porque falar assim ao Deus do universo é um atrevimento que só '
                    + 'temos porque Ele no-lo deu. Aqui ninguém tem parte diferente: todos dizemos '
                    + 'exactamente as mesmas palavras. A seguir, o sacerdote '
                    + 'prolonga o último pedido numa oração chamada embolismo, e concluímos com a '
                    + 'aclamação. Costuma rezar-se de mãos juntas e, nalgumas comunidades, de mãos dadas.',
                lines: [
                    { who: 'sacerdote', text: 'Fiéis aos ensinamentos do Salvador, ousamos dizer:' },
                    {
                        who: 'todos',
                        text: 'Pai nosso, que estais nos céus,\nsantificado seja o vosso nome;\n'
                            + 'venha a nós o vosso reino;\nseja feita a vossa vontade,\nassim na terra como no céu.\n'
                            + 'O pão nosso de cada dia nos dai hoje;\nperdoai-nos as nossas ofensas,\n'
                            + 'assim como nós perdoamos a quem nos tem ofendido;\n'
                            + 'e não nos deixeis cair em tentação,\nmas livrai-nos do mal.',
                    },
                ],
                // The embolism comes between the Our Father and the assembly's
                // acclamation, so it renders after the lines and before `after`.
                celebrantAfter: {
                    label: 'Embolismo',
                    text: 'Livrai-nos de todo o mal, Senhor,\ne dai ao mundo a paz em nossos dias,\n'
                        + 'para que, ajudados pela vossa misericórdia,\n'
                        + 'sejamos sempre livres do pecado e de toda a perturbação,\n'
                        + 'enquanto esperamos a vinda gloriosa\nde Jesus Cristo nosso Salvador.',
                },
                after: [
                    { who: 'todos', text: 'Vosso é o reino e o poder\ne a glória para sempre.' },
                ],
            },
            {
                id: 'rito-da-paz',
                title: 'Rito da Paz',
                posture: 'pe',
                note: 'A paz pede-se primeiro a Ele, que a dá como mais ninguém a dá, e só depois se '
                    + 'passa adiante: recebe-se do altar e entrega-se ao vizinho. Saudamos quem está '
                    + 'mais perto, com um aperto de mão ou uma inclinação de cabeça, e com sobriedade: '
                    + 'é um gesto d\'Ele em trânsito, não um intervalo.',
                celebrant: {
                    label: 'Oração pela paz',
                    text: 'Senhor Jesus Cristo, que dissestes aos vossos apóstolos:\n'
                        + 'Deixo-vos a paz, dou-vos a minha paz:\n'
                        + 'não olheis aos nossos pecados, mas à fé da vossa Igreja,\n'
                        + 'e dai-lhe a união e a paz, segundo a vossa vontade,\n'
                        + 'Vós que viveis e reinais pelos séculos dos séculos.',
                },
                lines: [
                    { who: 'sacerdote', text: 'A paz do Senhor esteja sempre convosco.' },
                    { who: 'todos', text: 'O amor de Cristo nos uniu.' },
                    { who: 'celebrante', text: 'Saudai-vos na paz de Cristo.' },
                ],
            },
            {
                id: 'cordeiro-de-deus',
                title: 'Cordeiro de Deus',
                posture: 'pe',
                note: 'Canta-se enquanto o sacerdote parte o pão. «Cordeiro de Deus» foi como João '
                    + 'Baptista O anunciou ao vê-Lo aproximar-se: é Ele que tira o pecado do mundo, não '
                    + 'somos nós que o merecemos. E parte-se para poder chegar a todos, com o efeito '
                    + 'contrário da divisão, porque comer do mesmo pão é o que faz de muitos um só '
                    + 'corpo. Pede-se piedade duas vezes, e paz à terceira.',
                lines: [
                    {
                        who: 'todos',
                        text: 'Cordeiro de Deus, que tirais o pecado do mundo,\ntende piedade de nós.\n'
                            + 'Cordeiro de Deus, que tirais o pecado do mundo,\ntende piedade de nós.\n'
                            + 'Cordeiro de Deus, que tirais o pecado do mundo,\ndai-nos a paz.',
                    },
                ],
            },
            {
                id: 'convite-a-comunhao',
                title: 'Convite à Comunhão',
                posture: 'joelhos-ou-pe',
                note: 'O sacerdote ergue a hóstia e mostra-a: «Eis o Cordeiro de Deus.» Por um instante '
                    + 'é frente a frente, Ele mostrado a cada um. Os olhos vêem pão, e é da palavra '
                    + 'd\'Ele que nos fiamos. Ao medo de O deixar entrar respondeu Bento XVI: quem '
                    + 'deixa entrar Cristo não perde «absolutamente nada daquilo que torna a vida '
                    + 'livre, bela e grande». A resposta que damos não é de um santo: é de um '
                    + 'centurião romano, estrangeiro e pagão, que se achou indigno de receber Jesus em '
                    + 'casa, e foi dele que Jesus disse não ter encontrado fé igual em Israel.',
                lines: [
                    {
                        who: 'sacerdote',
                        text: 'Felizes os convidados para a Ceia do Senhor.\n'
                            + 'Eis o Cordeiro de Deus, que tira o pecado do mundo.',
                    },
                    {
                        who: 'todos',
                        text: 'Senhor, eu não sou digno de que entreis em minha morada,\n'
                            + 'mas dizei uma palavra e serei salvo.',
                    },
                ],
            },
            {
                id: 'comunhao',
                title: 'Comunhão',
                posture: 'fila',
                note: 'Vamos em fila até ao altar, como cristãos fazem desde o ano 155, que é a data do '
                    + 'primeiro relato escrito de uma Missa. São Carlo Acutis '
                    + 'chamava a isto de «a minha auto-estrada para o Céu». E '
                    + 'ninguém vai na fila por ser perfeito: a Eucaristia, escreveu o Papa Francisco, '
                    + '«não é um prémio para os perfeitos, mas um remédio generoso e um alimento para '
                    + 'os fracos». No fim da fila está Ele, que sabe o nome de cada um que se '
                    + 'aproxima. Quando nos apresentarem a hóstia, respondemos «Amen», e esse «Amen» '
                    + 'quer dizer «creio que é Ele». Recebemo-la na mão ou na boca. Quem não vai '
                    + 'comungar pode ficar no lugar ou aproximar-se com os braços cruzados sobre o '
                    + 'peito para receber uma bênção. Quem tem consciência de pecado grave '
                    + 'confessa-se antes.',
                lines: [
                    { who: 'ministro', text: 'O Corpo de Cristo.' },
                    { who: 'comungante', text: 'Amen.' },
                    { who: 'ministro', variant: true, text: 'Corpus Christi.' },
                    { who: 'comungante', variant: true, text: 'Amen.' },
                ],
                proper: 'comunhao',
                properCollapsed: 'Antífona da comunhão',
            },
            {
                id: 'pos-comunhao',
                title: 'Oração depois da Comunhão',
                posture: 'pe',
                note: 'Guarda-se silêncio, e para muita gente é a melhor parte da Missa: Deus acabou '
                    + 'de entrar em nós e não há nada a dizer. Santa Teresinha escreveu que Jesus não '
                    + 'desce do céu para ficar numa pixide de ouro, mas para encontrar outro céu: a '
                    + 'nossa alma. O silêncio não é vazio, é o Espírito a trabalhar. Depois o sacerdote '
                    + 'reza a oração que fecha a comunhão.',
                proper: 'poscomunhao',
                properCollapsed: 'Ver a oração',
                after: [{ who: 'todos', text: 'Amen.' }],
            },
        ],
    },
    {
        id: 'ritos-de-conclusao',
        title: 'Ritos de Conclusão',
        intro: '«Ide» é uma ordem, não uma despedida educada, e é deste envio que a palavra Missa '
            + 'vem. Mas repare-se no que vem agarrado à ordem: «Eu estarei convosco todos os '
            + 'dias, até ao fim dos tempos.» O encontro não fica neste edifício, muda de forma e vai '
            + 'connosco: saímos com vida divina dentro, para a gastar em coisas muito humanas. '
            + '«Ele vive e quer-te vivo», escreveu o Papa Francisco aos jovens, e a semana '
            + 'inteira passa a ser o sítio onde Ele continua a conversa.',
        parts: [
            {
                id: 'bencao',
                title: 'Bênção',
                posture: 'pe',
                note: 'Ninguém sai daqui de mãos vazias. Fazemos o sinal da cruz enquanto o sacerdote '
                    + 'abençoa, o mesmo gesto com que começámos, e o círculo fecha-se: abençoar é pôr o '
                    + 'nome de Deus sobre alguém, e é debaixo desse nome que saímos. Em certos dias '
                    + 'usa-se uma bênção solene, com três respostas «Amen».',
                lines: [
                    { who: 'sacerdote', text: 'O Senhor esteja convosco.' },
                    { who: 'todos', text: 'Ele está no meio de nós.' },
                    { who: 'sacerdote', text: 'Abençoe-vos Deus todo-poderoso,\nPai, Filho e Espírito Santo.' },
                    { who: 'todos', text: 'Amen.' },
                ],
            },
            {
                id: 'despedida',
                title: 'Despedida',
                posture: 'pe',
                note: 'A Missa acaba e o resto começa. Quando o império romano proibiu as assembleias '
                    + 'cristãs, os mártires de Abitina preferiram morrer a deixar isto, e disseram aos '
                    + 'juízes porquê: «não podemos viver sem a ceia do Senhor». Há cinco fórmulas e a '
                    + 'resposta é sempre a mesma.',
                // The response is the same whichever form is used, so it comes
                // once at the end rather than after the first and nowhere else.
                lines: [
                    { who: 'celebrante', text: 'Ide em paz e o Senhor vos acompanhe.' },
                    {
                        who: 'celebrante',
                        variant: true,
                        text: 'Anunciai o Evangelho do Senhor.\nIde em paz e o Senhor vos acompanhe.',
                    },
                    {
                        who: 'celebrante',
                        variant: true,
                        text: 'Glorificai a Deus com a vossa vida.\nIde em paz e o Senhor vos acompanhe.',
                    },
                    {
                        who: 'celebrante',
                        variant: true,
                        text: 'A alegria do Senhor seja a vossa força.\nIde em paz e o Senhor vos acompanhe.',
                    },
                    {
                        who: 'celebrante',
                        variant: true,
                        when: 'no Tempo Pascal',
                        text: 'Levai a todos a alegria do Senhor ressuscitado. Aleluia.\n'
                            + 'Ide em paz e o Senhor vos acompanhe.',
                    },
                    { who: 'todos', text: 'Graças a Deus.' },
                ],
            },
        ],
    },
];

// ------------------------------------------------------- proper extraction

/**
 * The API returns a flat run of `<p>` (plus the occasional `<h1>`), each either
 * opening a labelled block or continuing the previous one. Labels are marked up
 * inconsistently — `<strong>`, `<b>`, or nothing at all — so blocks are
 * classified by their leading text rather than by their markup.
 */
function splitBlocks(html: string): string[] {
    return html.match(/<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
}

/** The block's leading visible text, with tags and entities flattened away. */
function leadingText(block: string): string {
    return block
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const SLOT_LABELS: Array<[ProperSlot, RegExp]> = [
    ['entrada', /^Antífona de entrada\b/i],
    ['coleta', /^Oração coleta\b/i],
    ['oblatas', /^Oração sobre as oblatas\b/i],
    ['comunhao', /^Antífona da comunhão\b/i],
    ['poscomunhao', /^Oração depois da comunhão\b/i],
];

/** Labelled blocks we recognise but never render — they only end a run. */
const IGNORED_LABEL_RE = /^(Prefácio|Diz-se\b|Pode utilizar-se\b|Ou:\s*Prefácio|Missa\b)/i;

/** The text of a heading that opens a Mass ("Missa do dia", "Missa da noite").
    Only ever tested against heading blocks: a paragraph starting "Missa" is a
    rubric, and closes the run through IGNORED_LABEL_RE without ending the
    extraction. A second Mass introduced without a heading is caught instead by
    its repeated proper labels. */
const MASS_HEADING_RE = /^Missa\b/i;

/**
 * Removes the label from the first block of a proper, since the guided layout
 * prints its own heading for the part. The scripture reference that follows an
 * antiphon's label is kept — it belongs to the text.
 */
function stripLabel(block: string, label: RegExp): string {
    // As its own element: <p><strong>Oração coleta</strong><br />…
    const wrapped = block.replace(
        /^(<(?:p|h[1-6])\b[^>]*>\s*)<(strong|b)>\s*([^<]*?)\s*<\/\2>\s*(?:<br\s*\/?>\s*)?/i,
        (whole, open: string, _tag: string, text: string) => (label.test(text.trim()) ? open : whole),
    );
    if (wrapped !== block) return wrapped;

    // Bare, as seen on some days: <p>Oração sobre as oblatas<br />…
    return block.replace(
        /^(<(?:p|h[1-6])\b[^>]*>\s*)([^<]+?)(\s*<br\s*\/?>\s*)/i,
        (whole, open: string, text: string) => (label.test(text.trim()) ? open : whole),
    );
}

/** What sort of reading a block opens — each is followed by its own response. */
type ReadingKind = 'leitura' | 'salmo' | 'sequencia' | 'aleluia' | 'evangelho';

// Case-sensitive on purpose: a reading's header is ALL-CAPS ("LEITURA I",
// "EVANGELHO"), while its body opens with a mixed-case attribution of the same
// words ("Leitura do Livro de Isaías", "Evangelho de Nosso Senhor Jesus
// Cristo…"). Matching loosely would split every reading in two.
const READING_KINDS: Array<[ReadingKind, RegExp]> = [
    ['leitura', /^LEITURA\s+[IVX]+\b/],
    ['salmo', /^SALMO\s+RESPONSORIAL\b/],
    ['sequencia', /^SEQUÊNCIA\b/],
    ['aleluia', /^(ALELUIA|ACLAMAÇÃO)\b/],
    ['evangelho', /^EVANGELHO\b/],
];

export interface ReadingSegment {
    kind: ReadingKind;
    /** The labelled block, kept verbatim: the reading typography and the table
        of contents both key off its `<strong>LEITURA I</strong>` header. */
    header: string;
    /** Everything under that header — the text, and any commentary. */
    body: string;
}

export interface MassTexts {
    slots: Partial<Record<ProperSlot, string>>;
    readings: ReadingSegment[];
}

/**
 * Pulls the day's changing texts out of the Mass HTML: the propers keyed by
 * slot, and the readings split one per segment so each can carry its own
 * response.
 */
export function extractMassTexts(html: string): MassTexts {
    const slots: Partial<Record<ProperSlot, string>> = {};
    const readings: ReadingSegment[] = [];
    if (!html) return { slots, readings };

    // What unlabelled continuation blocks currently attach to. Null once a
    // block we don't render (a rubric, the preface) has closed the last run.
    let current: ProperSlot | 'reading' | null = null;
    // One text can hold several Masses of the same day — a solemnity carries
    // a vigil and a day Mass, each under its own <h1>. The guided layout
    // renders one celebration, so extraction ends where the second Mass
    // begins: at a Mass heading once anything has been taken (a heading
    // *before* any content is the first Mass's own title), or at a repeated
    // proper label when no heading separates them.
    let took = false;

    for (const block of splitBlocks(html)) {
        const lead = leadingText(block);
        if (!lead) continue;

        if (/^<h[1-6]/i.test(block)) {
            // Only a heading that names a Mass opens a new celebration. Any
            // other heading is a division inside this one, and merely closes
            // the open run — stopping there would drop the readings and
            // propers that follow it.
            if (MASS_HEADING_RE.test(lead) && took) break;
            current = null;
            continue;
        }

        const kind = READING_KINDS.find(([, re]) => re.test(lead));
        if (kind) {
            took = true;
            current = 'reading';
            readings.push({ kind: kind[0], header: block, body: '' });
            continue;
        }

        const slot = SLOT_LABELS.find(([, re]) => re.test(lead));
        if (slot) {
            const [name, re] = slot;
            // The second Mass starting over (its entrance antiphon after the
            // first one's post-communion) in a payload without headings.
            if (slots[name] !== undefined) break;
            took = true;
            current = name;
            slots[name] = stripLabel(block, re);
            continue;
        }

        if (IGNORED_LABEL_RE.test(lead)) {
            current = null;
            continue;
        }

        // Unlabelled: a continuation of whatever run is open.
        if (current === 'reading') readings[readings.length - 1].body += block;
        else if (current) slots[current] = (slots[current] ?? '') + block;
    }

    return { slots, readings };
}

// ------------------------------------------------------------- HTML output

// Quotes are escaped too: this output is interpolated into attribute values
// (data-toc-label), where an unescaped quote would end the attribute early.
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Verse lines survive as <br>; the text itself is escaped. */
function renderText(text: string): string {
    return text.split('\n').map(escapeHtml).join('<br />');
}

/**
 * @param opensVariant marks the first line of an alternative form. A variant
 *   is usually a call and its response, and tagging both would read as two
 *   separate alternatives rather than one.
 */
function renderLine(line: Line, opensVariant = false): string {
    const classes = ['mass-line', `mass-line-${line.who}`];
    if (line.who === 'todos') classes.push('mass-line-response');
    if (line.variant) classes.push('mass-line-variant');
    return `<p class="${classes.join(' ')}">`
        + (opensVariant
            ? `<span class="mass-variant-tag">${escapeHtml(line.when ? `Ou, ${line.when}` : 'Ou')}</span>`
            : '')
        + `<span class="mass-who">${escapeHtml(SPEAKER_LABELS[line.who])}</span>`
        + `<span class="mass-said">${renderText(line.text)}</span>`
        + '</p>';
}

/** Speakers who answer rather than call — their line closes an exchange. */
const RESPONDERS = new Set<Speaker>(['todos', 'comungante']);

/**
 * A run of invocations the assembly repeats back word for word, printed once
 * each instead of twice. The Kyrie is six such exchanges in a row, and set out
 * as call and answer it printed the same twelve lines and filled a screen with
 * one short litany. Nothing is lost by folding them: the label says the
 * assembly repeats, which is what the six pairs were there to show.
 */
interface Echo {
    who: Speaker;
    texts: string[];
    variant?: boolean;
    when?: string;
    continues?: boolean;
    cue?: Posture;
}

type Block = { line: Line } | { echo: Echo };

const blockLine = (b: Block): Line | Echo => ('line' in b ? b.line : b.echo);
/** Who spoke last in this block — an echo ends with the assembly repeating. */
const blockClosedBy = (b: Block): Speaker => ('line' in b ? b.line.who : 'todos');

/** Same words, whatever the spacing of the source string. */
const sameWords = (a: string, b: string) =>
    a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

/**
 * Folds each call answered by its own words into one block, and merges
 * consecutive ones by the same speaker so a litany reads as a list rather than
 * as three labelled pairs. A `when` starts a new block: it tags an alternative
 * of its own.
 */
function foldEchoes(lines: Line[]): Block[] {
    const blocks: Block[] = [];
    for (let i = 0; i < lines.length; i++) {
        const call = lines[i];
        const answer = lines[i + 1];
        const echoes = answer && !RESPONDERS.has(call.who) && RESPONDERS.has(answer.who)
            && sameWords(call.text, answer.text);
        if (!echoes) {
            blocks.push({ line: call });
            continue;
        }

        const last = blocks[blocks.length - 1];
        const into = last && 'echo' in last ? last.echo : undefined;
        if (into && into.who === call.who && !!into.variant === !!call.variant
            && !call.when && !call.cue) {
            into.texts.push(call.text);
        } else {
            const { who, variant, when, continues, cue } = call;
            blocks.push({ echo: { who, variant, when, continues, cue, texts: [call.text] } });
        }
        i++; // the answer is folded into the call
    }
    return blocks;
}

function renderEcho(echo: Echo, opensVariant: boolean): string {
    const classes = ['mass-line', `mass-line-${echo.who}`, 'mass-line-response', 'mass-line-echo'];
    if (echo.variant) classes.push('mass-line-variant');
    return `<p class="${classes.join(' ')}">`
        + (opensVariant
            ? `<span class="mass-variant-tag">${escapeHtml(echo.when ? `Ou, ${echo.when}` : 'Ou')}</span>`
            : '')
        + `<span class="mass-who">${escapeHtml(`${SPEAKER_LABELS[echo.who]}, e todos repetem`)}</span>`
        + echo.texts.map((text) => `<span class="mass-said">${renderText(text)}</span>`).join('')
        + '</p>';
}

/**
 * Tags the first line of each alternative, so that several listed in a row
 * read as separate choices rather than one long one. A new alternative starts
 * when the previous line was not a variant, when it closed the previous
 * alternative with its answer, or when it was another call by the same
 * speaker — a call cannot follow a call within one alternative.
 */
function renderLines(lines: Line[]): string {
    const blocks = foldEchoes(lines);
    return blocks
        .map((block, i) => {
            const it = blockLine(block);
            const prev = blocks[i - 1] ? blockLine(blocks[i - 1]) : undefined;
            const opens = !!it.variant && !it.continues
                && (!prev?.variant
                    || RESPONDERS.has(blockClosedBy(blocks[i - 1]))
                    || prev.who === it.who);
            const cue = it.cue ? `<p class="mass-cue">${renderPosture(it.cue)}</p>` : '';
            return cue + ('line' in block ? renderLine(block.line, opens) : renderEcho(block.echo, opens));
        })
        .join('');
}

/**
 * Text present but folded away by default. Deliberately reuses the
 * `reading-commentary` markup the article already ships: Liturgy.tsx delegates
 * clicks on `.commentary-toggle`, so these toggle without any new wiring.
 */
function renderCollapsible(label: string, body: string, modifier: string): string {
    return `<div class="reading-commentary mass-collapse ${modifier} collapsed">`
        + '<button type="button" class="commentary-toggle" aria-expanded="false">'
        + '<span class="commentary-chevron" aria-hidden="true">▸</span>'
        + `<span>${escapeHtml(label)}</span>`
        + '</button>'
        + `<div class="commentary-body">${body}</div>`
        + '</div>';
}

/** A presidential prayer: stanzas separated by a blank line. */
function renderCelebrant(celebrant: Celebrant): string {
    const body = celebrant.text
        .split('\n\n')
        .map((stanza) => `<p>${renderText(stanza)}</p>`)
        .join('');
    return renderCollapsible(celebrant.label, body, 'mass-celebrant');
}

function renderPosture(posture: Posture): string {
    return `<span class="mass-posture mass-posture-${posture}">${escapeHtml(POSTURE_LABELS[posture])}</span>`;
}

/**
 * The button that opens a part's explanation, and the note it opens.
 *
 * The explanation is the reason this mode exists, but it is also the longest
 * thing on the page, and printed always-on it pushes the part's own words a
 * screenful down. Behind the button the walkthrough reads as a walkthrough —
 * title, posture, what to say — with the "why" one tap away. It opens in
 * place, pushing the page down rather than floating over it: this is a
 * paragraph, not a hint, and a panel hovering over the lines it explains
 * would cover exactly what the reader came for.
 *
 * `renderExplained` wraps the row that carries the button together with the
 * note, which is what the toggle opens. Both halves are plain markup with
 * standard attributes: this HTML goes through DOMPurify before it reaches the
 * page, and anything more exotic (`popover`, inline styles) would be stripped.
 * Liturgy.tsx opens them by delegation, as it does the collapsibles.
 */
function renderInfoButton(noteId: string, title: string): string {
    return '<button type="button" class="mass-info" aria-expanded="false"'
        + ` aria-controls="${escapeHtml(noteId)}"`
        + ` aria-label="${escapeHtml(`Explicação: ${title}`)}">`
        + '<span aria-hidden="true">i</span>'
        + '</button>';
}

function renderExplained(row: string, noteId: string, note: string): string {
    return '<div class="mass-explain">'
        + row
        + `<div class="mass-note" id="${escapeHtml(noteId)}" role="note">${escapeHtml(note)}</div>`
        + '</div>';
}

/**
 * How each kind of reading is framed. The API text already ends a reading with
 * the lector's "Palavra do Senhor." (the typography pass lifts it into its own
 * `.reading-ending` line), so only the assembly's answer has to be added —
 * with `ending` as a safety net for days where the aclamation is missing.
 */
const READING_FRAMES: Record<ReadingKind, {
    posture?: Posture;
    note?: string;
    /** Names the part on the info button, whose label is all a screen reader
        gets — the reading's own header is the API's markup, not ours. */
    label: string;
    /** Dialogue printed between the header and the text. */
    before?: Line[];
    /** Present in the API text on a normal day; supplied when it isn't. */
    ending?: { has: RegExp; line: Line };
    response?: Line;
}> = {
    leitura: {
        posture: 'sentado',
        label: 'Leitura',
        note: 'Sentamo-nos para escutar. Estas mesmas leituras são ouvidas hoje em todas as '
            + 'igrejas do mundo, na mesma ordem: nenhum algoritmo as escolheu a pensar em nós, '
            + 'e é isso que impede a Palavra de ser só aquilo que já pensávamos. No fim, o '
            + 'leitor aclama e respondemos.',
        ending: { has: /Palavra do Senhor/i, line: { who: 'leitor', text: 'Palavra do Senhor.' } },
        response: { who: 'todos', text: 'Graças a Deus.' },
    },
    salmo: {
        posture: 'sentado',
        label: 'Salmo responsorial',
        note: 'À leitura responde-se com um salmo, e há aqui uma intimidade escondida: os salmos '
            + 'foram as orações do próprio Jesus, aprendidas em criança e rezadas até à cruz. Ao '
            + 'repetirmos o refrão, é com as palavras d\'Ele na nossa boca que Lhe respondemos. O '
            + 'salmista canta ou reza os versículos; repetimos o refrão (℟) no início e entre as '
            + 'estrofes.',
    },
    sequencia: {
        posture: 'sentado',
        label: 'Sequência',
        note: 'Um hino antigo, próprio de alguns dias solenes, cantado antes do Aleluia.',
    },
    aleluia: {
        posture: 'pe',
        label: 'Aleluia',
        note: 'Levantamo-nos, que é como se recebe alguém que chega. «Aleluia» é hebraico e quer '
            + 'dizer «louvai o Senhor»: a aclamação saúda Cristo antes de O ouvirmos falar. Na '
            + 'Quaresma cala-se durante quarenta dias, e a falta que faz é intencional: usa-se '
            + 'outra aclamação.',
    },
    evangelho: {
        posture: 'pe',
        label: 'Evangelho',
        note: 'De pé: aqui é Ele em discurso directo. Por isso o livro leva escolta, luzes e às '
            + 'vezes incenso, e no fim o sacerdote beija-o, pedindo em voz baixa que estas '
            + 'palavras apaguem os nossos pecados. Ao anúncio, traçamos três cruzes pequenas, na '
            + 'testa, na boca e no peito: é um pedido de cada um, que Ele fique no que penso, no '
            + 'que digo e no que amo.',
        before: [
            { who: 'sacerdote', text: 'O Senhor esteja convosco.' },
            { who: 'todos', text: 'Ele está no meio de nós.' },
            // The announcement is filled in from the day's own text — see
            // announceGospel. This is the fallback if that can't be parsed.
            { who: 'sacerdote', text: 'Evangelho de nosso Senhor Jesus Cristo, segundo são N.' },
            { who: 'todos', text: 'Glória a Vós, Senhor.' },
        ],
        ending: { has: /Palavra da salvação/i, line: { who: 'sacerdote', text: 'Palavra da salvação.' } },
        response: { who: 'todos', text: 'Glória a Vós, Senhor.' },
    },
};

/** The attribution that opens the Gospel text, naming the evangelist. */
const GOSPEL_SOURCE_RE = /Evangelho de\s+(?:nosso|Nosso)\s+Senhor\s+Jesus\s+Cristo,?\s*segundo\s+(?:S(?:ão|\.)\s*)?([^<,.\n]+)/i;

/**
 * The celebrant names the day's evangelist ("…segundo são Lucas"), not a
 * placeholder — and the API text says which, in the attribution line that opens
 * the Gospel. Lift it into the announcement and drop it from the body, so the
 * same sentence isn't printed twice in a row.
 */
function announceGospel(body: string): { line: Line | null; body: string } {
    const match = body.match(GOSPEL_SOURCE_RE);
    if (!match) return { line: null, body };

    const evangelist = match[1].trim();
    // Strip only where it heads a paragraph — that is the attribution, not a
    // mention inside the text. Not anchored to the start of the body: a
    // commentary paragraph often comes first. Both regexes are non-global, so
    // only the first occurrence goes.
    //
    // Two shapes: the attribution can open the paragraph that also holds the
    // text, or stand alone in its own paragraph, in which case the whole
    // paragraph goes with it.
    const ALONE = /<p\b[^>]*>\s*Evangelho de\s+(?:nosso|Nosso)\s+Senhor\s+Jesus\s+Cristo,?\s*segundo[^<]*<\/p>\s*/i;
    const LEADING = /(<p\b[^>]*>\s*)Evangelho de\s+(?:nosso|Nosso)\s+Senhor\s+Jesus\s+Cristo,?\s*segundo[^<]*<br\s*\/?>\s*/i;
    const stripped = ALONE.test(body) ? body.replace(ALONE, '') : body.replace(LEADING, '$1');

    return {
        line: { who: 'sacerdote', text: `Evangelho de nosso Senhor Jesus Cristo, segundo são ${evangelist}.` },
        body: stripped,
    };
}

/**
 * One reading, with its response attached. The header keeps the API's markup so
 * the reading typography and the table of contents treat it exactly as they do
 * in the other two modes; the guided framing wraps around it.
 */
/** @param ordinal this segment's position among readings of its own kind. */
function renderReading(segment: ReadingSegment, ordinal: number): string {
    const frame = READING_FRAMES[segment.kind];

    let before = frame.before;
    let body = segment.body;
    if (segment.kind === 'evangelho' && before) {
        const announced = announceGospel(body);
        if (announced.line) {
            // Swap the "são N." placeholder for the day's own evangelist.
            before = before.map((l) => (l.text.startsWith('Evangelho de') ? announced.line! : l));
            body = announced.body;
        }
    }

    const id = `mass-${segment.kind}-${ordinal}`;
    let html = `<section class="mass-part mass-reading" id="${id}">`;

    // The framing goes above the header, not between it and the text. A
    // reading's header carries its reference and its theme in «», and the
    // psalm's refrain is lifted to just under it — anything inserted after it
    // cuts the reading off from its own opening.
    //
    // A reading has no title of ours to hang the info button on, so the cue
    // line carries it. Only the first reading of a kind is explained: on a
    // Sunday the second reading works exactly like the first, and a second
    // button opening the same words reads as padding.
    const note = ordinal === 1 ? frame.note : undefined;
    if (frame.posture || note) {
        const cue = '<p class="mass-cue">'
            + (frame.posture ? renderPosture(frame.posture) : '')
            + (note ? renderInfoButton(`${id}-nota`, frame.label) : '')
            + '</p>';
        html += note ? renderExplained(cue, `${id}-nota`, note) : cue;
    }

    // The Aleluia is a one-line acclamation, not somewhere anyone navigates to
    // — it only crowds the table of contents. Marked so the page skips it while
    // still giving it the reading typography.
    html += segment.kind === 'aleluia'
        ? segment.header.replace(/^<p\b/i, '<p data-toc-skip="1"')
        : segment.header;
    if (before) html += renderLines(before);
    html += body;
    // The acclamation closes the reading, after its text. The API usually
    // carries the celebrant's half already; only add it when it doesn't.
    if (frame.ending && !frame.ending.has.test(body)) html += renderLine(frame.ending.line);
    if (frame.response) html += renderLine(frame.response);

    return html + '</section>';
}

function renderPart(
    part: Part,
    slots: Partial<Record<ProperSlot, string>>,
    readings: ReadingSegment[],
): string {
    if (part.readings) {
        // Numbered within their kind, so the anchors read as mass-leitura-1,
        // mass-leitura-2, mass-evangelho-1 rather than by overall position.
        const seen = new Map<ReadingKind, number>();
        return readings.map((segment) => {
            const ordinal = (seen.get(segment.kind) ?? 0) + 1;
            seen.set(segment.kind, ordinal);
            return renderReading(segment, ordinal);
        }).join('');
    }

    const proper = part.proper ? slots[part.proper] : undefined;

    // A part that exists only to carry the day's text is dropped when the API
    // didn't supply it, rather than rendering an empty heading.
    if (part.proper && !proper && !part.lines && !part.summary) return '';

    // data-toc-label sits on the element that carries the id, since that is
    // what the page's table of contents queries and scrolls to.
    const toc = part.toc ? ` data-toc-label="${escapeHtml(part.title)}"` : '';
    let html = `<section class="mass-part" id="${part.id}"${toc}>`;

    // The info button goes beside the title but outside the heading itself:
    // inside it, the explanation would become part of the heading's own text
    // for a screen reader, and this page builds its table of contents from
    // headings.
    const noteId = `${part.id}-nota`;
    const header = '<h3 class="mass-part-header">'
        + '<span class="mass-part-title">'
        + `<span class="mass-part-name">${escapeHtml(part.title)}</span>`
        + (part.note ? renderInfoButton(noteId, part.title) : '')
        + '</span>'
        + (part.posture ? renderPosture(part.posture) : '')
        + '</h3>';
    html += part.note ? renderExplained(header, noteId, part.note) : header;

    if (part.summary) html += `<p class="mass-summary">${escapeHtml(part.summary)}</p>`;
    if (proper) {
        html += part.properCollapsed
            ? renderCollapsible(part.properCollapsed, proper, 'mass-collapsed-proper')
            : `<div class="mass-proper">${proper}</div>`;
    }
    if (part.celebrant) html += renderCelebrant(part.celebrant);
    if (part.lines) html += renderLines(part.lines);
    if (part.celebrantAfter) html += renderCelebrant(part.celebrantAfter);
    if (part.after) html += renderLines(part.after);

    return html + '</section>';
}

/**
 * Builds the guided Mass: the Ordinary's skeleton with the day's propers
 * threaded through it.
 *
 * @param html the Mass HTML from the API (may be empty — the skeleton still renders)
 * @param ordo whether this day's Mass has the Glória and the Credo
 */
export function buildGuidedMassHtml(html: string, ordo: MassOrdo): string {
    const { slots, readings } = extractMassTexts(html);

    return DIVISIONS.map((division) => {
        const parts = division.parts
            .filter((part) => !part.onlyIf || ordo[part.onlyIf])
            .map((part) => renderPart(part, slots, readings))
            .join('');

        return `<section class="mass-division">`
            + `<h2 class="mass-division-header" id="${division.id}" data-toc-label="${escapeHtml(division.title)}">`
            + escapeHtml(division.title)
            + '</h2>'
            + `<p class="mass-division-intro">${escapeHtml(division.intro)}</p>`
            + parts
            + '</section>';
    }).join('');
}
