import type { Prayer } from './types';

/** To the Lord himself: the Eucharist, the Sacred Heart, and the prayers the
    doctors of the Church left for before and after Communion. */
export const SENHOR: Prayer[] = [
    {
        id: 'alma-de-cristo',
        title: 'Alma de Cristo',
        category: 'senhor',
        note: 'Acção de graças depois da comunhão.',
        aka: ['Anima Christi', 'Alma de Cristo santificai-me'],
        text: `Alma de Cristo, santificai-me.
Corpo de Cristo, salvai-me.
Sangue de Cristo, inebriai-me.
Água do lado de Cristo, lavai-me.
Paixão de Cristo, confortai-me.
Ó bom Jesus, ouvi-me.
Dentro das vossas chagas, escondei-me.
Não permitais que me separe de Vós.
Do espírito maligno, defendei-me.
Na hora da minha morte, chamai-me.
E mandai-me ir para Vós,
para que Vos louve com os vossos Santos,
por todos os séculos dos séculos.
Amen.`,
        latin: `Ánima Christi, sanctífica me.
Corpus Christi, salva me.
Sanguis Christi, inébria me.
Aqua láteris Christi, lava me.
Pássio Christi, confórta me.
O bone Iesu, exáudi me.
Intra tua vúlnera abscónde me.
Ne permíttas me separári a te.
Ab hoste malígno defénde me.
In hora mortis meæ voca me.
Et iube me veníre ad te,
ut cum Sanctis tuis laudem te
in sǽcula sæculórum.
Amen.`,
    },
    {
        id: 'visita-ao-santissimo',
        title: 'Visita ao Santíssimo',
        category: 'senhor',
        note: 'Ao entrar numa igreja, diante do sacrário.',
        // No `latin` field: the Latin custom uses a different acclamation
        // rather than a translation of this one, and the reading view would
        // present it as though it were the same words.
        text: `V. Graças e louvores se dêem a todo o momento
R. ao Santíssimo e diviníssimo Sacramento.

Pai Nosso, Avé Maria e Glória (três vezes).

Em latim reza-se, com a mesma intenção:

V. Adorémus in ætérnum Sanctíssimum Sacraméntum.
R. Adorémus in ætérnum Sanctíssimum Sacraméntum.

Pater noster, Ave María, Glória Patri (ter).`,
    },
    {
        id: 'comunhao-espiritual',
        title: 'Comunhão espiritual',
        category: 'senhor',
        note: 'Quando não é possível comungar sacramentalmente.',
        text: `Eu quisera, Senhor, receber-Vos
com aquela pureza, humildade e devoção
com que Vos recebeu a vossa Santíssima Mãe,
com o espírito e o fervor dos Santos.

Ou:

Creio, meu Jesus, que estais realmente presente
no Santíssimo Sacramento do altar.
Amo-Vos sobre todas as coisas
e desejo receber-Vos na minha alma.
Mas, como agora não Vos posso receber sacramentalmente,
vinde, pelo menos espiritualmente, ao meu coração.
Como se já Vos tivesse recebido,
abraço-Vos e me uno todo a Vós.
Não permitais, Senhor, que nunca me separe de Vós.
Amen.`,
    },
    {
        id: 'antes-da-comunhao-tomas',
        title: 'Antes da comunhão',
        category: 'senhor',
        note: 'De São Tomás de Aquino.',
        aka: ['Ó Deus eterno e todo-poderoso', 'Preparação para a comunhão'],
        text: `Ó Deus eterno e todo-poderoso,
eis que me aproximo do sacramento
do vosso Filho único, Nosso Senhor Jesus Cristo.
Impuro, venho à fonte da misericórdia;
cego, à luz da eterna claridade;
pobre e indigente, ao Senhor do céu e da terra.

Imploro, pois, a abundância da vossa liberalidade,
para que Vos digneis curar a minha fraqueza,
lavar as minhas manchas,
iluminar a minha cegueira,
enriquecer a minha pobreza,
vestir a minha nudez.

Que eu receba o Pão dos Anjos,
o Rei dos reis e o Senhor dos senhores,
com o respeito e a humildade,
a contrição e a devoção,
a pureza e a fé,
o propósito e a intenção
que convêm à salvação da minha alma.

Concedei-me que receba
não só o sacramento do Corpo e Sangue do Senhor,
mas também o seu efeito e a sua força.

Ó Deus de mansidão,
fazei-me acolher com tais disposições
o Corpo que o vosso Filho único, Nosso Senhor Jesus Cristo,
recebeu da Virgem Maria,
para que eu seja incorporado ao seu Corpo místico
e contado entre os seus membros.

Ó Pai cheio de amor,
fazei que, recebendo agora o vosso Filho
sob o véu do sacramento,
possa na eternidade contemplá-Lo face a face.
Amen.`,
    },
    {
        id: 'depois-da-comunhao-tomas',
        title: 'Depois da comunhão',
        category: 'senhor',
        note: 'De São Tomás de Aquino.',
        aka: ['Dou-Vos graças', 'Acção de graças'],
        text: `Dou-Vos graças, Senhor santo,
Pai omnipotente, Deus eterno,
que Vos dignastes saciar-me,
sendo eu pecador e vosso indigno servo,
não por mérito algum meu,
mas por efeito da vossa misericórdia,
com o Corpo adorável e o Sangue precioso
do vosso Filho, Nosso Senhor Jesus Cristo.

Peço-Vos que esta comunhão
não me seja imputada como culpa,
mas interceda eficazmente pelo meu perdão;
seja armadura da minha fé
e escudo da minha boa vontade;
livre-me dos meus vícios,
extinga em mim a concupiscência e os maus desejos;
aumente em mim a caridade e a paciência,
a humildade, a obediência e todas as virtudes;
seja firme defesa contra as ciladas de todos os inimigos,
visíveis e invisíveis;
pacifique perfeitamente os movimentos
da minha carne e do meu espírito;
e una-me firmemente a Vós,
que sois o único e verdadeiro Deus,
feliz consumação do meu destino.

Dignai-Vos, Senhor, conduzir-me,
a mim pecador, àquele banquete inefável
onde, com o vosso Filho e o Espírito Santo,
sois para os vossos Santos
luz verdadeira, plena satisfação e alegria eterna.
Pelo mesmo Cristo, Nosso Senhor.
Amen.`,
    },
    {
        id: 'oracao-de-santo-ambrosio',
        title: 'Oração de Santo Ambrósio',
        category: 'senhor',
        note: 'Preparação para a Missa.',
        text: `Senhor Jesus Cristo,
eu, pecador, não presumindo dos meus méritos
mas confiando na vossa bondade e misericórdia,
temo e hesito em aproximar-me
da mesa do vosso doce convívio.
Pois o meu corpo e o meu coração
estão manchados por muitas faltas,
e não guardei com cuidado
o meu espírito e a minha língua.

Por isso, ó bondade divina e temível majestade,
na minha miséria recorro a Vós, fonte de misericórdia;
corro para junto de Vós a fim de ser curado,
refugio-me na vossa protecção,
e anseio ter como Salvador
Aquele que não posso suportar como Juiz.

Senhor, eu Vos mostro as minhas chagas
e Vos revelo a minha vergonha.
Sei que os meus pecados são muitos e grandes,
e temo por causa deles,
mas espero na vossa infinita misericórdia.

Olhai-me, pois, com os vossos olhos misericordiosos,
Senhor Jesus Cristo, Rei eterno,
Deus e homem, crucificado por causa do homem.
Escutai-me, pois espero em Vós;
tende piedade de mim, cheio de misérias e pecados,
Vós que jamais deixareis de ser para nós
a fonte da compaixão.

Salve, vítima salvadora,
oferecida no patíbulo da Cruz
por mim e por todos os homens.
Salve, nobre e precioso Sangue,
que brotas das chagas do meu Senhor Jesus Cristo crucificado
e lavas os pecados do mundo inteiro.

Lembrai-Vos, Senhor, da vossa criatura
resgatada pelo vosso Sangue.
Arrependo-me de ter pecado
e desejo reparar o que fiz.

Livrai-me, ó Pai clementíssimo,
de todas as minhas iniquidades e pecados,
para que, inteiramente purificado,
mereça participar dos santos mistérios.

E concedei que o vosso Corpo e o vosso Sangue,
que eu, embora indigno, me preparo para receber,
sejam perdão para os meus pecados
e completa purificação das minhas faltas.
Que eles afastem de mim os pensamentos maus
e despertem os bons sentimentos;
tornem eficazes as obras que Vos agradam
e protejam o meu corpo e a minha alma
contra as ciladas dos meus inimigos.
Amen.`,
    },
    {
        id: 'oracao-de-sao-boaventura',
        title: 'Oração de São Boaventura',
        category: 'senhor',
        note: 'Acção de graças depois da comunhão.',
        aka: ['Trespassai dulcíssimo Senhor Jesus'],
        text: `Trespassai, dulcíssimo Senhor Jesus,
a medula da minha alma
com o suave e salutar dardo do vosso amor,
com a verdadeira, pura e santíssima caridade apostólica,
a fim de que a minha alma
sempre desfaleça só com o amor e o desejo de Vos possuir,
Vos deseje e desfaleça nos vossos átrios,
e anseie por deixar tudo para estar convosco.

Fazei que a minha alma tenha fome de Vós,
Pão dos Anjos, alimento das almas santas,
a Quem os Anjos desejam contemplar,
pão nosso de cada dia,
cheio de força, de toda a doçura e sabor.

Tenha sempre sede de Vós,
fonte de vida, manancial de sabedoria e de ciência,
rio de luz eterna, torrente de delícias,
riqueza da casa de Deus.
Que Vos deseje, Vos procure, Vos encontre;
que para Vós caminhe e a Vós chegue;
que em Vós pense, de Vós fale,
e todas as minhas acções encaminhe
para a honra e glória do vosso nome,
com humildade e discrição,
com amor e deleite, com perseverança até ao fim;

para que sejais sempre a minha esperança,
o meu gozo, o meu descanso e a minha paz,
a minha doçura, o meu alimento,
o meu refúgio, o meu auxílio,
a minha sabedoria, a minha herança e o meu tesouro,
no qual estejam sempre firmemente arraigados
a minha alma e o meu coração.
Amen.`,
    },
    {
        id: 'eis-me-aqui-o-bom-jesus',
        title: 'Oração diante do Crucifixo',
        category: 'senhor',
        note: 'Rezada de joelhos diante da imagem de Cristo crucificado.',
        aka: ['Eis-me aqui ó bom e dulcíssimo Jesus', 'En ego'],
        text: `Eis-me aqui, ó bom e dulcíssimo Jesus,
de joelhos diante da vossa divina presença.

Com o mais ardente fervor da minha alma,
Vos peço e suplico
que Vos digneis gravar no meu coração
profundos sentimentos de fé, de esperança e de caridade,
verdadeiro arrependimento dos meus pecados
e firmíssima vontade de me emendar,

enquanto, com sincero afecto e íntima dor,
considero e medito nas vossas cinco chagas,
tendo presentes aquelas palavras
que já o profeta David dizia de Vós, ó bom Jesus:
«Trespassaram as minhas mãos e os meus pés
e contaram todos os meus ossos.»
Amen.`,
    },
    {
        id: 'adoro-te-devote',
        title: 'Adoro-Vos com devoção',
        category: 'senhor',
        note: 'Hino eucarístico de São Tomás de Aquino.',
        aka: ['Adoro te devote', 'Deus escondido'],
        text: `Adoro-Vos com devoção, Deus escondido,
que sob estas aparências estais presente.
A Vós se submete o meu coração por inteiro
e, ao contemplar-Vos, rende-se totalmente.

A vista, o tacto e o gosto sobre Vós se enganam,
mas basta o ouvido para crer com firmeza.
Creio em tudo o que disse o Filho de Deus;
nada é mais verdadeiro que esta palavra de verdade.

Na Cruz estava oculta só a divindade,
mas aqui esconde-se também a humanidade;
creio, porém, e confesso uma e outra,
e peço o que pediu o ladrão arrependido.

Não vejo as chagas, como Tomé as viu,
mas confesso que sois o meu Deus.
Fazei que eu creia sempre mais em Vós,
que em Vós espere e que Vos ame.

Ó memorial da morte do Senhor!
Ó Pão vivo que dais a vida ao homem!
Que a minha alma sempre de Vós viva
e sempre lhe seja doce o vosso sabor.

Bom pelicano, Senhor Jesus,
limpai-me a mim, imundo, com o vosso Sangue,
Sangue do qual uma só gota
pode salvar o mundo inteiro.

Jesus, a quem agora contemplo escondido,
rogo-Vos que se cumpra o que tanto desejo:
que, ao contemplar-Vos face a face,
seja eu feliz vendo a vossa glória.
Amen.`,
        latin: `Adóro te devóte, latens Déitas,
quæ sub his figúris vere látitas.
Tibi se cor meum totum súbiicit,
quia te contémplans totum déficit.

Visus, tactus, gustus in te fállitur,
sed audítu solo tuto créditur.
Credo quidquid dixit Dei Fílius;
nil hoc verbo Veritátis vérius.

In cruce latébat sola Déitas,
at hic latet simul et humánitas;
ambo tamen credens atque cónfitens,
peto quod petívit latro pænitens.

Plagas, sicut Thomas, non intúeor,
Deum tamen meum te confíteor.
Fac me tibi semper magis crédere,
in te spem habére, te dilígere.

O memoriále mortis Dómini,
panis vivus vitam præstans hómini,
præsta meæ menti de te vívere
et te illi semper dulce sápere.

Pie pellicáne, Iesu Dómine,
me immúndum munda tuo sánguine,
cuius una stilla salvum fácere
totum mundum quit ab omni scélere.

Iesu, quem velátum nunc aspício,
oro fiat illud quod tam sítio:
ut te reveláta cernens fácie,
visu sim beátus tuæ glóriæ.
Amen.`,
    },
    {
        id: 'tantum-ergo',
        title: 'Tantum ergo',
        category: 'senhor',
        note: 'Cantado na bênção do Santíssimo; últimas estrofes do Pange lingua.',
        aka: ['Pange lingua', 'Bênção do Santíssimo', 'Veneremos adoremos'],
        text: `Veneremos, adoremos
a presença do Senhor,
nossa luz e Pão da vida.
Cante a alma o seu louvor.
Adoremos no sacrário
Deus oculto por amor.

Demos glória ao Pai do céu,
infinita majestade,
glória ao Filho e ao Espírito Santo.
Em espírito e verdade,
veneremos, adoremos
a Santíssima Trindade.
Amen.

V. Vós sois o Pão que desceu do céu.
R. Para dar vida ao mundo.

Oremos:
Ó Deus, que neste admirável sacramento
nos deixastes o memorial da vossa Paixão,
dai-nos venerar com tão grande amor
o mistério do vosso Corpo e do vosso Sangue,
que possamos colher continuamente
os frutos da vossa Redenção.
Vós que viveis e reinais pelos séculos dos séculos.
R. Amen.`,
        latin: `Tantum ergo Sacraméntum
venerémur cérnui,
et antíquum documéntum
novo cedat rítui;
præstet fides suppleméntum
sénsuum deféctui.

Genitóri Genitóque
laus et iubilátio,
salus, honor, virtus quoque
sit et benedíctio;
procedénti ab utróque
compar sit laudátio.
Amen.

V. Panem de cælo præstitísti eis.
R. Omne delectaméntum in se habéntem.`,
    },
    {
        id: 'ladainha-do-sagrado-coracao',
        title: 'Ladainha do Sagrado Coração de Jesus',
        category: 'senhor',
        note: 'Aprovada por Leão XIII em 1899; reza-se sobretudo em Junho.',
        aka: ['Coração de Jesus', 'Ladainha do Coração de Jesus'],
        text: `Senhor, tende piedade de nós.
Jesus Cristo, tende piedade de nós.
Senhor, tende piedade de nós.
Jesus Cristo, ouvi-nos.
Jesus Cristo, atendei-nos.

Deus Pai do céu, tende piedade de nós.
Deus Filho, Redentor do mundo, tende piedade de nós.
Deus Espírito Santo, tende piedade de nós.
Santíssima Trindade, que sois um só Deus, tende piedade de nós.

Coração de Jesus, Filho do Pai eterno, tende piedade de nós.
Coração de Jesus, formado pelo Espírito Santo no seio da Virgem Mãe,
Coração de Jesus, unido substancialmente ao Verbo de Deus,
Coração de Jesus, de majestade infinita,
Coração de Jesus, templo santo de Deus,
Coração de Jesus, tabernáculo do Altíssimo,
Coração de Jesus, casa de Deus e porta do céu,
Coração de Jesus, fornalha ardente de caridade,
Coração de Jesus, receptáculo de justiça e de amor,
Coração de Jesus, cheio de bondade e de amor,
Coração de Jesus, abismo de todas as virtudes,
Coração de Jesus, digníssimo de todo o louvor,
Coração de Jesus, rei e centro de todos os corações,
Coração de Jesus, no qual estão todos os tesouros da sabedoria e da ciência,
Coração de Jesus, no qual habita toda a plenitude da divindade,
Coração de Jesus, no qual o Pai pôs as suas complacências,
Coração de Jesus, de cuja plenitude todos nós recebemos,
Coração de Jesus, desejo das colinas eternas,
Coração de Jesus, paciente e misericordioso,
Coração de Jesus, rico para todos os que Vos invocam,
Coração de Jesus, fonte de vida e de santidade,
Coração de Jesus, propiciação pelos nossos pecados,
Coração de Jesus, saturado de opróbrios,
Coração de Jesus, atribulado por causa dos nossos crimes,
Coração de Jesus, feito obediente até à morte,
Coração de Jesus, atravessado pela lança,
Coração de Jesus, fonte de toda a consolação,
Coração de Jesus, nossa vida e ressurreição,
Coração de Jesus, nossa paz e reconciliação,
Coração de Jesus, vítima dos pecadores,
Coração de Jesus, salvação dos que em Vós esperam,
Coração de Jesus, esperança dos que em Vós expiram,
Coração de Jesus, delícia de todos os Santos, tende piedade de nós.

Cordeiro de Deus, que tirais os pecados do mundo, perdoai-nos, Senhor.
Cordeiro de Deus, que tirais os pecados do mundo, ouvi-nos, Senhor.
Cordeiro de Deus, que tirais os pecados do mundo, tende piedade de nós.

V. Jesus, manso e humilde de coração,
R. fazei o nosso coração semelhante ao vosso.

Oremos:
Deus omnipotente e eterno,
olhai para o Coração do vosso diletíssimo Filho
e para os louvores e satisfações
que Ele Vos oferece em nome dos pecadores;
e, aplacado, concedei o perdão aos que imploram a vossa misericórdia,
em nome do mesmo vosso Filho Jesus Cristo,
que convosco vive e reina pelos séculos dos séculos.
R. Amen.`,
    },
    {
        id: 'consagracao-ao-sagrado-coracao',
        title: 'Consagração ao Sagrado Coração de Jesus',
        category: 'senhor',
        note: 'De Leão XIII, na consagração do género humano.',
        aka: ['Dulcíssimo Jesus Redentor'],
        text: `Dulcíssimo Jesus, Redentor do género humano,
lançai sobre nós os vossos olhares,
que humildemente estamos prostrados diante do vosso altar.
Nós somos e queremos ser vossos;
e, a fim de podermos viver mais intimamente unidos a Vós,
cada um de nós se consagra hoje espontaneamente
ao vosso Sacratíssimo Coração.

Muitos há que nunca Vos conheceram;
muitos, desprezando os vossos mandamentos, Vos renegaram.
Benigníssimo Jesus, tende piedade de uns e de outros
e trazei-os todos ao vosso Sagrado Coração.

Senhor, sede Rei não somente dos fiéis
que nunca de Vós se afastaram,
mas também dos filhos pródigos que Vos abandonaram;
fazei que estes voltem quanto antes à casa paterna,
para que não pereçam de miséria e de fome.

Conservai incólume a vossa Igreja e dai-lhe liberdade segura;
concedei ordem e paz a todos os povos;
fazei que de um pólo ao outro do mundo ressoe uma só voz:
louvado seja o Coração divino que nos trouxe a salvação;
a Ele honra e glória por todos os séculos dos séculos.
Amen.`,
    },
    {
        id: 'ladainha-do-santissimo-nome',
        title: 'Ladainha do Santíssimo Nome de Jesus',
        category: 'senhor',
        note: 'Reza-se sobretudo em Janeiro.',
        aka: ['Santíssimo Nome', 'Nome de Jesus'],
        text: `Senhor, tende piedade de nós.
Jesus Cristo, tende piedade de nós.
Senhor, tende piedade de nós.
Jesus Cristo, ouvi-nos.
Jesus Cristo, atendei-nos.

Deus Pai do céu, tende piedade de nós.
Deus Filho, Redentor do mundo, tende piedade de nós.
Deus Espírito Santo, tende piedade de nós.
Santíssima Trindade, que sois um só Deus, tende piedade de nós.

Jesus, Filho do Deus vivo, tende piedade de nós.
Jesus, esplendor do Pai,
Jesus, pureza da luz eterna,
Jesus, Rei da glória,
Jesus, sol de justiça,
Jesus, Filho da Virgem Maria,
Jesus amável,
Jesus admirável,
Jesus, Deus forte,
Jesus, Pai do século futuro,
Jesus, anjo do grande conselho,
Jesus poderosíssimo,
Jesus pacientíssimo,
Jesus obedientíssimo,
Jesus, manso e humilde de coração,
Jesus, amante da castidade,
Jesus, nosso amado,
Jesus, Deus da paz,
Jesus, autor da vida,
Jesus, exemplar das virtudes,
Jesus, zelador das almas,
Jesus, nosso Deus,
Jesus, nosso refúgio,
Jesus, Pai dos pobres,
Jesus, tesouro dos fiéis,
Jesus, bom Pastor,
Jesus, luz verdadeira,
Jesus, sabedoria eterna,
Jesus, bondade infinita,
Jesus, nosso caminho e nossa vida,
Jesus, alegria dos Anjos,
Jesus, Rei dos Patriarcas,
Jesus, Mestre dos Apóstolos,
Jesus, Doutor dos Evangelistas,
Jesus, fortaleza dos Mártires,
Jesus, luz dos Confessores,
Jesus, pureza das Virgens,
Jesus, coroa de todos os Santos, tende piedade de nós.

Sede-nos propício: perdoai-nos, Jesus.
Sede-nos propício: ouvi-nos, Jesus.

De todo o mal, livrai-nos, Jesus.
De todo o pecado, livrai-nos, Jesus.
Da vossa ira, livrai-nos, Jesus.
Das ciladas do demónio, livrai-nos, Jesus.
Do espírito de impureza, livrai-nos, Jesus.
Da morte eterna, livrai-nos, Jesus.
Do desprezo das vossas inspirações, livrai-nos, Jesus.

Pelo mistério da vossa santa Encarnação, livrai-nos, Jesus.
Pela vossa Natividade, livrai-nos, Jesus.
Pela vossa infância, livrai-nos, Jesus.
Pela vossa vida santíssima, livrai-nos, Jesus.
Pelos vossos trabalhos, livrai-nos, Jesus.
Pela vossa agonia e Paixão, livrai-nos, Jesus.
Pela vossa cruz e desamparo, livrai-nos, Jesus.
Pelas vossas angústias, livrai-nos, Jesus.
Pela vossa morte e sepultura, livrai-nos, Jesus.
Pela vossa Ressurreição, livrai-nos, Jesus.
Pela vossa Ascensão, livrai-nos, Jesus.
Pela instituição da Santíssima Eucaristia, livrai-nos, Jesus.
Pelas vossas alegrias, livrai-nos, Jesus.
Pela vossa glória, livrai-nos, Jesus.

Cordeiro de Deus, que tirais os pecados do mundo, perdoai-nos, Jesus.
Cordeiro de Deus, que tirais os pecados do mundo, ouvi-nos, Jesus.
Cordeiro de Deus, que tirais os pecados do mundo, tende piedade de nós.

V. Jesus, ouvi-nos.
R. Jesus, atendei-nos.

Oremos:
Senhor Jesus Cristo, que dissestes:
«Pedi e recebereis; procurai e achareis; batei e abrir-se-vos-á»,
concedei-nos, Vos pedimos, o afecto do vosso divino amor,
para que Vos amemos de todo o coração,
com as palavras e com as obras,
e nunca cessemos de Vos louvar.
Vós que viveis e reinais pelos séculos dos séculos.
R. Amen.`,
    },
    {
        id: 'ladainha-da-humildade',
        title: 'Ladainha da Humildade',
        category: 'senhor',
        note: 'Do Cardeal Rafael Merry del Val, que a rezava depois da Missa.',
        aka: ['Merry del Val', 'Humildade'],
        text: `Ó Jesus, manso e humilde de coração, ouvi-me.

Do desejo de ser estimado, livrai-me, Jesus.
Do desejo de ser amado, livrai-me, Jesus.
Do desejo de ser procurado, livrai-me, Jesus.
Do desejo de ser honrado, livrai-me, Jesus.
Do desejo de ser louvado, livrai-me, Jesus.
Do desejo de ser preferido, livrai-me, Jesus.
Do desejo de ser consultado, livrai-me, Jesus.
Do desejo de ser aprovado, livrai-me, Jesus.

Do receio de ser humilhado, livrai-me, Jesus.
Do receio de ser desprezado, livrai-me, Jesus.
Do receio de sofrer repulsas, livrai-me, Jesus.
Do receio de ser caluniado, livrai-me, Jesus.
Do receio de ser esquecido, livrai-me, Jesus.
Do receio de ser ridicularizado, livrai-me, Jesus.
Do receio de ser injustiçado, livrai-me, Jesus.
Do receio de ser suspeitado, livrai-me, Jesus.

Que os outros sejam mais amados do que eu,
Jesus, dai-me a graça de o desejar.
Que os outros sejam mais estimados do que eu,
Jesus, dai-me a graça de o desejar.
Que os outros cresçam na opinião do mundo e eu diminua,
Jesus, dai-me a graça de o desejar.
Que os outros sejam escolhidos e eu posto de lado,
Jesus, dai-me a graça de o desejar.
Que os outros sejam louvados e eu esquecido,
Jesus, dai-me a graça de o desejar.
Que os outros sejam preferidos a mim em tudo,
Jesus, dai-me a graça de o desejar.
Que os outros sejam mais santos do que eu,
contanto que eu seja santo quanto puder,
Jesus, dai-me a graça de o desejar.
Amen.`,
    },
    {
        id: 'oracao-universal-clemente-xi',
        title: 'Oração Universal',
        category: 'senhor',
        note: 'Do Papa Clemente XI.',
        aka: ['Clemente XI', 'Senhor creio em Vós'],
        text: `Senhor, creio em Vós: fazei que creia com mais firmeza;
espero em Vós: fazei que espere com mais confiança;
amo-Vos: aumentai o meu amor;
arrependo-me: avivai a minha dor.

Adoro-Vos como primeiro princípio;
desejo-Vos como último fim;
exalto-Vos como benfeitor perpétuo;
invoco-Vos como defensor propício.

Dirigi-me com a vossa sabedoria;
atai-me com a vossa justiça;
consolai-me com a vossa clemência;
protegei-me com o vosso poder.

Ofereço-Vos os meus pensamentos, para que se dirijam a Vós;
as minhas palavras, para que falem de Vós;
as minhas obras, para que sejam vossas;
as minhas contrariedades, para que as aceite por Vós.

Quero o que quereis,
quero porque o quereis,
quero como o quereis,
quero enquanto o quiserdes.

Senhor, peço-Vos que ilumineis a minha mente,
inflameis a minha vontade,
limpeis o meu coração,
santifiqueis a minha alma.

Que me afaste das faltas passadas,
rejeite as tentações futuras,
corrija as más inclinações,
pratique as virtudes necessárias.

Concedei-me, Deus de bondade,
amor por Vós,
ódio por mim,
zelo pelo próximo,
desprezo pelo mundano.

Que saiba obedecer aos superiores,
ajudar os inferiores,
acolher os amigos,
perdoar os inimigos.

Que vença a sensualidade com a mortificação,
a avareza com a generosidade,
a ira com a bondade,
a tibieza com a piedade.

Fazei-me prudente nos conselhos,
constante nos perigos,
paciente nas contrariedades,
humilde na prosperidade.

Fazei-me atento na oração,
sóbrio na comida,
perseverante no trabalho,
firme nos propósitos.

Que procure ter inocência interior,
modéstia exterior,
conversa exemplar,
vida ordenada.

Que lute para dominar a minha natureza,
fomentar a graça,
servir a vossa lei
e obter a salvação.

Que aprenda de Vós
como é pouco o terreno,
como é grande o divino,
como é breve o tempo,
como é duradouro o eterno.

Fazei-me preparar a morte,
temer o juízo,
evitar o inferno
e alcançar o paraíso.
Por Cristo, Nosso Senhor.
Amen.`,
    },
    {
        id: 'que-eu-chegue-a-ti',
        title: 'Que eu chegue a Ti, Senhor',
        category: 'senhor',
        note: 'De São Tomás de Aquino.',
        text: `Que eu chegue a Ti, Senhor,
por um caminho seguro e recto,
que não se desvie nem na prosperidade nem na adversidade,
de tal forma que eu Te dê graças nas horas prósperas e nas adversas
e conserve a paciência,
sem me deixar exaltar pelas primeiras nem abater pelas outras.

Que nada me alegre ou entristeça
senão o que me conduza a Ti ou de Ti me separe.
Que eu não deseje agradar nem receie desagradar senão a Ti.

Tudo o que passa se torne desprezível a meus olhos por tua causa, Senhor,
e tudo o que Te diz respeito me seja caro,
mas Tu, meu Deus, mais do que tudo o resto.
Qualquer alegria sem Ti me seja fastidiosa,
e nada eu deseje fora de Ti.
Qualquer trabalho feito por Ti, Senhor, me seja agradável,
e insuportável aquele de que estiveres ausente.

Concede-me a graça de erguer continuamente o coração a Ti
e, quando eu cair, de me arrepender.

Torna-me, Senhor meu Deus,
obediente, pobre e casto;
paciente, sem reclamação;
humilde, sem fingimento;
alegre, sem dissipação;
triste, sem abatimento;
reservado, sem rigidez;
activo, sem leviandade;
animado pelo temor, sem desânimo;
sincero, sem duplicidade;
fazendo o bem sem presunção;
corrigindo o próximo sem altivez;
edificando-o com palavras e exemplos, sem falsidade.

Dá-me, Senhor meu Deus, um coração vigilante,
que nenhum pensamento curioso arraste para longe de Ti;
um coração nobre, que nenhuma afeição indigna debilite;
um coração recto, que nenhuma intenção equívoca desvie;
um coração firme, que nenhuma adversidade abale;
um coração livre, que nenhuma paixão subjugue.

Concede-me, Senhor meu Deus,
uma inteligência que Te conheça,
uma vontade que Te busque,
uma sabedoria que Te encontre,
uma vida que Te agrade,
uma perseverança que Te espere com confiança
e uma confiança que Te possua, enfim.
Amen.`,
    },
    {
        id: 'nao-me-move',
        title: 'Não me move, meu Deus',
        category: 'senhor',
        note: 'Soneto anónimo do século XVI, atribuído a Santa Teresa de Ávila.',
        aka: ['A Cristo crucificado', 'Não me move'],
        text: `Não me move, meu Deus, para Te amar
o céu que me prometeste,
nem me move o inferno tão temido
para deixar por isso de Te ofender.

Tu me moves, Senhor;
move-me ver-Te pregado numa cruz e escarnecido,
move-me ver o teu corpo tão ferido,
movem-me as tuas afrontas e a tua morte.

Move-me, enfim, o teu amor,
e de tal maneira,
que, ainda que não houvesse céu, eu Te amaria,
e, ainda que não houvesse inferno, Te temeria.

Nada tens que me dar para que eu Te queira,
pois, mesmo que não esperasse o que espero,
o mesmo que Te quero Te quereria.`,
    },
    {
        id: 'tomai-senhor-e-recebei',
        title: 'Tomai, Senhor, e recebei',
        category: 'senhor',
        note: 'De Santo Inácio de Loiola, no fim dos Exercícios.',
        aka: ['Suscipe', 'Santo Inácio'],
        text: `Tomai, Senhor, e recebei
toda a minha liberdade,
a minha memória, o meu entendimento
e toda a minha vontade,
tudo o que tenho e possuo.

Vós mo destes; a Vós, Senhor, o restituo.
Tudo é vosso: disponde de tudo
à vossa inteira vontade.

Dai-me o vosso amor e a vossa graça,
que esta me basta.
Amen.`,
    },
    {
        id: 'oracao-de-sao-bento',
        title: 'Cruz de São Bento',
        category: 'senhor',
        note: 'As palavras gravadas na medalha de São Bento.',
        aka: ['Vade retro', 'Medalha de São Bento'],
        text: `A Cruz sagrada seja a minha luz.
Não seja o dragão o meu guia.
Retira-te, Satanás.
Nunca me aconselhes coisas vãs.
É mau o que me ofereces.
Bebe tu mesmo o teu veneno.`,
        latin: `Crux sacra sit mihi lux.
Non draco sit mihi dux.
Vade retro, Sátana.
Numquam suáde mihi vana.
Sunt mala quæ libas.
Ipse venéna bibas.`,
    },
    {
        id: 'via-sacra',
        title: 'Via-Sacra',
        category: 'senhor',
        note: 'Reza-se sobretudo às sextas-feiras da Quaresma.',
        aka: ['Via Crucis', 'Estações', 'Caminho da Cruz'],
        text: `Em cada estação:

V. Nós Vos adoramos, ó Cristo, e Vos bendizemos.
R. Porque pela vossa santa Cruz remistes o mundo.

Segue-se a meditação, e depois
Pai Nosso, Avé Maria e Glória.

As catorze estações:

I. Jesus é condenado à morte.
II. Jesus é carregado com a cruz.
III. Jesus cai pela primeira vez.
IV. Jesus encontra sua Mãe Santíssima.
V. Simão Cireneu ajuda Jesus a levar a cruz.
VI. Uma mulher piedosa enxuga o rosto de Jesus.
VII. Jesus cai pela segunda vez.
VIII. Jesus consola as mulheres de Jerusalém.
IX. Jesus cai pela terceira vez.
X. Jesus é despojado das suas vestes.
XI. Jesus é pregado na cruz.
XII. Jesus morre na cruz.
XIII. Jesus é descido da cruz e entregue à sua Mãe.
XIV. Jesus é sepultado.

No fim, reza-se pelas intenções do Santo Padre.`,
    },
];
