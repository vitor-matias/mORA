import type { Prayer } from './types';

/** For the faithful departed — the short suffrage that any Catholic can say
    at a graveside, and the responsory the Church prays over its dead. */
export const DEFUNTOS: Prayer[] = [
    {
        id: 'eterno-descanso',
        title: 'Eterno descanso',
        category: 'defuntos',
        note: 'O sufrágio breve, que se reza diante de um cemitério ou ao saber de uma morte.',
        aka: ['Requiem aeternam', 'Descansem em paz'],
        text: `V. Dai-lhes, Senhor, o eterno descanso.
R. Entre os esplendores da luz perpétua.
V. Descansem em paz.
R. Amen.

As almas de todos os fiéis defuntos,
pela misericórdia de Deus, descansem em paz.
Amen.`,
        latin: `V. Réquiem ætérnam dona eis, Dómine.
R. Et lux perpétua lúceat eis.
V. Requiéscant in pace.
R. Amen.`,
    },
    {
        id: 'oracao-por-um-defunto',
        title: 'Por um defunto',
        category: 'defuntos',
        aka: ['Funeral', 'Luto', 'Morte'],
        text: `Ouvi, ó Pai, as nossas preces;
sede misericordioso para com o vosso servo,
que chamastes deste mundo.
Concedei-lhe a luz e a paz no convívio dos vossos Santos.
Por Cristo, Nosso Senhor.
R. Amen.

Absolvei, Senhor, a alma do vosso servo
de todos os laços do pecado,
a fim de que, na ressurreição gloriosa,
entre os vossos Santos e eleitos,
ressuscitado no seu corpo, de novo respire.
Por Cristo, Nosso Senhor.
R. Amen.`,
    },
    {
        id: 'responso-dos-defuntos',
        title: 'Responso',
        category: 'defuntos',
        note: 'Rezado ao acompanhar o corpo à sepultura.',
        text: `«Eu sou a ressurreição e a vida;
quem crê em Mim, mesmo que esteja morto, viverá;
e quem vive e crê em Mim
não morrerá eternamente.» (Jo 11, 25-26)

Santos de Deus, vinde em seu auxílio;
Anjos do Senhor, correi ao seu encontro.
Acolhei a sua alma,
levando-a à presença do Altíssimo.

V. Cristo te chamou. Ele te receba,
e os Anjos te acompanhem ao seio de Abraão.
R. Acolhei a sua alma, levando-a à presença do Altíssimo.

V. Dai-lhe, Senhor, o repouso eterno.
R. E brilhe para ele a vossa luz.

Senhor, tende piedade de nós.
Cristo, tende piedade de nós.
Senhor, tende piedade de nós.

Pai Nosso…

V. Descanse em paz.
R. Amen.`,
    },
    {
        id: 'pelas-almas-do-purgatorio',
        title: 'Pelas almas do Purgatório',
        category: 'defuntos',
        note: 'Devoção própria do mês de Novembro.',
        aka: ['Purgatório', 'Fiéis defuntos', 'Novembro'],
        text: `Senhor Deus omnipotente,
eu Vos peço, pelo Sangue precioso
que o vosso divino Filho Jesus derramou na sua Paixão,
que liberteis as almas do Purgatório,
e sobretudo aquela que estiver mais esquecida de todas,
e a leveis à vossa glória,
para aí Vos louvar e bendizer por todos os séculos.
Amen.

V. Dai-lhes, Senhor, o eterno descanso.
R. Entre os esplendores da luz perpétua.`,
    },
];
