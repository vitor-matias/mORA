import type { Chaplet } from './types';

const PAI_NOSSO = {
    title: 'Pai Nosso',
    text: `Pai nosso, que estais nos céus,
santificado seja o vosso nome,
venha a nós o vosso reino,
seja feita a vossa vontade
assim na terra como no céu.
O pão nosso de cada dia nos dai hoje,
perdoai-nos as nossas ofensas,
assim como nós perdoamos a quem nos tem ofendido,
e não nos deixeis cair em tentação,
mas livrai-nos do mal.
Amen.`,
};

const AVE_MARIA = {
    title: 'Avé Maria',
    text: `Avé Maria, cheia de graça, o Senhor é convosco,
bendita sois vós entre as mulheres
e bendito é o fruto do vosso ventre, Jesus.
Santa Maria, Mãe de Deus,
rogai por nós pecadores,
agora e na hora da nossa morte.
Amen.`,
};

const GLORIA = {
    title: 'Glória',
    text: `Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
};

const SINAL_DA_CRUZ = {
    title: 'Sinal da Cruz',
    text: `Pelo sinal da Santa Cruz,
livrai-nos, Deus, Nosso Senhor, dos nossos inimigos.
Em nome do Pai e do Filho e do Espírito Santo.
Amen.`,
};

const SALVE_RAINHA = {
    title: 'Salvé Rainha',
    text: `Salvé, Rainha, Mãe de misericórdia,
vida, doçura e esperança nossa, salvé!
A Vós bradamos, os degredados filhos de Eva;
a Vós suspiramos, gemendo e chorando neste vale de lágrimas.
Eia, pois, advogada nossa,
esses vossos olhos misericordiosos a nós volvei;
e depois deste desterro nos mostrai Jesus,
bendito fruto do vosso ventre,
ó clemente, ó piedosa, ó doce sempre Virgem Maria.

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.`,
};

const CREDO = {
    title: 'Credo',
    text: `Creio em Deus, Pai todo-poderoso,
Criador do céu e da terra;
e em Jesus Cristo, seu único Filho, Nosso Senhor,
que foi concebido pelo poder do Espírito Santo,
nasceu da Virgem Maria,
padeceu sob Pôncio Pilatos,
foi crucificado, morto e sepultado;
desceu à mansão dos mortos,
ressuscitou ao terceiro dia,
subiu aos céus,
está sentado à direita de Deus Pai todo-poderoso,
donde há-de vir a julgar os vivos e os mortos.

Creio no Espírito Santo,
na santa Igreja Católica,
na comunhão dos Santos,
na remissão dos pecados,
na ressurreição da carne,
na vida eterna.
Amen.`,
};

/** Every chaplet the app can pray step by step, in the order the chooser
    lists them: the two most asked for first, then the rest. */
export const CHAPLETS: Chaplet[] = [
    {
        id: 'divina-misericordia',
        title: 'Terço da Divina Misericórdia',
        subtitle: 'Nas contas do terço comum, cinco dezenas',
        note: 'Ensinado a Santa Faustina Kowalska em 1935. Reza-se sobretudo às três da tarde, a hora da morte do Senhor.',
        duration: '≈ 12 minutos',
        shape: '5 dezenas',
        opening: [SINAL_DA_CRUZ, PAI_NOSSO, AVE_MARIA, CREDO],
        largeBead: {
            title: 'Conta grande',
            text: `Eterno Pai, eu Vos ofereço
o Corpo e Sangue, Alma e Divindade
do vosso diletíssimo Filho,
Nosso Senhor Jesus Cristo,
em expiação dos nossos pecados
e dos do mundo inteiro.`,
        },
        smallBead: {
            title: 'Conta pequena',
            text: `Pela sua dolorosa Paixão,
tende misericórdia de nós
e do mundo inteiro.`,
        },
        smallBeads: 10,
        groups: [
            { title: '1.ª dezena' },
            { title: '2.ª dezena' },
            { title: '3.ª dezena' },
            { title: '4.ª dezena' },
            { title: '5.ª dezena' },
        ],
        ending: [
            {
                title: 'Deus santo',
                repeat: 3,
                text: `Deus santo, Deus forte, Deus imortal,
tende piedade de nós e do mundo inteiro.`,
            },
            {
                title: 'Ó Sangue e Água',
                text: `Ó Sangue e Água que jorrastes
do Coração de Jesus
como fonte de misericórdia para nós:
eu confio em Vós.`,
            },
        ],
    },
    {
        id: 'lagrimas',
        title: 'Coroa das Lágrimas',
        subtitle: 'Sete grupos de sete contas, pelas lágrimas de Nossa Senhora',
        note: 'Devoção às lágrimas da Virgem Maria ao pé da Cruz. Reza-se nas contas do terço comum ou num cordão próprio de sete séptenas.',
        duration: '≈ 12 minutos',
        shape: '7 grupos de 7 contas',
        opening: [
            SINAL_DA_CRUZ,
            {
                title: 'Oração inicial',
                text: `Eis-nos aos vossos pés, ó dulcíssimo Jesus crucificado,
para Vos oferecer as lágrimas daquela
que, com tanto amor, Vos acompanhou
no caminho doloroso do Calvário.

Fazei, ó bom Mestre,
que saibamos aproveitar a lição que elas nos dão,
para que, cumprindo a vossa santíssima vontade na terra,
possamos um dia, nos céus,
louvar-Vos por toda a eternidade.
Amen.`,
            },
        ],
        largeBead: {
            title: 'Conta grande',
            text: `Vede, ó Jesus, que são as lágrimas
daquela que mais Vos amou na terra
e que mais Vos ama no Céu.`,
        },
        smallBead: {
            title: 'Conta pequena',
            text: `Meu Jesus, ouvi os nossos pedidos,
pelas lágrimas de vossa Mãe santíssima.`,
        },
        smallBeads: 7,
        groups: [
            { title: '1.º grupo' },
            { title: '2.º grupo' },
            { title: '3.º grupo' },
            { title: '4.º grupo' },
            { title: '5.º grupo' },
            { title: '6.º grupo' },
            { title: '7.º grupo' },
        ],
        ending: [
            {
                title: 'Vede, ó Jesus',
                repeat: 3,
                text: `Vede, ó Jesus, que são as lágrimas
daquela que mais Vos amou na terra
e que mais Vos ama no Céu.`,
            },
            {
                title: 'Oração final',
                text: `Virgem santíssima e Mãe das Dores,
nós Vos pedimos que junteis os vossos pedidos aos nossos,
a fim de que Jesus, vosso divino Filho,
a quem nos dirigimos em nome das vossas lágrimas de Mãe,
ouça as nossas preces e nos conceda,
com as graças que desejamos, a coroa eterna.
Amen.

Ó Virgem dolorosíssima,
as vossas lágrimas derrubaram o império infernal.`,
            },
        ],
    },
    {
        id: 'sete-dores',
        title: 'Coroa das Sete Dores',
        subtitle: 'As sete dores de Nossa Senhora, sete contas cada',
        note: 'Devoção da Ordem dos Servos de Maria, do século XIII. Reza-se sobretudo na Quaresma e a 15 de Setembro.',
        duration: '≈ 20 minutos',
        shape: '7 dores, 7 contas cada',
        opening: [SINAL_DA_CRUZ, CREDO, PAI_NOSSO, AVE_MARIA],
        largeBead: PAI_NOSSO,
        smallBead: AVE_MARIA,
        smallBeads: 7,
        groups: [
            {
                title: 'Primeira dor',
                meditation: 'A profecia de Simeão, que anunciou a Maria a espada que lhe havia de trespassar a alma.',
            },
            {
                title: 'Segunda dor',
                meditation: 'A fuga para o Egipto, com São José e o Menino, diante da ameaça de Herodes.',
            },
            {
                title: 'Terceira dor',
                meditation: 'A perda do Menino Jesus em Jerusalém, e os três dias em que O procurou.',
            },
            {
                title: 'Quarta dor',
                meditation: 'O encontro com Jesus a caminho do Calvário, carregado com a Cruz.',
            },
            {
                title: 'Quinta dor',
                meditation: 'A agonia e a morte de Jesus, que Maria acompanhou de pé, junto à Cruz.',
            },
            {
                title: 'Sexta dor',
                meditation: 'O lado de Jesus aberto pela lança, e o seu corpo entregue nos braços da Mãe.',
            },
            {
                title: 'Sétima dor',
                meditation: 'A sepultura do Redentor, e a solidão de Maria ao voltar sem Ele.',
            },
        ],
        ending: [
            {
                title: 'Três Avé-Marias',
                text: `Rezam-se três Avé-Marias
em honra das lágrimas de Nossa Senhora.

Avé Maria, cheia de graça…`,
            },
            SALVE_RAINHA,
        ],
    },
    {
        id: 'franciscana',
        title: 'Coroa Franciscana',
        subtitle: 'As sete alegrias de Nossa Senhora, uma dezena cada',
        note: 'Terço das Sete Alegrias, rezado pelos Franciscanos desde 1422. As duas Avé-Marias finais perfazem setenta e duas — os anos que a tradição atribui à vida de Nossa Senhora.',
        duration: '≈ 25 minutos',
        shape: '7 dezenas',
        opening: [SINAL_DA_CRUZ],
        largeBead: PAI_NOSSO,
        smallBead: AVE_MARIA,
        smallBeads: 10,
        groups: [
            {
                title: 'Primeira alegria',
                meditation: 'A Anunciação: o Anjo Gabriel saúda Maria, e Ela concebe do Espírito Santo.',
            },
            {
                title: 'Segunda alegria',
                meditation: 'A Visitação: Maria vai apressadamente à montanha e Isabel chama-lhe bendita entre as mulheres.',
            },
            {
                title: 'Terceira alegria',
                meditation: 'O Nascimento do Senhor: Maria dá à luz em Belém e recosta o seu Filho numa manjedoura.',
            },
            {
                title: 'Quarta alegria',
                meditation: 'A adoração dos Magos: os sábios do Oriente prostram-se diante do Menino e abrem os seus tesouros.',
            },
            {
                title: 'Quinta alegria',
                meditation: 'O encontro no Templo: depois de três dias, Maria e José acham Jesus no meio dos doutores.',
            },
            {
                title: 'Sexta alegria',
                meditation: 'A Ressurreição do Senhor: a dor de Maria transforma-se na alegria que ninguém lhe tirará.',
            },
            {
                title: 'Sétima alegria',
                meditation: 'A Assunção e a Coroação: Maria é elevada ao Céu em corpo e alma e coroada Rainha de todos os Santos.',
            },
        ],
        ending: [
            {
                title: 'As duas Avé-Marias',
                text: `Rezam-se mais duas Avé-Marias,
para perfazer as setenta e duas
que a tradição conta pelos anos de Nossa Senhora.

Avé Maria, cheia de graça…`,
            },
            {
                title: 'Pelas intenções do Santo Padre',
                text: `Reza-se um Pai Nosso e uma Avé Maria
pelas intenções do Santo Padre.

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.`,
            },
        ],
    },
    {
        id: 'chagas',
        title: 'Terço das Santas Chagas',
        subtitle: 'Nas contas do terço comum, cinco dezenas',
        note: 'Revelado à Irmã Maria Marta Chambon (1841-1907), do Mosteiro da Visitação de Chambéry. Reza-se sobretudo às sextas-feiras.',
        duration: '≈ 10 minutos',
        shape: '5 dezenas',
        opening: [
            {
                title: 'Invocação inicial',
                text: `V. Deus, vinde em nosso auxílio.
R. Senhor, socorrei-nos e salvai-nos.

Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
            },
            {
                title: 'Oração inicial',
                text: `Ó Jesus, divino Redentor,
sede misericordioso para connosco e para com o mundo inteiro.

Deus santo, Deus forte, Deus imortal,
tende piedade de nós e do mundo inteiro.

Graça e misericórdia, meu Jesus, nos perigos presentes;
cobri-nos com o vosso Sangue precioso.

Pai eterno, misericórdia,
pelo Sangue de Jesus Cristo, vosso único Filho:
tende misericórdia de nós, nós Vo-lo suplicamos.
Amen.`,
            },
        ],
        largeBead: {
            title: 'Conta grande',
            text: `Pai eterno, eu Vos ofereço
as Chagas de Nosso Senhor Jesus Cristo,
para curar as chagas das nossas almas.`,
        },
        smallBead: {
            title: 'Conta pequena',
            text: `Meu Jesus, perdão e misericórdia,
pelos méritos das vossas santas Chagas.`,
        },
        smallBeads: 10,
        groups: [
            { title: '1.ª dezena' },
            { title: '2.ª dezena' },
            { title: '3.ª dezena' },
            { title: '4.ª dezena' },
            { title: '5.ª dezena' },
        ],
        ending: [
            {
                title: 'Jaculatória final',
                repeat: 3,
                text: `Pai eterno, eu Vos ofereço
as Chagas de Nosso Senhor Jesus Cristo,
para curar as chagas das nossas almas.`,
            },
        ],
    },
    {
        id: 'sao-miguel',
        title: 'Coroa Angélica de São Miguel',
        subtitle: 'Nove saudações aos nove coros dos Anjos',
        note: 'Devoção revelada em Portugal à serva de Deus Antónia de Astónaco e enriquecida de indulgências por Pio IX em 1851.',
        duration: '≈ 15 minutos',
        shape: '9 saudações de 1 + 3 contas',
        opening: [
            {
                title: 'Invocação inicial',
                text: `V. Deus, vinde em nosso auxílio.
R. Senhor, socorrei-nos e salvai-nos.

Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
            },
        ],
        largeBead: PAI_NOSSO,
        smallBead: AVE_MARIA,
        smallBeads: 3,
        groups: [
            {
                title: 'Primeira saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Serafins, fazei-nos, Senhor, dignos do fogo da perfeita caridade.',
            },
            {
                title: 'Segunda saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Querubins, pedimos, Senhor, a graça de trilhar a estrada da perfeição cristã.',
            },
            {
                title: 'Terceira saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Tronos, pedimos, Senhor, que nos deis o espírito da verdadeira humildade.',
            },
            {
                title: 'Quarta saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste das Dominações, pedimos, Senhor, a graça de dominar os nossos sentidos e de nos corrigirmos das más paixões.',
            },
            {
                title: 'Quinta saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste das Potestades, pedimos, Senhor, que Vos digneis proteger as nossas almas contra as ciladas e as tentações do demónio.',
            },
            {
                title: 'Sexta saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste das Virtudes, pedimos, Senhor, a graça de sermos vencedores no perigoso combate das tentações.',
            },
            {
                title: 'Sétima saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Principados, pedimos, Senhor, que nos deis o espírito de uma verdadeira e sincera obediência.',
            },
            {
                title: 'Oitava saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Arcanjos, pedimos, Senhor, o dom da perseverança na fé e nas boas obras, a fim de podermos chegar à glória do Paraíso.',
            },
            {
                title: 'Nona saudação',
                meditation: 'Pela intercessão de São Miguel e do coro celeste dos Anjos, pedimos, Senhor, que estes espíritos bem-aventurados nos guardem sempre, sobretudo na hora da nossa morte, e nos conduzam à glória do Paraíso.',
            },
        ],
        ending: [
            {
                title: 'As quatro contas finais',
                text: `Reza-se um Pai Nosso em honra de cada um:

São Miguel Arcanjo.
São Gabriel Arcanjo.
São Rafael Arcanjo.
O nosso Anjo da Guarda.`,
            },
            {
                title: 'Antífona',
                text: `Glorioso São Miguel,
chefe e príncipe dos exércitos celestes,
fiel guardião das almas,
vencedor dos espíritos rebeldes,
nosso admirável guia depois de Cristo:
dignai-vos livrar-nos de todos os males,
a nós que recorremos a vós com confiança,
e fazei, pela vossa incomparável protecção,
que avancemos cada dia mais
na fidelidade em servir a Deus.
Amen.

V. Rogai por nós, ó bem-aventurado São Miguel,
príncipe da Igreja de Cristo.
R. Para que sejamos dignos das promessas de Cristo.`,
            },
        ],
    },
    {
        id: 'doze-estrelas',
        title: 'Coroa das Doze Estrelas',
        subtitle: 'Doze louvores à Trindade pela Virgem Maria',
        note: 'Louvores às três Pessoas divinas pelo que fizeram em Maria, a Mulher vestida de sol com uma coroa de doze estrelas (Ap 12, 1).',
        duration: '≈ 8 minutos',
        shape: '3 grupos de 4 contas',
        opening: [
            SINAL_DA_CRUZ,
            {
                title: 'Louvor inicial',
                text: `Louvemos e demos graças à Santíssima Trindade,
que nos apresentou Maria vestida de sol,
com a lua debaixo dos pés
e na cabeça uma coroa de doze estrelas.

R. Pelos séculos dos séculos. Amen.`,
            },
        ],
        largeBead: PAI_NOSSO,
        smallBead: AVE_MARIA,
        smallBeads: 4,
        afterEachGroup: GLORIA,
        groups: [
            {
                title: 'Ao Pai',
                meditation: 'Louvemos e demos graças ao eterno Pai, que a escolheu para filha sua.',
                smallBeadTexts: [
                    'Louvado seja o eterno Pai, que a predestinou para Mãe do seu divino Filho.\n\nAvé Maria…',
                    'Louvado seja o eterno Pai, que a preservou de toda a culpa na sua conceição.\n\nAvé Maria…',
                    'Louvado seja o eterno Pai, que a adornou de preciosos dons na sua natividade.\n\nAvé Maria…',
                    'Louvado seja o eterno Pai, que lhe deu por esposo puríssimo São José.\n\nAvé Maria…',
                ],
            },
            {
                title: 'Ao Filho',
                meditation: 'Louvemos e demos graças ao divino Filho, que a escolheu para Mãe sua.',
                smallBeadTexts: [
                    'Louvado seja o divino Filho, que encarnou e habitou nove meses no seu seio.\n\nAvé Maria…',
                    'Louvado seja o divino Filho, que dela nasceu e do seu leite se alimentou.\n\nAvé Maria…',
                    'Louvado seja o divino Filho, que na sua infância quis ser ensinado por ela.\n\nAvé Maria…',
                    'Louvado seja o divino Filho, que lhe revelou os mistérios da redenção do mundo.\n\nAvé Maria…',
                ],
            },
            {
                title: 'Ao Espírito Santo',
                meditation: 'Louvemos e demos graças ao Espírito Santo, que a recebeu por esposa.',
                smallBeadTexts: [
                    'Louvado seja o Espírito Santo, que a ela primeiro revelou o seu nome.\n\nAvé Maria…',
                    'Louvado seja o Espírito Santo, por obra de quem ela foi, ao mesmo tempo, Virgem e Mãe.\n\nAvé Maria…',
                    'Louvado seja o Espírito Santo, por cuja virtude ela foi templo da Santíssima Trindade.\n\nAvé Maria…',
                    'Louvado seja o Espírito Santo, que a exaltou no céu sobre todas as criaturas.\n\nAvé Maria…',
                ],
            },
        ],
        ending: [
            {
                title: 'Saudação final',
                text: `Deus Vos salve, Mãe de clemência,
consoladora dos aflitos, redentora dos cativos.
Vós sois a glória de Jerusalém,
a alegria de Israel,
a honra do nosso povo.`,
            },
            SALVE_RAINHA,
        ],
    },
    {
        id: 'almas-do-purgatorio',
        title: 'Coroa pelas Almas do Purgatório',
        subtitle: 'Cinco súplicas pela Paixão do Senhor',
        note: 'Sufrágio pelos fiéis defuntos, próprio do mês de Novembro e do dia dos Fiéis Defuntos.',
        duration: '≈ 7 minutos',
        shape: '5 súplicas de 1 + 1 conta',
        opening: [SINAL_DA_CRUZ],
        largeBead: PAI_NOSSO,
        smallBead: AVE_MARIA,
        smallBeads: 1,
        afterEachGroup: {
            title: 'Responso',
            text: `Que as almas dos fiéis defuntos,
pela misericórdia de Deus, descansem em paz.
Amen.`,
        },
        groups: [
            {
                title: 'Primeira súplica',
                meditation: 'Meu Jesus, pelo suor de sangue que derramastes no Horto das Oliveiras, tende piedade das almas dos meus antepassados mais queridos que sofrem no Purgatório.',
            },
            {
                title: 'Segunda súplica',
                meditation: 'Meu Jesus, pelas humilhações e escárnios que sofrestes diante dos tribunais, tende piedade das almas dos nossos defuntos que no Purgatório esperam ser glorificados no vosso Reino.',
            },
            {
                title: 'Terceira súplica',
                meditation: 'Meu Jesus, pela coroa de espinhos que Vos trespassou a santa face, tende piedade da alma mais abandonada e sem socorro, e daquela que está mais longe de ser libertada.',
            },
            {
                title: 'Quarta súplica',
                meditation: 'Meu Jesus, pelos passos dolorosos que destes com a Cruz aos ombros e pelo encontro com vossa Mãe no caminho do Calvário, livrai das penas do Purgatório a alma que está mais perto de ser libertada e as que foram fiéis a essa Mãe bem-amada.',
            },
            {
                title: 'Quinta súplica',
                meditation: 'Meu Jesus, pelo vosso corpo estendido na Cruz, pelas mãos e pés trespassados, pela vossa morte e pelo lado aberto pela lança, tende piedade das almas sofredoras e recebei-as na vossa companhia no Paraíso.',
            },
        ],
        ending: [
            {
                title: 'Eterno descanso',
                text: `V. Dai-lhes, Senhor, o eterno descanso.
R. Entre os esplendores da luz perpétua.
V. Descansem em paz.
R. Amen.`,
            },
        ],
    },
];
