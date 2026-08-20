import type { Prayer } from './types';

/** Psalms and Gospel canticles, in the Portuguese liturgical translation —
    the same text the Liturgia das Horas uses elsewhere in the app. Psalms are
    numbered as in the liturgical books: Vulgate first, Hebrew in brackets. */
export const SALMOS: Prayer[] = [
    {
        id: 'salmo-22',
        title: 'Salmo 22 (23) — O Senhor é meu pastor',
        category: 'salmos',
        aka: ['O Senhor é meu pastor', 'Nada me falta', 'Bom Pastor'],
        text: `O Senhor é meu pastor: nada me falta.
Leva-me a descansar em verdes prados,
conduz-me às águas refrescantes
e reconforta a minha alma.

Ele me guia por sendas direitas
por amor do seu nome.
Ainda que tenha de andar por vales tenebrosos,
não temerei nenhum mal, porque Vós estais comigo:
o vosso cajado e o vosso báculo
enchem-me de confiança.

Para mim preparais a mesa
à vista dos meus adversários;
com óleo me perfumais a cabeça
e o meu cálice transborda.

A bondade e a graça hão-de acompanhar-me
todos os dias da minha vida
e habitarei na casa do Senhor
para todo o sempre.`,
    },
    {
        id: 'salmo-50',
        title: 'Salmo 50 (51) — Miserere',
        category: 'salmos',
        note: 'O salmo penitencial por excelência; reza-se às sextas-feiras nas Laudes.',
        aka: ['Miserere', 'Compadecei-Vos de mim ó Deus', 'Penitência'],
        text: `Compadecei-Vos de mim, ó Deus, pela vossa bondade,
pela vossa grande misericórdia, apagai os meus pecados.
Lavai-me de toda a iniquidade
e purificai-me de todas as faltas.

Porque eu reconheço os meus pecados
e tenho sempre diante de mim as minhas culpas.
Pequei contra Vós, só contra Vós,
e fiz o mal diante dos vossos olhos.
Assim é justa a vossa sentença
e recto o vosso julgamento.

Aspergi-me com o hissope e ficarei puro,
lavai-me e ficarei mais branco do que a neve.
Fazei-me ouvir uma palavra de gozo e de alegria
e estremeçam os meus ossos que triturastes.

Desviai o vosso rosto das minhas faltas
e purificai-me de todos os meus pecados.
Criai em mim, ó Deus, um coração puro
e fazei nascer dentro de mim um espírito firme.

Não queirais repelir-me da vossa presença
e não retireis de mim o vosso espírito de santidade.
Dai-me de novo a alegria da vossa salvação
e sustentai-me com espírito generoso.

Ensinarei aos pecadores os vossos caminhos
e os transviados hão-de voltar para Vós.
Abri, Senhor, os meus lábios
e a minha boca anunciará o vosso louvor.

Não é do sacrifício que Vos agradais
e, se eu oferecer um holocausto, não o aceitareis.
Sacrifício agradável a Deus é o espírito arrependido:
não desprezareis, Senhor, um coração humilhado e contrito.`,
    },
    {
        id: 'salmo-129',
        title: 'Salmo 129 (130) — Do profundo abismo',
        category: 'salmos',
        note: 'O «De profundis», rezado pelos defuntos.',
        aka: ['De profundis', 'Do profundo abismo'],
        text: `Do profundo abismo chamo por Vós, Senhor;
Senhor, escutai a minha voz.
Estejam vossos ouvidos atentos
à voz da minha súplica.

Se tiverdes em conta as nossas faltas,
Senhor, quem poderá salvar-se?
Mas em Vós está o perdão,
para serdes temido com reverência.

Eu confio no Senhor,
a minha alma confia na sua palavra.
A minha alma espera pelo Senhor,
mais do que as sentinelas pela aurora.

Mais do que as sentinelas pela aurora,
Israel espera pelo Senhor,
porque no Senhor está a misericórdia
e com Ele abundante redenção.
Ele há-de libertar Israel
de todas as suas faltas.`,
    },
    {
        id: 'benedictus',
        title: 'Benedictus',
        category: 'salmos',
        note: 'O cântico de Zacarias (Lc 1, 68-79); reza-se nas Laudes.',
        aka: ['Cântico de Zacarias', 'Bendito o Senhor Deus de Israel'],
        text: `Bendito o Senhor Deus de Israel,
que visitou e redimiu o seu povo
e nos deu um Salvador poderoso
na casa de David, seu servo,

conforme prometeu pela boca dos seus santos,
os profetas dos tempos antigos,
para nos libertar dos nossos inimigos
e das mãos daqueles que nos odeiam.

Para mostrar a sua misericórdia a favor dos nossos pais,
recordando a sua sagrada aliança
e o juramento que fizera a Abraão, nosso pai,
que nos havia de conceder esta graça:
de O servirmos um dia, sem temor,
livres das mãos dos nossos inimigos,
em santidade e justiça, na sua presença,
todos os dias da nossa vida.

E tu, menino, serás chamado profeta do Altíssimo,
porque irás à sua frente a preparar os seus caminhos,
para dar a conhecer ao seu povo a salvação
pela remissão dos seus pecados,

graças ao coração misericordioso do nosso Deus,
que das alturas nos visita como sol nascente,
para iluminar os que jazem nas trevas e na sombra da morte
e dirigir os nossos passos no caminho da paz.

Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
    },
    {
        id: 'nunc-dimittis',
        title: 'Nunc dimittis',
        category: 'salmos',
        note: 'O cântico de Simeão (Lc 2, 29-32); reza-se nas Completas, antes de dormir.',
        aka: ['Cântico de Simeão', 'Agora Senhor segundo a vossa palavra'],
        text: `Agora, Senhor, segundo a vossa palavra,
deixareis partir em paz o vosso servo,
porque os meus olhos viram a salvação
que oferecestes a todos os povos:
luz para se revelar às nações
e glória de Israel, vosso povo.

Glória ao Pai e ao Filho e ao Espírito Santo.
Como era no princípio, agora e sempre.
Amen.`,
    },
];
