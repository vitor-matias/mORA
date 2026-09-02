import type { Prayer } from './types';

/** The lists every catechism ends with — not prayers, but the things a
    Catholic is expected to be able to count on their fingers. Kept here so
    that the examen and the confession have them at hand. */
export const FORMULAS: Prayer[] = [
    {
        id: 'mandamentos-da-lei-de-deus',
        title: 'Os dez mandamentos da Lei de Deus',
        category: 'formulas',
        aka: ['Decálogo', 'Dez mandamentos'],
        text: `1. Amar a Deus sobre todas as coisas.
2. Não invocar o seu santo Nome em vão.
3. Guardar domingos e festas de guarda.
4. Honrar pai e mãe.
5. Não matar.
6. Não pecar contra a castidade.
7. Não furtar.
8. Não levantar falsos testemunhos.
9. Não desejar a mulher do próximo.
10. Não cobiçar as coisas alheias.

Estes dez mandamentos encerram-se em dois:
amar a Deus sobre todas as coisas
e ao próximo como a si mesmo.`,
    },
    {
        id: 'mandamento-do-amor',
        title: 'O mandamento novo',
        category: 'formulas',
        aka: ['Regra de ouro', 'Amar o próximo'],
        text: `«Amarás o Senhor teu Deus com todo o teu coração,
com toda a tua alma e com todo o teu entendimento.
Este é o maior e o primeiro mandamento.
O segundo é semelhante a este:
amarás o teu próximo como a ti mesmo.» (Mt 22, 37-39)

«Dou-vos um mandamento novo:
que vos ameis uns aos outros;
como Eu vos amei, amai-vos também uns aos outros.» (Jo 13, 34)

A regra de ouro:
«Tudo quanto quereis que os homens vos façam,
fazei-o vós também a eles.» (Mt 7, 12)`,
    },
    {
        id: 'bem-aventurancas',
        title: 'As Bem-aventuranças',
        category: 'formulas',
        note: 'Mt 5, 3-12: o programa do Sermão da Montanha.',
        aka: ['Sermão da Montanha', 'Bem-aventurados'],
        text: `Bem-aventurados os pobres em espírito,
porque deles é o Reino dos Céus.

Bem-aventurados os mansos,
porque possuirão a terra.

Bem-aventurados os que choram,
porque serão consolados.

Bem-aventurados os que têm fome e sede de justiça,
porque serão saciados.

Bem-aventurados os misericordiosos,
porque alcançarão misericórdia.

Bem-aventurados os puros de coração,
porque verão a Deus.

Bem-aventurados os que promovem a paz,
porque serão chamados filhos de Deus.

Bem-aventurados os que sofrem perseguição por causa da justiça,
porque deles é o Reino dos Céus.

Bem-aventurados sois vós, quando, por minha causa,
vos insultarem, vos perseguirem
e, mentindo, disserem todo o mal contra vós.
Alegrai-vos e exultai,
porque é grande nos Céus a vossa recompensa.`,
    },
    {
        id: 'mandamentos-da-igreja',
        title: 'Os mandamentos da Igreja',
        category: 'formulas',
        text: `1. Participar na Missa aos domingos e festas de guarda
e abster-se dos trabalhos que impeçam a santificação desses dias.

2. Confessar os próprios pecados pelo menos uma vez por ano.

3. Receber o sacramento da Eucaristia ao menos pela Páscoa.

4. Guardar os dias de jejum e de abstinência
estabelecidos pela Igreja.

5. Contribuir para as necessidades materiais da Igreja,
segundo as próprias possibilidades.`,
    },
    {
        id: 'obras-de-misericordia',
        title: 'As obras de misericórdia',
        category: 'formulas',
        aka: ['Misericórdia corporal', 'Misericórdia espiritual'],
        text: `Corporais:

1. Dar de comer a quem tem fome.
2. Dar de beber a quem tem sede.
3. Vestir os nus.
4. Dar pousada aos peregrinos.
5. Visitar os enfermos.
6. Visitar os presos.
7. Enterrar os mortos.

Espirituais:

1. Dar bom conselho.
2. Ensinar os ignorantes.
3. Corrigir os que erram.
4. Consolar os tristes.
5. Perdoar as injúrias.
6. Suportar com paciência as fraquezas do próximo.
7. Rezar a Deus pelos vivos e pelos defuntos.`,
    },
    {
        id: 'sacramentos',
        title: 'Os sete sacramentos',
        category: 'formulas',
        text: `Da iniciação cristã:
1. Baptismo.
2. Confirmação (Crisma).
3. Eucaristia.

De cura:
4. Penitência (Confissão).
5. Unção dos enfermos.

Ao serviço da comunhão:
6. Ordem.
7. Matrimónio.`,
    },
    {
        id: 'virtudes',
        title: 'As virtudes',
        category: 'formulas',
        text: `Teologais:
1. Fé.
2. Esperança.
3. Caridade.

Cardeais:
1. Prudência.
2. Justiça.
3. Fortaleza.
4. Temperança.`,
    },
    {
        id: 'dons-do-espirito-santo',
        title: 'Os dons e os frutos do Espírito Santo',
        category: 'formulas',
        text: `Os sete dons:
1. Sabedoria.
2. Entendimento.
3. Conselho.
4. Fortaleza.
5. Ciência.
6. Piedade.
7. Temor de Deus.

Os frutos (Gl 5, 22-23):
caridade, alegria, paz, paciência,
benignidade, bondade, longanimidade,
mansidão, fé, modéstia, continência, castidade.`,
    },
    {
        id: 'vicios-capitais',
        title: 'Os pecados capitais e as virtudes que se lhes opõem',
        category: 'formulas',
        aka: ['Vícios capitais', 'Sete pecados mortais'],
        text: `Os sete pecados capitais:
1. Soberba.
2. Avareza.
3. Luxúria.
4. Ira.
5. Gula.
6. Inveja.
7. Preguiça.

As virtudes que se lhes opõem:
1. Humildade.
2. Generosidade.
3. Castidade.
4. Mansidão.
5. Temperança.
6. Caridade.
7. Diligência.`,
    },
    {
        id: 'novissimos',
        title: 'Os novíssimos do homem',
        category: 'formulas',
        aka: ['Últimas realidades', 'Morte juízo inferno paraíso'],
        text: `1. Morte.
2. Juízo.
3. Inferno.
4. Paraíso.`,
    },
];
