import type { Prayer } from './types';

/** The prayers a Portuguese Catholic is expected to know by heart, in the
    wording of the Portuguese ritual books. Where a prayer is still commonly
    prayed in Latin, the Latin is carried alongside. */
export const COMUNS: Prayer[] = [
    {
        id: 'sinal-da-cruz',
        title: 'Sinal da Cruz',
        category: 'comuns',
        note: 'Abre e fecha toda a oração cristã.',
        aka: ['Signum Crucis', 'Em nome do Pai'],
        text: `Pelo sinal da Santa Cruz,
livrai-nos, Deus, Nosso Senhor,
dos nossos inimigos.

Em nome do Pai e do Filho
e do Espírito Santo.
Amen.`,
        latin: `Per signum Crucis de inimícis nostris
líbera nos, Deus noster.

In nómine Patris, et Fílii,
et Spíritus Sancti.
Amen.`,
    },
    {
        id: 'pai-nosso',
        title: 'Pai Nosso',
        category: 'comuns',
        note: 'A oração que o próprio Senhor ensinou (Mt 6, 9-13).',
        aka: ['Pater noster', 'Oração dominical'],
        text: `Pai nosso, que estais nos céus,
santificado seja o vosso nome,
venha a nós o vosso reino,
seja feita a vossa vontade
assim na terra como no céu.

O pão nosso de cada dia nos dai hoje,
perdoai-nos as nossas ofensas,
assim como nós perdoamos
a quem nos tem ofendido,
e não nos deixeis cair em tentação,
mas livrai-nos do mal.
Amen.`,
        latin: `Pater noster, qui es in cælis:
sanctificétur nomen tuum;
advéniat regnum tuum;
fiat volúntas tua, sicut in cælo, et in terra.

Panem nostrum cotidiánum da nobis hódie;
et dimítte nobis débita nostra,
sicut et nos dimíttimus debitóribus nostris;
et ne nos indúcas in tentatiónem;
sed líbera nos a malo.
Amen.`,
    },
    {
        id: 'ave-maria',
        title: 'Avé Maria',
        category: 'comuns',
        note: 'A saudação do Anjo e de Isabel, com a súplica da Igreja.',
        aka: ['Ave Maria', 'Ave-Maria'],
        text: `Avé Maria, cheia de graça,
o Senhor é convosco,
bendita sois vós entre as mulheres
e bendito é o fruto do vosso ventre, Jesus.

Santa Maria, Mãe de Deus,
rogai por nós pecadores,
agora e na hora da nossa morte.
Amen.`,
        latin: `Ave, María, grátia plena, Dóminus tecum.
Benedícta tu in muliéribus,
et benedíctus fructus ventris tui, Iesus.

Sancta María, Mater Dei,
ora pro nobis peccatóribus,
nunc et in hora mortis nostræ.
Amen.`,
    },
    {
        id: 'gloria',
        title: 'Glória ao Pai',
        category: 'comuns',
        note: 'A doxologia menor, que remata os salmos e as dezenas do terço.',
        aka: ['Glória Patri', 'Doxologia'],
        text: `Glória ao Pai e ao Filho
e ao Espírito Santo.
Como era no princípio,
agora e sempre.
Amen.`,
        latin: `Glória Patri, et Fílio, et Spirítui Sancto.
Sicut erat in princípio,
et nunc et semper,
et in sǽcula sæculórum.
Amen.`,
    },
    {
        id: 'credo-apostolos',
        title: 'Credo (Símbolo dos Apóstolos)',
        category: 'comuns',
        note: 'A profissão de fé do Baptismo, rezada no início do terço.',
        aka: ['Símbolo dos Apóstolos', 'Credo Apostólico'],
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
    },
    {
        id: 'credo-niceno',
        title: 'Credo (Símbolo Niceno-Constantinopolitano)',
        category: 'comuns',
        note: 'A profissão de fé dos Concílios, rezada na Missa de domingo.',
        aka: ['Símbolo Niceno', 'Creio em um só Deus'],
        text: `Creio em um só Deus, Pai todo-poderoso,
Criador do céu e da terra,
de todas as coisas visíveis e invisíveis.

Creio em um só Senhor, Jesus Cristo,
Filho Unigénito de Deus,
nascido do Pai antes de todos os séculos:
Deus de Deus, luz da luz,
Deus verdadeiro de Deus verdadeiro;
gerado, não criado, consubstancial ao Pai.
Por Ele todas as coisas foram feitas.

E por nós, homens, e para a nossa salvação,
desceu dos céus,
e encarnou pelo Espírito Santo,
no seio da Virgem Maria,
e Se fez homem.
Também por nós foi crucificado sob Pôncio Pilatos;
padeceu e foi sepultado.
Ressuscitou ao terceiro dia, conforme as Escrituras;
e subiu aos céus,
onde está sentado à direita do Pai.
De novo há-de vir em sua glória,
para julgar os vivos e os mortos;
e o seu reino não terá fim.

Creio no Espírito Santo, Senhor que dá a vida,
e procede do Pai e do Filho;
e com o Pai e o Filho é adorado e glorificado:
Ele que falou pelos Profetas.

Creio na Igreja una, santa, católica e apostólica.
Professo um só Baptismo para a remissão dos pecados.
Espero a ressurreição dos mortos
e a vida do mundo que há-de vir.
Amen.`,
    },
    {
        id: 'gloria-nas-alturas',
        title: 'Glória a Deus nas alturas',
        category: 'comuns',
        note: 'O hino dos Anjos em Belém, cantado na Missa dos domingos e festas.',
        aka: ['Gloria in excelsis', 'Hino angélico'],
        text: `Glória a Deus nas alturas
e paz na terra aos homens por Ele amados.

Senhor Deus, Rei dos céus, Deus Pai todo-poderoso:
nós Vos louvamos, nós Vos bendizemos,
nós Vos adoramos, nós Vos glorificamos,
nós Vos damos graças pela vossa imensa glória.

Senhor Jesus Cristo, Filho Unigénito,
Senhor Deus, Cordeiro de Deus, Filho de Deus Pai:
Vós que tirais o pecado do mundo, tende piedade de nós;
Vós que tirais o pecado do mundo, acolhei a nossa súplica;
Vós que estais à direita do Pai, tende piedade de nós.

Só Vós sois o Santo;
só Vós, o Senhor;
só Vós, o Altíssimo, Jesus Cristo;
com o Espírito Santo, na glória de Deus Pai.
Amen.`,
    },
    {
        id: 'salve-rainha',
        title: 'Salvé Rainha',
        category: 'comuns',
        note: 'Antífona mariana do Tempo Comum; conclui o terço.',
        aka: ['Salve Regina', 'Salve Rainha'],
        text: `Salvé, Rainha, Mãe de misericórdia,
vida, doçura e esperança nossa, salvé!
A Vós bradamos, os degredados filhos de Eva;
a Vós suspiramos, gemendo e chorando
neste vale de lágrimas.

Eia, pois, advogada nossa,
esses vossos olhos misericordiosos a nós volvei;
e depois deste desterro nos mostrai Jesus,
bendito fruto do vosso ventre,
ó clemente, ó piedosa, ó doce sempre Virgem Maria.

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.`,
        latin: `Salve, Regína, Mater misericórdiæ,
vita, dulcédo et spes nostra, salve.
Ad te clamámus, éxsules fílii Hevæ.
Ad te suspirámus, geméntes et flentes
in hac lacrimárum valle.

Eia ergo, advocáta nostra,
illos tuos misericórdes óculos ad nos convérte.
Et Iesum, benedíctum fructum ventris tui,
nobis post hoc exsílium osténde.
O clemens, o pia, o dulcis Virgo María.

V. Ora pro nobis, sancta Dei Génetrix.
R. Ut digni efficiámur promissiónibus Christi.`,
    },
    {
        id: 'confesso',
        title: 'Confesso a Deus',
        category: 'comuns',
        note: 'O acto penitencial com que começa a Missa.',
        aka: ['Confiteor', 'Confissão', 'Eu confesso'],
        text: `Confesso a Deus todo-poderoso
e a vós, irmãos,
que pequei muitas vezes
por pensamentos e palavras, actos e omissões,
por minha culpa, minha culpa, minha tão grande culpa.

E peço à Virgem Maria,
aos Anjos e Santos,
e a vós, irmãos,
que rogueis por mim a Deus, Nosso Senhor.`,
        latin: `Confíteor Deo omnipoténti et vobis, fratres,
quia peccávi nimis cogitatióne, verbo,
ópere et omissióne:
mea culpa, mea culpa, mea máxima culpa.

Ídeo precor beátam Maríam semper Vírginem,
omnes Ángelos et Sanctos, et vos, fratres,
oráre pro me ad Dóminum Deum nostrum.`,
    },
    {
        id: 'acto-de-contricao',
        title: 'Acto de contrição',
        category: 'comuns',
        note: 'Rezado na confissão e ao fim do dia.',
        aka: ['Contrição', 'Meu Deus, porque sois infinitamente bom'],
        text: `Meu Deus, porque sois infinitamente bom,
eu Vos amo de todo o meu coração,
pesa-me ter-Vos ofendido,
e, com o auxílio da vossa divina graça,
proponho firmemente emendar-me
e nunca mais Vos tornar a ofender;
peço e espero o perdão das minhas culpas
pela vossa infinita misericórdia.
Amen.`,
    },
    {
        id: 'acto-de-contricao-simples',
        title: 'Acto de contrição (fórmula breve)',
        category: 'comuns',
        note: 'A fórmula que se ensina às crianças.',
        text: `Meu Deus, porque sois tão bom,
tenho muita pena de Vos ter ofendido.
Ajudai-me a não tornar a pecar.
Amen.`,
    },
    {
        id: 'acto-de-fe',
        title: 'Acto de fé',
        category: 'comuns',
        text: `Eu creio firmemente que há um só Deus,
em três pessoas realmente distintas:
Pai, Filho e Espírito Santo,
que dá o céu aos bons e o inferno aos maus, para sempre.

Creio que o Filho de Deus Se fez homem,
padeceu e morreu na cruz para nos salvar,
e que ao terceiro dia ressuscitou.

Creio tudo o mais que ensina
a santa Igreja Católica Apostólica,
porque Deus, verdade infalível, lho revelou.
E nesta crença quero viver e morrer.
Amen.`,
    },
    {
        id: 'acto-de-esperanca',
        title: 'Acto de esperança',
        category: 'comuns',
        text: `Eu espero, meu Deus, com firme confiança,
que pelos merecimentos do meu Senhor Jesus Cristo
me dareis a salvação eterna
e as graças necessárias para a conseguir,
porque Vós, sumamente bom e poderoso,
o haveis prometido
a quem observar fielmente os vossos mandamentos,
como eu proponho fazer com o vosso auxílio.
Amen.`,
    },
    {
        id: 'acto-de-caridade',
        title: 'Acto de caridade',
        category: 'comuns',
        text: `Eu Vos amo, ó meu Deus,
de todo o meu coração e sobre todas as coisas,
porque sois infinitamente bom e amável,
e antes quero perder tudo do que Vos ofender.

Por vosso amor, amo o meu próximo como a mim mesmo
e perdoo as ofensas recebidas.
Senhor, fazei que eu Vos ame cada vez mais.
Amen.`,
    },
    {
        id: 'anjo-da-guarda',
        title: 'Santo Anjo do Senhor',
        category: 'comuns',
        note: 'Ao acordar e ao deitar.',
        aka: ['Angele Dei', 'Anjo da Guarda'],
        text: `Santo Anjo do Senhor,
meu zeloso guardador,
pois que a ti me confiou a piedade divina,
hoje e sempre
me governa, rege, guarda e ilumina.
Amen.`,
        latin: `Ángele Dei, qui custos es mei,
me, tibi commíssum pietáte supérna,
illúmina, custódi, rege et gubérna.
Amen.`,
    },
    {
        id: 'jaculatorias',
        title: 'Jaculatórias',
        category: 'comuns',
        note: 'Orações de uma linha, para o meio do trabalho e do caminho.',
        aka: ['Aspirações', 'Preces breves'],
        text: `Jesus, Maria, José, eu Vos amo, salvai as almas.

Meu Senhor e meu Deus.

Sagrado Coração de Jesus, eu confio em Vós.

Ó Maria concebida sem pecado,
rogai por nós que recorremos a Vós.

Doce Coração de Maria, sede a salvação da minha alma.

Jesus, manso e humilde de coração,
fazei o meu coração semelhante ao vosso.

Vinde, Senhor Jesus.

Bendito e louvado seja
o Santíssimo Sacramento do altar.`,
    },
];
