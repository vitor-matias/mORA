import type { Chant } from './types';
import { CF_CHANTS } from './cf';

/**
 * The traditional repertoire: the Latin hymns of the Church and the
 * Portuguese hymns the parishes have sung for generations. Entries that carry
 * a `prayerId` are sung from a text the Devocionário already holds — the
 * words live there once, and this list only says when they are sung.
 */
const TRADITIONAL: Chant[] = [
    // ── Advento e Natal ──────────────────────────────────────────────────
    {
        id: 'adeste-fideles',
        title: 'Adeste fideles',
        category: 'natal',
        note: 'Séc. XVIII; chamado em Londres «o hino português». Canta-se na Missa do Galo e por todo o Natal.',
        latin: `1. Adéste, fidéles, læti triumphántes,
veníte, veníte in Béthlehem:
natum vidéte Regem angelórum.

R. Veníte adorémus,
veníte adorémus,
veníte adorémus Dóminum.

2. En grege relícto, húmiles ad cunas
vocáti pastóres appróperant;
et nos ovánti gradu festinémus.

3. Ætérni Paréntis splendórem ætérnum
velátum sub carne vidébimus:
Deum infántem, pannis involútum.

4. Pro nobis egénum et fœno cubántem
piis fovéamus ampléxibus:
sic nos amántem quis non redamáret?`,
        text: `1. Jesus vem ao mundo: que paz e bondade!
Ó quanta doçura, amor e humildade!

R. Vinde, adoremos,
vinde, adoremos,
vinde, adoremos Jesus Salvador.

2. Jesus no presépio; mas vede que amor:
nascer pobrezinho o Deus Criador!

3. Na face resplandece a luz divinal,
tesouro de graça, de vida imortal.

4. Alegres, corramos todos a Belém,
ver a grande nova que o céu para nós tem.

5. É Deus soberano da terra e do mar
que, feito menino, nos vem visitar.`,
    },
    {
        id: 'noite-feliz',
        title: 'Noite feliz',
        category: 'natal',
        note: 'Letra de Joseph Mohr e música de Franz Gruber, cantada pela primeira vez em Oberndorf na noite de Natal de 1818.',
        text: `Noite feliz, noite feliz,
o Senhor, Deus de amor,
pobrezinho nasceu em Belém.
Eis na lapa Jesus, nosso bem.
Dorme em paz, ó Jesus.
Dorme em paz, ó Jesus.

Noite feliz, noite feliz,
ó Jesus, Deus de luz,
quão afável é teu coração,
que quiseste nascer nosso irmão
e a nós todos salvar,
e a nós todos salvar.

Noite feliz, noite feliz,
jubilosos vêm cantar
aos pastores os Anjos do céu,
anunciando a chegada de Deus,
de Jesus Salvador,
de Jesus Salvador.`,
    },
    {
        id: 'gloria-in-excelsis-deo',
        title: 'Glória in excelsis Deo',
        category: 'natal',
        note: 'Cântico popular português de Natal, sobre o canto dos Anjos em Belém.',
        text: `1. Cantava em nossas campinas
esta noite um Querubim,
e com vozes argentinas
tornavam-lhe outros assim:

R. Glória in excelsis Deo!
Glória in excelsis Deo!

2. Ah, vinde todos à porfia
cantar um hino de louvor,
hino de paz e de alegria,
que os Anjos cantam ao Senhor.

3. Naquela noite venturosa
em que nasceu o Salvador,
os Anjos, com voz harmoniosa,
deram no céu este clamor.

4. Vamos juntar-nos aos pastores,
para irmos todos a Belém
saudar em férvidos louvores
o Salvador que hoje nos vem.`,
    },

    // ── Quaresma e Cruz ──────────────────────────────────────────────────
    {
        id: 'vitoria-tu-reinaras',
        title: 'Vitória, Tu reinarás',
        category: 'quaresma',
        note: 'Melodia eslava. Hino à Santa Cruz e a Cristo Rei.',
        text: `R. Vitória! Tu reinarás.
Ó Cruz, tu nos salvarás. (bis)

1. Estenda-se a todo o mundo
teu reino de redenção,
ó Cruz, manancial fecundo
de amor e consolação.

2. Congrega os irmãos dispersos
à sombra dos braços teus:
por ti tornamos de novo
a ser filhos de Deus.

3. O Verbo, em ti pregado,
morrendo, nos resgatou;
por ti, lenho abençoado,
a vida no mundo entrou.

4. Ao fraco dá confiança
nas lutas que travará:
só tu és nossa esperança,
que a Deus nos conduzirá.

5. Cantai, belas criaturas,
um hino ao Criador:
hossana lá nas alturas,
hossana a Cristo Senhor!`,
    },
    {
        id: 'salmo-miserere',
        title: 'Miserere — Salmo 50',
        category: 'quaresma',
        note: 'O salmo penitencial cantado na Quaresma e nas Laudes de sexta-feira.',
        prayerId: 'salmo-50',
    },

    // ── Páscoa ───────────────────────────────────────────────────────────
    {
        id: 'regina-caeli',
        title: 'Regina cæli',
        category: 'pascoa',
        note: 'Antífona mariana do Tempo Pascal; canta-se de pé, do Domingo de Páscoa ao Pentecostes.',
        prayerId: 'rainha-do-ceu',
    },

    // ── Eucaristia e Adoração ────────────────────────────────────────────
    {
        id: 'tantum-ergo',
        title: 'Tantum ergo',
        category: 'eucaristia',
        note: 'Últimas estrofes do Pange lingua de São Tomás de Aquino; canta-se na bênção do Santíssimo.',
        prayerId: 'tantum-ergo',
    },
    {
        id: 'adoro-te-devote',
        title: 'Adoro te devote',
        category: 'eucaristia',
        note: 'Hino de São Tomás de Aquino, cantado na adoração eucarística.',
        prayerId: 'adoro-te-devote',
    },
    {
        id: 'sanctus',
        title: 'Sanctus',
        category: 'eucaristia',
        note: 'Gregoriano, Missa VIII «De Angelis» — o Santo da Missa em latim.',
        latin: `Sanctus, Sanctus, Sanctus
Dóminus Deus Sábaoth.
Pleni sunt cæli et terra glória tua.
Hosánna in excélsis.
Benedíctus qui venit in nómine Dómini.
Hosánna in excélsis.`,
        text: `Santo, Santo, Santo,
Senhor Deus do universo.
O céu e a terra proclamam a vossa glória.
Hossana nas alturas.
Bendito o que vem em nome do Senhor.
Hossana nas alturas.`,
    },
    {
        id: 'bendito-e-louvado-seja',
        title: 'Bendito e louvado seja',
        category: 'eucaristia',
        note: 'Popular português, cantado na exposição e nas procissões do Santíssimo.',
        text: `Bendito e louvado seja
o Santíssimo Sacramento da Eucaristia,
fruto do ventre sagrado
da Virgem puríssima Santa Maria.`,
    },
    {
        id: 'louvores-de-deus',
        title: 'Louvores de Deus',
        category: 'eucaristia',
        note: 'Recitados ou cantados depois da bênção do Santíssimo, em desagravo.',
        text: `Bendito seja Deus.
Bendito seja o seu santo Nome.
Bendito seja Jesus Cristo, verdadeiro Deus e verdadeiro homem.
Bendito seja o nome de Jesus.
Bendito seja o seu sacratíssimo Coração.
Bendito seja o seu preciosíssimo Sangue.
Bendito seja Jesus no Santíssimo Sacramento do altar.
Bendito seja o Espírito Santo Paráclito.
Bendita seja a excelsa Mãe de Deus, Maria santíssima.
Bendita seja a sua santa e imaculada Conceição.
Bendita seja a sua gloriosa Assunção.
Bendito seja o nome de Maria, Virgem e Mãe.
Bendito seja São José, seu castíssimo esposo.
Bendito seja Deus nos seus Anjos e nos seus Santos.`,
    },

    // ── Ao Espírito Santo ────────────────────────────────────────────────
    {
        id: 'veni-creator',
        title: 'Veni Creator Spiritus',
        category: 'espirito',
        note: 'Cantado no Pentecostes, nas ordenações, no Crisma e ao abrir o ano.',
        prayerId: 'veni-creator',
    },
    {
        id: 'veni-sancte-spiritus',
        title: 'Veni Sancte Spiritus',
        category: 'espirito',
        note: 'A sequência do Domingo de Pentecostes, chamada a «sequência áurea».',
        prayerId: 'sequencia-do-espirito-santo',
    },

    // ── A Nossa Senhora ──────────────────────────────────────────────────
    {
        id: 'a-treze-de-maio',
        title: 'A treze de Maio',
        category: 'maria',
        note: 'Popular. O hino de Fátima, cantado nas peregrinações e nas procissões das velas.',
        text: `1. A treze de Maio,
na Cova da Iria,
apareceu brilhando
a Virgem Maria.

R. Ave, Ave, Ave Maria!
Ave, Ave, Ave Maria!

2. A Virgem Maria,
cercada de luz,
nossa Mãe bendita
e Mãe de Jesus.

3. C'os males da guerra
o mundo sofria;
Portugal ferido
sangrava e gemia.

4. Foi aos pastorinhos
que a Virgem falou;
desde então nas almas
nova luz brilhou.

5. Com doces palavras
mandou-nos rezar
a Virgem Maria,
para nos salvar.

6. Achou logo a Pátria
remédio ao seu mal,
e a Virgem Maria
salvou Portugal.

7. Mas jamais se esqueçam
nossos corações
que nos fez a Virgem
determinações.

8. Falou contra o luxo,
falou contra o despudor,
de imodestas modas
de uso pecador.

9. Disse que a pureza
agrada a Jesus;
disse que a luxúria
ao fogo conduz.

10. A treze de Outubro
foi o seu adeus,
e a Virgem Maria
voltou para os céus.

11. À pátria que é vossa,
Senhora dos céus,
dai honra, alegria
e a graça de Deus.

12. À Virgem bendita
cante o seu louvor
toda a nossa terra
num hino de amor.

13. Todo o mundo a louve
para se salvar,
desde o vale ao monte,
desde o monte ao mar.`,
    },
    {
        id: 'o-sanctissima',
        title: 'O sanctissima',
        category: 'maria',
        note: 'Melodia siciliana, cantada nas festas de Nossa Senhora.',
        latin: `O sanctíssima, o piíssima,
dulcis Virgo María!
Mater amáta, intemeráta,
ora, ora pro nobis.

Tu solátium et refúgium,
Virgo Mater María!
Quidquid optámus, per te sperámus:
ora, ora pro nobis.

Tua gáudia et suspíria
juvent nos, o María!
In te sperámus, ad te clamámus:
ora, ora pro nobis.`,
    },
    {
        id: 'salve-mae-imaculada',
        title: 'Salvé, Mãe Imaculada',
        category: 'maria',
        note: 'Melodia alemã, cantada no mês de Maio e na Imaculada Conceição.',
        text: `1. Salvé, Mãe imaculada!
Do cristão sois força e luz,
sois filha de Deus amada,
pura Mãe do bom Jesus.

R. A vossos pés estamos nós,
hoje clamando em alta voz:
Ó Maria! Ó Mãe de Deus,
orai, orai, orai por nós!
Orai, orai, orai por nós!

2. Vós que sois fulgente estrela
deste mundo no alto mar,
desviai-me da procela,
dai-me o norte salutar.

3. Mãe de amor, que suplicante
a Jesus volveis o olhar,
ó dizei-lhe, neste instante,
como é duro o meu penar.`,
    },
    {
        id: 'salve-rainha',
        title: 'Salve Regina',
        category: 'maria',
        note: 'Antífona mariana do Tempo Comum, cantada em gregoriano ao fim do dia.',
        prayerId: 'salve-rainha',
    },
    {
        id: 'alma-redemptoris',
        title: 'Alma Redemptoris Mater',
        category: 'maria',
        note: 'Antífona mariana do Advento e do Natal.',
        prayerId: 'alma-redemptoris-mater',
    },
    {
        id: 'ave-regina-caelorum',
        title: 'Ave Regina cælorum',
        category: 'maria',
        note: 'Antífona mariana da Quaresma.',
        prayerId: 'ave-regina-caelorum',
    },
    {
        id: 'ave-maris-stella',
        title: 'Ave maris stella',
        category: 'maria',
        note: 'Hino das Vésperas nas festas de Nossa Senhora.',
        prayerId: 'ave-maris-stella',
    },
    {
        id: 'magnificat',
        title: 'Magnificat',
        category: 'maria',
        note: 'O cântico de Maria, cantado todos os dias nas Vésperas.',
        prayerId: 'magnificat',
    },

    // ── Louvor e acção de graças ─────────────────────────────────────────
    {
        id: 'te-deum',
        title: 'Te Deum',
        category: 'louvor',
        note: 'Cantado nas grandes acções de graças e a 31 de Dezembro.',
        prayerId: 'te-deum',
    },
    {
        id: 'benedictus',
        title: 'Benedictus',
        category: 'louvor',
        note: 'O cântico de Zacarias, cantado todas as manhãs nas Laudes.',
        prayerId: 'benedictus',
    },
    {
        id: 'nunc-dimittis',
        title: 'Nunc dimittis',
        category: 'louvor',
        note: 'O cântico de Simeão, cantado nas Completas antes de dormir.',
        prayerId: 'nunc-dimittis',
    },

    // ── Exéquias ─────────────────────────────────────────────────────────
    {
        id: 'in-paradisum',
        title: 'In paradisum',
        category: 'exequias',
        note: 'Antífona cantada quando o corpo é levado da igreja para a sepultura.',
        latin: `In paradísum dedúcant te ángeli;
in tuo advéntu suscípiant te mártyres,
et perdúcant te in civitátem sanctam Jerúsalem.
Chorus angelórum te suscípiat,
et cum Lázaro quondam páupere
ætérnam hábeas réquiem.`,
        text: `Ao paraíso te conduzam os Anjos;
à tua chegada te recebam os mártires
e te introduzam na cidade santa de Jerusalém.
O coro dos Anjos te acolha
e, com Lázaro, o pobre da terra,
tenhas a vida eterna.`,
    },
    {
        id: 'de-profundis',
        title: 'De profundis — Salmo 129',
        category: 'exequias',
        note: 'Cantado pelos fiéis defuntos e no mês de Novembro.',
        prayerId: 'salmo-129',
    },
];

/** The traditional repertoire first, then the movement's own songbook. */
export const CHANTS: Chant[] = [...TRADITIONAL, ...CF_CHANTS];
