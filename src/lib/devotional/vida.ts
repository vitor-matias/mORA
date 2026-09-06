import type { Prayer } from './types';

/** For the people and the days we actually have: the family, the sick, the
    Church, the country, the journey, the hard hour. */
export const VIDA: Prayer[] = [
    {
        id: 'oracao-pela-familia',
        title: 'Pela família',
        category: 'vida',
        aka: ['Sagrada Família', 'Casa', 'Lar'],
        text: `Senhor Jesus Cristo,
que, vivendo em família com Maria, vossa Mãe,
e com São José,
santificastes a família humana:

vivei também connosco, no nosso lar,
para que sejamos uma pequena Igreja,
pela vida de fé e de oração,
pelo amor ao Pai e aos irmãos,
pela união no trabalho
e pela esperança viva na vida eterna.

Que nos amemos na verdade,
perdoando-nos quando for preciso,
com um amor generoso, sincero e constante.

Dai às nossas famílias
coragem nas lutas,
paciência nos sofrimentos
e alegria na caminhada para a casa do Pai.
Amen.`,
    },
    {
        id: 'oracao-pelos-filhos',
        title: 'Pelos filhos',
        category: 'vida',
        aka: ['Pais', 'Crianças'],
        text: `Senhor, Vós nos confiastes estes filhos:
são vossos antes de serem nossos.

Guardai-os de todo o mal,
dai-lhes saúde do corpo e da alma,
e sobretudo a graça de Vos conhecerem
e de Vos amarem toda a vida.

Dai-nos a nós, seus pais,
a paciência que não se cansa,
a firmeza que não magoa
e o exemplo que ensina mais do que as palavras.

E quando os nossos filhos se afastarem,
não permitais, Senhor, que se percam:
esperai por eles à porta,
como o pai da parábola,
e trazei-os de volta.

Nossa Senhora, Mãe de Jesus,
guardai os nossos filhos sob o vosso manto.
Amen.`,
    },
    {
        id: 'oracao-da-mae-que-espera-um-filho',
        title: 'Da mãe que espera um filho',
        category: 'vida',
        aka: ['Gravidez', 'Bom parto', 'Grávida'],
        text: `Senhor, dador de toda a vida,
bendito sejais pelo filho que trago comigo.

Guardai-o e formai-o,
dai-lhe saúde e um coração inteiro,
e concedei-me a mim serenidade e forças
para o esperar e o receber com alegria.

Nossa Senhora, que levastes Jesus no vosso seio
e Vos apressastes pela montanha
para servir vossa prima Isabel:
acompanhai esta espera,
assisti-me na hora do parto
e ensinai-me a ser mãe.
Amen.`,
    },
    {
        id: 'oracao-pelos-doentes',
        title: 'Pelos doentes',
        category: 'vida',
        aka: ['Doença', 'Hospital', 'Saúde'],
        text: `Ó meu Deus, aqui está este doente diante de Vós,
que veio pedir-Vos o que deseja
e considera mais importante para si.

Fazei penetrar no seu coração estas palavras:
o mais importante é a saúde da alma.

Senhor, que se cumpra nele a vossa vontade:
se desejais que se cure, seja-lhe concedida a saúde;
e, se for outra a vossa vontade,
dai-lhe forças para levar a sua cruz.

Protegei-o e aliviai a sua dor,
e purificai também o nosso coração,
a nós que intercedemos por ele,
para que nos tornemos dignos
de transmitir a vossa santa misericórdia.
Amen.`,
    },
    {
        id: 'oracao-na-aflicao',
        title: 'Na aflição',
        category: 'vida',
        note: 'Quando não há palavras.',
        aka: ['Angústia', 'Sofrimento', 'Tristeza', 'Provação'],
        text: `Senhor, não sei rezar como devia,
mas Vós conheceis o meu coração
melhor do que eu.

Não Vos peço que me tireis já esta cruz;
peço-Vos que não me deixeis sozinho debaixo dela.

Dai-me hoje o que chegue para hoje:
paciência para esta hora,
confiança para a próxima,
e a certeza de que também esta noite
tem um fim que Vós preparais.

Jesus, que suastes sangue no Horto
e dissestes «faça-se a vossa vontade»,
dizei-o em mim, quando eu já não conseguir dizê-lo.
Amen.`,
    },
    {
        id: 'oracao-para-perdoar',
        title: 'Para perdoar',
        category: 'vida',
        aka: ['Perdão', 'Reconciliação', 'Mágoa'],
        text: `Senhor, Vós mandastes perdoar setenta vezes sete,
e eu ainda não consigo perdoar uma.

Tirai-me o gosto amargo de ter razão.
Curai a memória que guarda a ofensa
como quem guarda um tesouro.

Abençoai quem me fez mal;
e, se eu não for capaz de o fazer de coração,
dai-me ao menos a vontade de o querer.

Perdoai as minhas ofensas,
assim como eu quero perdoar
a quem me tem ofendido.
Amen.`,
    },
    {
        id: 'oracao-antes-de-viagem',
        title: 'Antes de uma viagem',
        category: 'vida',
        aka: ['Caminho', 'Estrada', 'Conduzir', 'Automóvel'],
        text: `Senhor, que acompanhastes os discípulos
no caminho de Emaús,
fazei-Vos companheiro deste caminho.

Dai-me atenção e prudência,
respeito por quem viaja comigo
e por quem vai na estrada ao meu lado.
Guardai-me a mim e aos que espero encontrar,
e trazei-nos a todos em paz à nossa casa.

Nossa Senhora da Boa Viagem,
Anjo da minha Guarda,
ide à minha frente.
Amen.`,
    },
    {
        id: 'oracao-pelo-trabalho',
        title: 'Por quem trabalha e por quem procura trabalho',
        category: 'vida',
        aka: ['Emprego', 'Desemprego', 'Trabalhadores'],
        text: `Senhor, que trabalhastes com as vossas mãos
na oficina de Nazaré,
abençoai o trabalho dos homens.

Dai a cada um o que precisa para viver com dignidade,
justiça a quem é explorado,
descanso a quem se esgota
e trabalho a quem o procura e não encontra.

E a mim, dai-me fazer bem o que tenho a fazer hoje,
com honestidade e sem me queixar,
oferecendo-Vos o cansaço
que ninguém mais vê.
Amen.`,
    },
    {
        id: 'oracao-pelas-vocacoes',
        title: 'Pelas vocações',
        category: 'vida',
        aka: ['Seminário', 'Vida consagrada', 'Sacerdócio'],
        text: `Senhor da messe e pastor do rebanho,
fazei ressoar aos nossos ouvidos
o vosso convite forte e suave: «Vem e segue-Me.»

Derramai sobre nós o vosso Espírito,
que nos dê sabedoria para ver o caminho
e generosidade para seguir a vossa voz.

Senhor, que a messe não se perca por falta de operários;
que o rebanho não pereça por falta de pastores.
Sustentai a fidelidade dos nossos bispos e sacerdotes,
dai perseverança aos seminaristas
e despertai o coração dos nossos jovens.

Maria, Mãe da Igreja,
ajudai-nos a responder «sim».
Amen.`,
    },
    {
        id: 'oracao-pelos-sacerdotes',
        title: 'Pelos sacerdotes',
        category: 'vida',
        note: 'Reza-se sobretudo às quintas-feiras.',
        aka: ['Padres', 'Clero'],
        text: `Senhor Jesus, sumo e eterno Sacerdote,
guardai os vossos sacerdotes
sob a protecção do vosso Coração,
onde ninguém lhes pode fazer mal.

Guardai imaculadas as mãos que tocam
todos os dias o vosso Corpo santíssimo;
guardai puros os lábios
que se abrem para pronunciar as vossas palavras;
guardai puros e desapegados
os corações que foram selados
pelo carácter sublime do sacerdócio.

Fazei-os crescer no amor a Vós
e guardai-os do contágio do mundo.
Dai-lhes, com o poder de mudar o pão e o vinho,
o poder de mudar corações;
abençoai os seus trabalhos com fruto abundante
e concedei-lhes, um dia, a coroa da vida eterna.
Amen.`,
    },
    {
        id: 'oracao-pelo-papa',
        title: 'Pelo Santo Padre',
        category: 'vida',
        aka: ['Oremus pro Pontifice', 'Papa'],
        text: `V. Roguemos pelo nosso Papa.
R. O Senhor o guarde e lhe dê vida,
o faça feliz na terra
e não o entregue à vontade dos seus inimigos.

Oremos:
Ó Deus, pastor e guia de todos os fiéis,
olhai com bondade para o vosso servo
que quisestes constituir pastor da vossa Igreja:
concedei-lhe, nós Vos pedimos,
que seja útil pela palavra e pelo exemplo
àqueles a quem preside,
para que chegue com o rebanho que lhe confiastes
à vida eterna.
Por Cristo, Nosso Senhor.
R. Amen.`,
    },
    {
        id: 'oracao-pela-igreja',
        title: 'Pela Igreja',
        category: 'vida',
        text: `Senhor Jesus Cristo,
que dissestes aos vossos Apóstolos:
«Deixo-vos a paz, dou-vos a minha paz»,
não olheis aos nossos pecados,
mas à fé da vossa Igreja
e dai-lhe a união e a paz segundo a vossa vontade.

Guardai-a na verdade,
purificai-a do que nela é nosso e não é vosso,
consolai os que nela sofreram
e fazei dela, no meio do mundo,
um sinal do vosso amor.
Vós que viveis e reinais pelos séculos dos séculos.
Amen.`,
    },
    {
        id: 'oracao-pela-paz',
        title: 'Pela paz',
        category: 'vida',
        aka: ['Guerra', 'Concórdia'],
        text: `Senhor, Deus da paz,
que criastes os homens
para serem uma só família:

desarmai a língua e as mãos,
renovai em nós a coragem do diálogo
e do primeiro passo para o perdão.

Dai descanso aos que morreram,
consolação aos que ficaram,
juízo recto aos que governam
e pão a quem foge com o que tem às costas.

Rainha da paz, rogai por nós.
Amen.`,
    },
    {
        id: 'oracao-pela-patria',
        title: 'Por Portugal',
        category: 'vida',
        note: 'Portugal foi consagrado a Nossa Senhora da Conceição em 1646.',
        aka: ['Pátria', 'Nação'],
        text: `Senhor, abençoai esta terra
que nos destes por pátria.

Dai aos que a governam rectidão e serviço,
aos que nela trabalham justiça e pão,
aos que dela partiram um regresso,
e a todos nós o gosto de a fazer melhor
do que a recebemos.

Guardai a fé que os nossos maiores nos deixaram
e fazei que ela seja em nós obras e não só memória.

Nossa Senhora da Conceição, Padroeira de Portugal,
Santo António, São Vicente e Rainha Santa Isabel,
rogai por nós.
Amen.`,
    },
    {
        id: 'oracao-por-uma-boa-morte',
        title: 'Por uma boa morte',
        category: 'vida',
        aka: ['Perseverança final', 'Hora da morte'],
        text: `Meu Deus, Pai e Criador,
peço-Vos a mais importante de todas as graças:
a perseverança final e uma morte santa.

Por maior que tenha sido o abuso da vida que me destes,
concedei-me a graça de a viver desde agora
e de a terminar no vosso santo amor.

Que eu morra como os santos Patriarcas,
abandonando sem tristeza este vale de lágrimas,
para ir gozar o descanso eterno na minha verdadeira pátria.

Que eu morra como o glorioso São José,
acompanhado por Jesus e Maria,
pronunciando estes nomes dulcíssimos,
que espero bendizer por toda a eternidade.

Que eu morra como a Virgem Imaculada,
na mais pura caridade
e com o desejo de me unir ao único objecto dos meus amores.

Que eu morra como Jesus na Cruz,
plenamente identificado com a vontade do Pai,
feito um holocausto por amor.

Jesus, morto por mim,
concedei-me a graça de morrer
com um acto de perfeita caridade para convosco.
Santa Maria, Mãe de Deus,
rogai por mim agora e na hora da minha morte.
São José, meu pai e senhor,
alcançai-me a graça de morrer com a morte dos justos.

Para o momento da morte:
Senhor, meu Deus, de boa vontade aceito desde já,
como vinda das vossas mãos,
qualquer espécie de morte que quiserdes enviar-me,
com todas as suas angústias, penas e dores.

V. Amado Jesus, José e Maria,
R. dou-vos o coração e a alma minha.
V. Amado Jesus, José e Maria,
R. assisti-me na última agonia.
V. Amado Jesus, José e Maria,
R. expire em paz entre vós a alma minha.
Amen.`,
    },
];
