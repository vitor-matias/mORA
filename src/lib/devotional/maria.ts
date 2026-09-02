import type { Prayer } from './types';

/** To Our Lady. Two of the Church's four seasonal antiphons are here — Alma
    Redemptoris Mater and Ave Regina caelorum. The Salve Regina is among the
    prayers everyone knows by heart, and the Regina Caeli with the hours of
    the day, where each is actually prayed. */
export const MARIA: Prayer[] = [
    {
        id: 'magnificat',
        title: 'Magnificat',
        category: 'maria',
        note: 'O cântico de Maria em casa de Isabel (Lc 1, 46-55); reza-se nas Vésperas.',
        aka: ['Cântico de Maria', 'A minha alma glorifica o Senhor'],
        text: `A minha alma glorifica o Senhor
e o meu espírito se alegra em Deus, meu Salvador.
Porque pôs os olhos na humildade da sua serva:
de hoje em diante me chamarão bem-aventurada todas as gerações.

O Todo-Poderoso fez em mim maravilhas:
Santo é o seu nome.
A sua misericórdia se estende de geração em geração
sobre aqueles que O temem.

Manifestou o poder do seu braço
e dispersou os soberbos.
Derrubou os poderosos de seus tronos
e exaltou os humildes.
Aos famintos encheu de bens
e aos ricos despediu de mãos vazias.

Acolheu a Israel, seu servo,
lembrado da sua misericórdia,
como tinha prometido a nossos pais,
a Abraão e à sua descendência para sempre.

Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
        latin: `Magníficat ánima mea Dóminum,
et exsultávit spíritus meus in Deo salvatóre meo,
quia respéxit humilitátem ancíllæ suæ.
Ecce enim ex hoc beátam me dicent omnes generatiónes,
quia fecit mihi magna qui potens est,
et sanctum nomen eius,
et misericórdia eius in progénies et progénies timéntibus eum.

Fecit poténtiam in bráchio suo,
dispérsit supérbos mente cordis sui;
depósuit poténtes de sede et exaltávit húmiles;
esuriéntes implévit bonis et dívites dimísit inánes.

Suscépit Ísrael púerum suum,
recordátus misericórdiæ,
sicut locútus est ad patres nostros,
Ábraham et sémini eius in sǽcula.`,
    },
    {
        id: 'lembrai-vos',
        title: 'Lembrai-vos',
        category: 'maria',
        note: 'Atribuída a São Bernardo: a oração da confiança em Maria.',
        aka: ['Memorare', 'Ó piíssima Virgem Maria'],
        text: `Lembrai-vos, ó piíssima Virgem Maria,
que nunca se ouviu dizer
que algum daqueles que recorreram à vossa protecção,
imploraram a vossa assistência
e reclamaram o vosso socorro,
fosse por vós desamparado.

Animado eu, pois, com igual confiança,
a vós, Virgem entre todas singular,
como à minha Mãe recorro;
de vós me valho e, gemendo sob o peso dos meus pecados,
me prostro aos vossos pés.

Não desprezeis as minhas súplicas,
ó Mãe do Filho de Deus humanado,
mas dignai-vos de as ouvir propícia
e de me alcançar o que vos rogo.
Amen.`,
        latin: `Memoráre, o piíssima Virgo María,
non esse audítum a sǽculo,
quemquam ad tua curréntem præsídia,
tua implorántem auxília,
tua peténtem suffrágia, esse derelíctum.

Ego tali animátus confidéntia,
ad te, Virgo Vírginum, Mater, curro,
ad te vénio, coram te gemens peccátor assísto.
Noli, Mater Verbi, verba mea despícere;
sed audi propítia et exáudi.
Amen.`,
    },
    {
        id: 'sob-a-vossa-proteccao',
        title: 'Sob a vossa protecção',
        category: 'maria',
        note: 'A oração mariana mais antiga que se conhece, do século III.',
        aka: ['Sub tuum praesidium', 'À vossa protecção nos acolhemos'],
        text: `À vossa protecção nos acolhemos,
santa Mãe de Deus;
não desprezeis as nossas súplicas nas necessidades,
mas livrai-nos sempre de todos os perigos,
ó Virgem gloriosa e bendita.

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.`,
        latin: `Sub tuum præsídium confúgimus,
sancta Dei Génetrix;
nostras deprecatiónes ne despícias in necessitátibus,
sed a perículis cunctis líbera nos semper,
Virgo gloriósa et benedícta.

V. Ora pro nobis, sancta Dei Génetrix.
R. Ut digni efficiámur promissiónibus Christi.`,
    },
    {
        id: 'ladainha-de-nossa-senhora',
        title: 'Ladainha de Nossa Senhora',
        category: 'maria',
        note: 'Ladainha Lauretana, aprovada em 1587 e alargada pelo Papa Francisco em 2020; conclui o terço rezado em comum.',
        aka: ['Ladainha de Loreto', 'Ladainha lauretana', 'Rosa mística'],
        text: `Senhor, tende piedade de nós.
Jesus Cristo, tende piedade de nós.
Senhor, tende piedade de nós.
Jesus Cristo, ouvi-nos.
Jesus Cristo, atendei-nos.

Pai celeste, que sois Deus, tende piedade de nós.
Filho, Redentor do mundo, que sois Deus, tende piedade de nós.
Espírito Santo, que sois Deus, tende piedade de nós.
Santíssima Trindade, que sois um só Deus, tende piedade de nós.

Santa Maria, rogai por nós.
Santa Mãe de Deus, rogai por nós.
Santa Virgem das virgens, rogai por nós.
Mãe de Jesus Cristo,
Mãe da Igreja,
Mãe da misericórdia,
Mãe da divina graça,
Mãe da esperança,
Mãe puríssima,
Mãe castíssima,
Mãe imaculada,
Mãe intacta,
Mãe amável,
Mãe admirável,
Mãe do bom conselho,
Mãe do Criador,
Mãe do Salvador,
Virgem prudentíssima,
Virgem venerável,
Virgem louvável,
Virgem poderosa,
Virgem clemente,
Virgem fiel,
Espelho de justiça,
Sede de sabedoria,
Causa da nossa alegria,
Vaso espiritual,
Vaso honorífico,
Vaso insigne de devoção,
Rosa mística,
Torre de David,
Torre de marfim,
Casa de ouro,
Arca da aliança,
Porta do céu,
Estrela da manhã,
Saúde dos enfermos,
Refúgio dos pecadores,
Socorro dos migrantes,
Consoladora dos aflitos,
Auxílio dos cristãos,
Rainha dos Anjos,
Rainha dos Patriarcas,
Rainha dos Profetas,
Rainha dos Apóstolos,
Rainha dos Mártires,
Rainha dos Confessores,
Rainha das Virgens,
Rainha de todos os Santos,
Rainha concebida sem mácula do pecado original,
Rainha elevada ao céu em corpo e alma,
Rainha do sacratíssimo Rosário,
Rainha da família,
Rainha da paz, rogai por nós.

Cordeiro de Deus, que tirais os pecados do mundo, perdoai-nos, Senhor.
Cordeiro de Deus, que tirais os pecados do mundo, ouvi-nos, Senhor.
Cordeiro de Deus, que tirais os pecados do mundo, tende piedade de nós.

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.

Oremos:
Senhor Deus, nós Vos suplicamos
que concedais aos vossos servos
perpétua saúde de alma e de corpo;
e que, pela gloriosa intercessão
da bem-aventurada sempre Virgem Maria,
sejamos livres da presente tristeza
e gozemos da eterna alegria.
Por Cristo, Nosso Senhor.
Amen.`,
    },
    {
        id: 'consagracao-a-nossa-senhora',
        title: 'Consagração a Nossa Senhora',
        category: 'maria',
        note: 'Entrega diária a Maria.',
        aka: ['Ó Senhora minha, ó minha Mãe', 'Consagração'],
        text: `Ó Senhora minha, ó minha Mãe,
eu me ofereço todo a vós
e, em prova da minha devoção para convosco,
vos consagro neste dia
os meus olhos, os meus ouvidos, a minha boca,
o meu coração e inteiramente todo o meu ser.

E porque assim sou todo vosso, ó incomparável Mãe,
guardai-me e defendei-me como coisa e propriedade vossa.
Amen.`,
    },
    {
        id: 'tres-ave-marias',
        title: 'As três Avé-Marias',
        category: 'maria',
        note: 'Rezadas no fim do terço, em honra da pureza de Nossa Senhora.',
        text: `Avé Maria, Filha de Deus Pai, cheia de graça…

Avé Maria, Mãe de Deus Filho, cheia de graça…

Avé Maria, Esposa de Deus Espírito Santo, cheia de graça…

V. Ó Maria, concebida sem pecado,
R. rogai por nós que recorremos a vós.`,
    },
    {
        id: 'bendita-a-vossa-pureza',
        title: 'Bendita a vossa pureza',
        category: 'maria',
        text: `Bendita a vossa pureza,
eternamente bendita.
Até Deus quer ter a dita
de ver a vossa beleza.

A vós, celeste princesa,
ó Virgem Santa Maria,
vos ofereço neste dia
alma, vida e coração.
Ajudai com compaixão
o filho que em vós confia.`,
    },
    {
        id: 'alma-redemptoris-mater',
        title: 'Santa Mãe do Redentor',
        category: 'maria',
        note: 'Antífona mariana do Advento e do Natal.',
        aka: ['Alma Redemptoris Mater'],
        text: `Santa Mãe do Redentor,
porta do céu, estrela do mar,
socorrei o povo cristão
que procura levantar-se do abismo da culpa.

Vós que, acolhendo a saudação do Anjo,
gerastes, com admiração da natureza,
o vosso santo Criador,
ó sempre Virgem Maria,
tende misericórdia dos pecadores.`,
        latin: `Alma Redemptóris Mater,
quæ pérvia cæli porta manes, et stella maris,
succúrre cadénti, súrgere qui curat, pópulo:
tu quæ genuísti, natúra miránte,
tuum sanctum Genitórem,
Virgo prius ac postérius,
Gabriélis ab ore sumens illud Ave,
peccatórum miserére.`,
    },
    {
        id: 'ave-regina-caelorum',
        title: 'Deus Vos salve, Rainha dos céus',
        category: 'maria',
        note: 'Antífona mariana da Quaresma.',
        aka: ['Ave Regina caelorum'],
        text: `Deus Vos salve, Rainha dos céus,
Deus Vos salve, Senhora dos Anjos,
Deus Vos salve, raiz e porta
por onde veio a luz ao mundo.

Alegrai-Vos, ó Virgem gloriosa,
a mais bela entre todas as mulheres.
Santa Mãe de Deus,
intercedei por nós diante de vosso Filho.`,
        latin: `Ave, Regína cælórum,
ave, Dómina angelórum,
salve, radix, salve, porta,
ex qua mundo lux est orta.

Gaude, Virgo gloriósa,
super omnes speciósa;
vale, o valde decóra,
et pro nobis Christum exóra.`,
    },
    {
        id: 'ave-maris-stella',
        title: 'Avé, Estrela do mar',
        category: 'maria',
        note: 'Hino das Vésperas das festas de Nossa Senhora.',
        aka: ['Ave Maris Stella'],
        text: `Avé, Estrela do mar,
Avé, Mãe de Deus,
Virgem para sempre,
porta ditosa dos céus.

De Gabriel, o Arcanjo,
aquele «Ave» tomando,
concedei ao mundo a paz,
de Eva o nome trocando.

Aos réus dissolvei as algemas,
aos cegos concedei a luz.
Repeli de nós os males,
alcançai-nos o que ao céu conduz.

Mostrai-Vos nossa Mãe:
por Vós subam ao céu as nossas preces,
até Aquele que, por nós nascido,
quis ser o vosso Filho.

Virgem entre todas singular,
mais suave do que todas,
dissolvei as nossas culpas,
fazei-nos mansos e puros.

Dai-nos uma vida serena
e um caminho seguro,
para que, vendo Jesus,
com Ele nos alegremos.

Glória seja dada ao Pai,
honra a Cristo Senhor
e ao Espírito Santo:
aos três, um só louvor.
Amen.`,
        latin: `Ave, maris stella,
Dei mater alma,
atque semper virgo,
felix cæli porta.

Sumens illud «Ave»
Gabriélis ore,
funda nos in pace,
mutans Evæ nomen.

Solve vincla reis,
profer lumen cæcis,
mala nostra pelle,
bona cuncta posce.

Monstra te esse matrem,
sumat per te preces
qui pro nobis natus
tulit esse tuus.

Virgo singuláris,
inter omnes mitis,
nos culpis solútos
mites fac et castos.

Vitam præsta puram,
iter para tutum,
ut vidéntes Iesum
semper collætémur.

Sit laus Deo Patri,
summo Christo decus,
Spirítui Sancto
tribus honor unus.
Amen.`,
    },
    {
        id: 'saudacao-a-virgem-maria',
        title: 'Saudação à Virgem Maria',
        category: 'maria',
        note: 'De São Francisco de Assis.',
        text: `Salve, ó Senhora santa, Rainha santíssima,
Mãe de Deus, ó Maria,
que sois virgem feita igreja,
eleita pelo santíssimo Pai do céu,
que vos consagrou com o seu santíssimo e dilecto Filho
e com o Espírito Santo Paráclito.
Em vós residiu e reside toda a plenitude da graça e todo o bem.

Salve, ó palácio do Senhor.
Salve, ó tabernáculo do Senhor.
Salve, ó morada do Senhor.
Salve, ó manto do Senhor.
Salve, ó serva do Senhor.
Salve, ó Mãe do Senhor.

E salve, vós todas, ó santas virtudes,
derramadas, pela graça e iluminação do Espírito Santo,
nos corações dos fiéis,
transformando-os de infiéis em fiéis servos de Deus.
Amen.`,
    },
    {
        id: 'ave-mae-de-deus',
        title: 'Avé, Mãe de Deus',
        category: 'maria',
        note: 'De São Cirilo de Alexandria, no Concílio de Éfeso (431); texto da Liturgia das Horas.',
        aka: ['Nós Vos saudamos ó Maria', 'São Cirilo', 'Éfeso'],
        text: `Nós Vos saudamos, ó Maria, Mãe de Deus,
venerando tesouro de toda a terra,
lâmpada inextinguível,
coroa da virgindade,
ceptro da doutrina verdadeira,
templo indestrutível,
morada d'Aquele que nenhum lugar pode conter,
Mãe e Virgem,
por meio da qual nos santos Evangelhos
é chamado bendito O que vem em nome do Senhor.

Nós Vos saudamos, ó Maria,
que trouxestes no vosso seio virginal
Aquele que é imenso e infinito;
por Vós, a santa Trindade é glorificada e adorada;
por Vós, a cruz preciosa é adorada no mundo inteiro;
por Vós, o Céu exulta;
por Vós, alegram-se os Anjos e os Arcanjos;
por Vós, a criatura decaída é elevada ao Céu;
por Vós, todo o género humano
chega ao conhecimento da verdade;
por Vós, o santo Baptismo purifica os crentes;
por Vós, são fundadas as Igrejas em toda a terra;
por Vós, os povos são conduzidos à penitência.

Quem de entre os homens é capaz
de celebrar dignamente os louvores de Maria?
Ela é Mãe e Virgem:
oh realidade admirável, oh surpreendente maravilha!
Amen.`,
    },
    {
        id: 'nossa-senhora-da-conceicao',
        title: 'A Nossa Senhora da Conceição',
        category: 'maria',
        note: 'Padroeira de Portugal desde 1646, por juramento de D. João IV.',
        aka: ['Imaculada Conceição', 'Padroeira de Portugal'],
        text: `Virgem Santíssima,
que fostes concebida sem o pecado original
e por isso mereceis o título
de Nossa Senhora da Imaculada Conceição,
e que, por terdes evitado todos os outros pecados,
fostes saudada pelo Anjo Gabriel
com aquelas palavras: «Avé Maria, cheia de graça»:

alcançai-nos do vosso divino Filho
o auxílio necessário
para vencermos as tentações e evitarmos o pecado;
e, já que vos chamamos Mãe,
atendei-nos com carinho maternal
e ajudai-nos a viver como dignos filhos vossos.

Nossa Senhora da Conceição, Padroeira de Portugal,
rogai por nós.
Amen.`,
    },
    {
        id: 'nossa-senhora-do-rosario',
        title: 'A Nossa Senhora do Rosário',
        category: 'maria',
        text: `Nossa Senhora do Rosário,
dai a todos os cristãos a graça
de compreender a grandeza desta devoção,
na qual, à recitação da Avé Maria,
se junta a meditação profunda
dos santos mistérios da vida, morte
e ressurreição de Jesus, vosso Filho e nosso Redentor.

São Domingos, apóstolo do Rosário,
acompanhai-nos com a vossa bênção
na recitação do terço,
para que, por meio desta devoção a Maria,
cheguemos mais depressa a Jesus,
e, como na batalha de Lepanto,
Nossa Senhora do Rosário nos leve à vitória
em todas as lutas da vida.
Amen.`,
    },
];
