import type { Prayer } from './types';

/** The hours of an ordinary day: the offering that opens it, the Angelus at
    noon, the Chaplet at three, the examen and the thanksgiving that close it. */
export const DIA: Prayer[] = [
    {
        id: 'oferecimento-do-dia',
        title: 'Oferecimento do dia',
        category: 'dia',
        note: 'Oração da manhã do Apostolado da Oração.',
        aka: ['Oração da manhã', 'Ofereço-Vos'],
        text: `Ofereço-Vos, ó meu Deus,
em união com o Santíssimo Coração de Jesus
e por meio do Coração Imaculado de Maria,
as orações, os trabalhos,
as alegrias e os sofrimentos deste dia,
em reparação de todas as ofensas
e por todas as intenções
pelas quais o mesmo Divino Coração
está continuamente intercedendo
e sacrificando-Se nos nossos altares.
Amen.`,
    },
    {
        id: 'bendita-a-luz-do-dia',
        title: 'Bendita seja a luz do dia',
        category: 'dia',
        note: 'Ao romper do dia, oração antiga do povo português.',
        text: `Bendita seja a luz do dia,
bendito seja Quem tudo cria,
bendito seja o fruto sagrado
da sempre puríssima Virgem Maria.
Amen.`,
    },
    {
        id: 'antes-da-oracao-mental',
        title: 'Antes e depois da oração mental',
        category: 'dia',
        note: 'Para pôr-se na presença de Deus antes de meditar.',
        aka: ['Meditação', 'Oração mental'],
        text: `Ao começar:

Meu Senhor e meu Deus,
creio firmemente que estais aqui,
que me vedes, que me ouvis.
Adoro-Vos com profunda reverência;
peço-Vos perdão dos meus pecados
e graça para fazer com fruto este tempo de oração.

Minha Mãe Imaculada,
São José, meu pai e senhor,
Anjo da minha Guarda,
intercedei por mim.

Ao terminar:

Dou-Vos graças, meu Deus,
pelos bons propósitos, afectos e inspirações
que me comunicastes nesta meditação;
peço-Vos ajuda para os pôr em prática.

Minha Mãe Imaculada,
São José, meu pai e senhor,
Anjo da minha Guarda,
intercedei por mim.`,
    },
    {
        id: 'angelus',
        title: 'Angelus',
        category: 'dia',
        note: 'Ao meio-dia, durante todo o ano excepto no Tempo Pascal.',
        aka: ['Anjo do Senhor', 'Angelus Domini', 'Oração do meio-dia'],
        text: `V. O Anjo do Senhor anunciou a Maria.
R. E Ela concebeu do Espírito Santo.

Avé Maria…

V. Eis aqui a escrava do Senhor.
R. Faça-se em mim segundo a vossa palavra.

Avé Maria…

V. E o Verbo divino encarnou.
R. E habitou entre nós.

Avé Maria…

V. Rogai por nós, santa Mãe de Deus.
R. Para que sejamos dignos das promessas de Cristo.

Oremos:
Infundi, Senhor, nós Vos pedimos,
a vossa graça nas nossas almas,
para que nós, que pela anunciação do Anjo
conhecemos a encarnação de Cristo, vosso Filho,
pela sua Paixão e morte na Cruz
sejamos conduzidos à glória da Ressurreição.
Por Cristo, Nosso Senhor.
R. Amen.`,
        latin: `V. Ángelus Dómini nuntiávit Maríæ.
R. Et concépit de Spíritu Sancto.

Ave, María…

V. Ecce ancílla Dómini.
R. Fiat mihi secúndum verbum tuum.

Ave, María…

V. Et Verbum caro factum est.
R. Et habitávit in nobis.

Ave, María…

V. Ora pro nobis, sancta Dei Génetrix.
R. Ut digni efficiámur promissiónibus Christi.

Orémus:
Grátiam tuam, quǽsumus, Dómine,
méntibus nostris infúnde;
ut qui, Ángelo nuntiánte,
Christi Fílii tui incarnatiónem cognóvimus,
per passiónem eius et crucem
ad resurrectiónis glóriam perducámur.
Per Christum Dóminum nostrum.
R. Amen.`,
    },
    {
        id: 'rainha-do-ceu',
        title: 'Rainha do Céu',
        category: 'dia',
        note: 'Substitui o Angelus durante todo o Tempo Pascal.',
        aka: ['Regina Caeli', 'Regina Coeli', 'Rainha do Céu alegrai-Vos'],
        text: `V. Rainha do Céu, alegrai-Vos, aleluia.
R. Porque Aquele que merecestes trazer em vosso seio, aleluia.
V. Ressuscitou como disse, aleluia.
R. Rogai a Deus por nós, aleluia.

V. Exultai e alegrai-Vos, ó Virgem Maria, aleluia.
R. Porque o Senhor ressuscitou verdadeiramente, aleluia.

Oremos:
Ó Deus, que Vos dignastes alegrar o mundo
com a Ressurreição do vosso Filho Jesus Cristo, Senhor Nosso,
concedei-nos, Vos suplicamos,
que, por sua Mãe, a Virgem Maria,
alcancemos as alegrias da vida eterna.
Por Cristo, Nosso Senhor.
Amen.`,
        latin: `V. Regína cæli, lætáre, allelúia.
R. Quia quem meruísti portáre, allelúia.
V. Resurréxit, sicut dixit, allelúia.
R. Ora pro nobis Deum, allelúia.

V. Gaude et lætáre, Virgo María, allelúia.
R. Quia surréxit Dóminus vere, allelúia.

Orémus:
Deus, qui per resurrectiónem Fílii tui,
Dómini nostri Iesu Christi,
mundum lætificáre dignátus es:
præsta, quǽsumus, ut per eius Genetrícem Vírginem Maríam
perpétuæ capiámus gáudia vitæ.
Per eúmdem Christum Dóminum nostrum.
Amen.`,
    },
    {
        id: 'terco-da-misericordia',
        title: 'Terço da Misericórdia',
        category: 'dia',
        note: 'Reza-se às três da tarde, a hora da morte do Senhor.',
        aka: ['Coroa da Divina Misericórdia', 'Terço da Divina Misericórdia'],
        chapletId: 'divina-misericordia',
        text: `Reza-se nas contas do terço.

No início: Pai Nosso, Avé Maria e Credo.

Nas contas grandes:
Eterno Pai, eu Vos ofereço
o Corpo e Sangue, Alma e Divindade
do vosso diletíssimo Filho,
Nosso Senhor Jesus Cristo,
em expiação dos nossos pecados
e dos do mundo inteiro.

Nas dez contas pequenas:
Pela sua dolorosa Paixão,
tende misericórdia de nós
e do mundo inteiro.

No fim, três vezes:
Deus santo, Deus forte, Deus imortal,
tende piedade de nós e do mundo inteiro.`,
    },
    {
        id: 'bencao-da-mesa',
        title: 'Bênção da mesa',
        category: 'dia',
        note: 'Antes das refeições.',
        aka: ['Antes de comer', 'Oração das refeições'],
        text: `V. Abençoai-nos, Senhor,
e a estes alimentos que vamos receber das vossas mãos.
Por Cristo, Nosso Senhor.
R. Amen.

Ou:

Abençoai, Senhor, os alimentos que vamos tomar;
que eles renovem as nossas forças
para melhor Vos servir e amar.
Amen.`,
    },
    {
        id: 'gracas-depois-da-refeicao',
        title: 'Acção de graças depois da refeição',
        category: 'dia',
        text: `Nós Vos damos graças, Senhor,
por todos os vossos benefícios,
a Vós que viveis e reinais
pelos séculos dos séculos.
R. Amen.

V. Que o Senhor nos dê a sua paz.
R. E a vida eterna.
Amen.`,
    },
    {
        id: 'oracao-antes-do-trabalho',
        title: 'Antes do estudo e do trabalho',
        category: 'dia',
        note: 'De São Tomás de Aquino.',
        aka: ['Criador inefável', 'Oração do estudante'],
        text: `Criador inefável,
Vós que sois a verdadeira fonte da luz e da sabedoria,
dignai-Vos derramar sobre as trevas da minha inteligência
um raio da vossa claridade,
afastando de mim a dupla escuridão
em que nasci: o pecado e a ignorância.

Vós que tornais eloquente a língua das criancinhas,
formai a minha palavra
e derramai nos meus lábios a graça da vossa bênção.

Dai-me penetração para entender,
capacidade para reter,
método e facilidade para aprender,
subtileza para interpretar
e graça abundante para me exprimir.

Assisti ao começo do meu trabalho,
dirigi o seu progresso
e levai-o à sua perfeição,
Vós que sois verdadeiro Deus e verdadeiro homem
e viveis pelos séculos dos séculos.
Amen.`,
    },
    {
        id: 'oracao-antes-da-internet',
        title: 'Antes de usar a Internet',
        category: 'dia',
        note: 'Por intercessão de Santo Isidoro de Sevilha.',
        aka: ['Santo Isidoro', 'Redes sociais', 'Telemóvel'],
        text: `Deus omnipotente e eterno,
que nos criastes à vossa imagem
e nos mandastes buscar tudo quanto é bom,
verdadeiro e belo,
sobretudo na divina Pessoa do vosso Filho Unigénito,
Nosso Senhor Jesus Cristo,
concedei-nos, nós Vos pedimos,
que, por intercessão de Santo Isidoro, bispo e doutor,
nas nossas viagens através da Internet
movamos as mãos e os olhos
para as coisas que Vos agradam,
e acolhamos com caridade e paciência
todos quantos encontrarmos.
Por Cristo, Nosso Senhor.
Amen.`,
    },
    {
        id: 'exame-de-consciencia',
        title: 'Exame de consciência',
        category: 'dia',
        note: 'Breve revisão do dia, antes de dormir ou antes da confissão.',
        aka: ['Exame', 'Confissão'],
        text: `Meu Deus, dai-me luz para conhecer
os pecados que hoje cometi,
as suas causas e os meios de os evitar.

Para com Deus:
Lembrei-me de Deus ao longo do dia,
oferecendo-Lhe o meu trabalho,
dando-Lhe graças, recorrendo a Ele com confiança de filho?
Rezei pausadamente, com atenção e devoção?

Para com o próximo:
Tratei alguém com dureza ou desprezo?
Preocupei-me em ajudar os que me rodeiam?
Caí na murmuração? Sei perdoar?
Rezei pelas pessoas que de algum modo me preocupam?

Para comigo mesmo:
Lutei pela minha santificação?
Deixei-me levar pelo orgulho, pela vaidade, pela sensualidade?
Esforcei-me por arrancar o meu defeito dominante?
Recorri a Deus para que aumente em mim
a fé, a esperança e a caridade?

Termina-se com o Confesso a Deus e o Acto de contrição.`,
    },
    {
        id: 'oracao-da-noite',
        title: 'Oração da noite',
        category: 'dia',
        note: 'Acção de graças ao terminar o dia.',
        aka: ['Antes de dormir', 'Agradecimento do dia'],
        text: `Eu Vos adoro, meu Deus,
e Vos amo com todo o coração.
Dou-Vos graças por me terdes criado,
feito cristão e conservado neste dia.

Perdoai-me as faltas que hoje cometi
e, se algum bem fiz, aceitai-o.
Guardai-me durante o repouso
e livrai-me dos perigos.
A vossa graça seja sempre comigo
e com todos os que me são queridos.
Amen.`,
    },
    {
        id: 'por-quem-hoje-partir',
        title: 'Por quem hoje partir desta vida',
        category: 'dia',
        note: 'Súplica que acompanha o Angelus do meio-dia.',
        text: `Por aqueles que hoje o Senhor chamar à sua presença:

V. Dai-lhes, Senhor, o eterno descanso.
R. Entre os esplendores da luz perpétua.
V. Que as suas almas descansem em paz.
R. Amen.`,
    },
];
