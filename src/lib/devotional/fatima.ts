import type { Prayer } from './types';

/** The prayers of Fátima, in the wording the Sanctuary itself publishes:
    the two taught by the Angel of Portugal in 1916, the three taught by Our
    Lady of the Rosary in 1917, and the one the seers received inwardly. */
export const FATIMA: Prayer[] = [
    {
        id: 'oracao-do-anjo-adoracao',
        title: 'Oração do Anjo: «Meu Deus, eu creio»',
        category: 'fatima',
        note: 'Ensinada pelo Anjo aos três pastorinhos, na Loca do Cabeço, 1916.',
        aka: ['Anjo da Paz', 'Anjo de Portugal', 'Meu Deus eu creio adoro espero'],
        text: `Meu Deus, eu creio, adoro, espero e amo-Vos.
Peço-Vos perdão para os que não creem,
não adoram, não esperam e não Vos amam.`,
    },
    {
        id: 'oracao-do-anjo-reparacao',
        title: 'Oração do Anjo: «Santíssima Trindade»',
        category: 'fatima',
        note: 'Ensinada pelo Anjo na terceira aparição, com a Sagrada Hóstia e o Cálice.',
        aka: ['Oração de reparação', 'Santíssima Trindade adoro-Vos profundamente'],
        text: `Santíssima Trindade, Pai, Filho e Espírito Santo,
adoro-Vos profundamente
e ofereço-Vos o preciosíssimo Corpo, Sangue,
Alma e Divindade de Jesus Cristo,
presente em todos os sacrários da terra,
em reparação dos ultrajes, sacrilégios e indiferenças
com que Ele mesmo é ofendido.

E pelos méritos infinitos
do seu Santíssimo Coração
e do Coração Imaculado de Maria,
peço-Vos a conversão dos pobres pecadores.`,
    },
    {
        id: 'oracao-do-oferecimento-fatima',
        title: 'Oferecimento dos sacrifícios',
        category: 'fatima',
        note: 'Ensinada por Nossa Senhora, para oferecer os sacrifícios do dia.',
        aka: ['Ó Jesus é por vosso amor'],
        text: `Ó Jesus, é por vosso amor,
pela conversão dos pecadores
e em reparação pelos pecados cometidos
contra o Imaculado Coração de Maria.`,
    },
    {
        id: 'jaculatoria-de-fatima',
        title: 'Ó meu Jesus, perdoai-nos',
        category: 'fatima',
        note: 'Ensinada por Nossa Senhora; reza-se no fim de cada dezena do terço.',
        aka: ['Jaculatória de Fátima', 'Oração do terço'],
        text: `Ó meu Jesus, perdoai-nos,
livrai-nos do fogo do inferno;
levai as almas todas para o Céu,
principalmente as que mais precisarem.`,
    },
    {
        id: 'o-santissima-trindade-eu-vos-adoro',
        title: 'Ó Santíssima Trindade, eu Vos adoro',
        category: 'fatima',
        note: 'Comunicada aos videntes num impulso íntimo.',
        text: `Ó Santíssima Trindade, eu Vos adoro.
Meu Deus, meu Deus, eu Vos amo no Santíssimo Sacramento.`,
    },
    {
        id: 'oracao-a-nossa-senhora-de-fatima',
        title: 'A Nossa Senhora de Fátima',
        category: 'fatima',
        text: `Santíssima Virgem,
que nos montes de Fátima Vos dignastes revelar
aos três pastorinhos os tesouros de graças
que podemos alcançar rezando o santo Rosário,
ajudai-nos a apreciar cada vez mais esta santa oração,
a fim de que, meditando os mistérios da nossa redenção,
alcancemos as graças que insistentemente Vos pedimos.

Nossa Senhora do Rosário de Fátima, rogai por nós.
Amen.`,
    },
    {
        id: 'consagracao-ao-imaculado-coracao',
        title: 'Consagração ao Imaculado Coração de Maria',
        category: 'fatima',
        note: 'Fórmula usada em Portugal na renovação da consagração.',
        aka: ['Coração Imaculado', 'Consagração de Portugal'],
        text: `Virgem Maria, Mãe de Deus e nossa Mãe,
ao vosso Coração Imaculado nos consagramos,
em acto de entrega total ao Senhor.

Por Vós seremos levados a Cristo.
Por Ele e com Ele seremos levados ao Pai.
Caminharemos à luz da fé
e faremos tudo para que o mundo creia
que Jesus Cristo é o Enviado do Pai.

Sob a protecção do vosso Coração Imaculado
seremos um só povo com Cristo.
Por Ele seremos levados ao Pai,
para glória da Santíssima Trindade,
a Quem adoramos, louvamos e bendizemos.
Amen.`,
    },
    {
        id: 'primeiros-sabados',
        title: 'Devoção dos primeiros sábados',
        category: 'fatima',
        note: 'Os cinco primeiros sábados de reparação pedidos em Fátima.',
        aka: ['Cinco primeiros sábados', 'Reparação'],
        text: `Durante cinco primeiros sábados seguidos,
com a intenção de reparar as ofensas feitas
ao Imaculado Coração de Maria:

confessar-se (nos oito dias antes ou depois);

receber a Sagrada Comunhão;

rezar cinco dezenas do terço;

fazer quinze minutos de companhia a Nossa Senhora,
meditando nos mistérios do Rosário.

Oração para o início:
Imaculado Coração de Maria,
venho fazer-Vos companhia
e oferecer-Vos esta comunhão reparadora,
pelas ofensas que recebeis
e pela conversão dos pobres pecadores.
Amen.`,
    },
];
