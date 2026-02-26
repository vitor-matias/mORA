export type RosaryBeadMode = 'beginner' | 'advanced';
export type MysteryDay = 'gozosos' | 'luminosos' | 'dolorosos' | 'gloriosos';

export interface RosaryMystery {
    id: string;
    mysteryNum: number; // 1 to 5
    type: MysteryDay;
    title: string;
    description: string;
    fruit: string;
}

export interface RosaryStep {
    id: string;
    type: 'intro' | 'pai_nosso' | 'ave_maria' | 'gloria' | 'misterio' | 'salve_rainha' | 'final';
    title: string;
    content: string; // The prayer text itself
    isDecade?: boolean; // True if it's one of the 50 Ave Marias
    decadeIndex?: number; // 1 to 5
    beadIndex?: number; // 1 to 10 within a decade
}

export const prayers = {
    sinalDaCruz: "Pelo sinal da Santa Cruz, livrai-nos, Deus, nosso Senhor, dos nossos inimigos. Em nome do Pai e do Filho e do Espírito Santo. Amém.",
    invocacao: "Em nome do Pai, do Filho e do Espírito Santo. Ó Deus, vinde em nosso auxílio. Senhor, socorrei-nos e salvai-nos.",
    credo: "Creio em Deus Pai Todo-Poderoso, criador do céu e da terra. E em Jesus Cristo, seu único Filho, nosso Senhor, que foi concebido pelo poder do Espírito Santo; nasceu da Virgem Maria; padeceu sob Pôncio Pilatos, foi crucificado, morto e sepultado. Desceu à mansão dos mortos; ressuscitou ao terceiro dia, subiu aos céus; está sentado à direita de Deus Pai Todo-Poderoso, donde há de vir a julgar os vivos e os mortos. Creio no Espírito Santo; na Santa Igreja Católica; na comunhão dos santos; na remissão dos pecados; na ressurreição da carne; na vida eterna. Amém.",
    paiNosso: "Pai nosso, que estais nos céus, santificado seja o vosso nome, venha a nós o vosso reino, seja feita a vossa vontade assim na terra como no céu. O pão nosso de cada dia nos dai hoje, perdoai-nos as nossas ofensas assim como nós perdoamos a quem nos tem ofendido, e não nos deixeis cair em tentação, mas livrai-nos do mal. Amém.",
    aveMaria: "Ave Maria, cheia de graça, o Senhor é convosco, bendita sois vós entre as mulheres e bendito é o fruto do vosso ventre, Jesus. Santa Maria, Mãe de Deus, rogai por nós pecadores, agora e na hora da nossa morte. Amém.",
    gloria: "Glória ao Pai, e ao Filho e ao Espírito Santo. Como era no princípio, agora e sempre. Amém.",
    jaculatoria1: "Ó meu Jesus, perdoai-nos e livrai-nos do fogo do inferno, levai as almas todas para o céu e socorrei principalmente as que mais precisarem.",
    jaculatoria2: "Ó Maria concebida sem pecado, rogai por nós que recorremos a Vós.",
    salveRainha: "Salve, Rainha, Mãe de misericórdia, vida, doçura e esperança nossa, salve! A vós bradamos, os degredados filhos de Eva; a vós suspiramos, gemendo e chorando neste vale de lágrimas. Eias, pois, advogada nossa, esses vossos olhos misericordiosos a nós volvei; e depois deste desterro nos mostrai Jesus, bendito fruto do vosso ventre, ó clemente, ó piedosa, ó doce sempre Virgem Maria. Rogai por nós, santa Mãe de Deus. Para que sejamos dignos das promessas de Cristo. Amém.",
};

export const mysteries: Record<MysteryDay, RosaryMystery[]> = {
    gozosos: [
        { id: 'g1', mysteryNum: 1, type: 'gozosos', title: 'Anunciação a Maria', fruit: 'Humildade', description: '«No sexto mês, o anjo Gabriel foi enviado por Deus a uma cidade da Galiléia, chamada Nazaré, a uma virgem desposada com um homem que se chamava José, da casa de Davi e o nome da virgem era Maria» (Lc 1, 26-27)' },
        { id: 'g2', mysteryNum: 2, type: 'gozosos', title: 'Visitação de Maria a Isabel', fruit: 'Caridade para com o próximo', description: '«Naqueles dias, Maria se levantou e foi às pressas às montanhas, a uma cidade de Judá. Entrou em casa de Zacarias e saudou Isabel. Ora, apenas Isabel ouviu a saudação de Maria, a criança estremeceu no seu seio...» (Lc 1, 39-42)' },
        { id: 'g3', mysteryNum: 3, type: 'gozosos', title: 'Nascimento de Jesus', fruit: 'Pobreza e desapego', description: '«Completaram-se os dias dela. E deu à luz seu filho primogênito, e, envolvendo-o em faixas, reclinou-o num presépio; porque não havia lugar para eles na hospedaria» (Lc 2, 6-7)' },
        { id: 'g4', mysteryNum: 4, type: 'gozosos', title: 'Apresentação do Menino Jesus', fruit: 'Obediência e pureza', description: '«Concluídos os dias da sua purificação segundo a Lei de Moisés, levaram-no a Jerusalém para o apresentar ao Senhor, conforme o que está escrito na lei do Senhor...» (Lc 2, 22-24)' },
        { id: 'g5', mysteryNum: 5, type: 'gozosos', title: 'Perda e encontro do Menino Jesus no Templo', fruit: 'Alegria em encontrar Jesus', description: '«Acabados os dias da festa, quando voltavam, ficou o menino Jesus em Jerusalém, sem que os seus pais o percebessem... Três dias depois o acharam no templo, sentado no meio dos doutores» (Lc 2, 43.46)' },
    ],
    luminosos: [
        { id: 'l1', mysteryNum: 1, type: 'luminosos', title: 'Batismo de Jesus no Jordão', fruit: 'Abertura ao Espírito Santo', description: '«Depois que Jesus foi batizado, saiu logo da água. Eis que os céus se abriram e viu descer sobre ele, em forma de pomba, o Espírito de Deus.» (Mt 3, 16)' },
        { id: 'l2', mysteryNum: 2, type: 'luminosos', title: 'Auto-revelação nas bodas de Caná', fruit: 'A Jesus por Maria', description: '«Como viesse a faltar vinho, a mãe de Jesus disse-lhe: "Eles já não têm vinho". [...] Disse, então, sua mãe aos serventes: "Fazei o que ele vos disser"» (Jo 2, 3.5)' },
        { id: 'l3', mysteryNum: 3, type: 'luminosos', title: 'Anúncio do Reino de Deus', fruit: 'Conversão', description: '«Completou-se o tempo e o Reino de Deus está próximo; fazei penitência e crede no Evangelho» (Mc 1, 15)' },
        { id: 'l4', mysteryNum: 4, type: 'luminosos', title: 'Transfiguração de Jesus', fruit: 'Desejo de santidade', description: '«Seis dias depois, Jesus tomou consigo Pedro, Tiago e João, seu irmão, e conduziu-os à parte a uma alta montanha. Lá se transfigurou na presença deles...» (Mt 17, 1-2)' },
        { id: 'l5', mysteryNum: 5, type: 'luminosos', title: 'Instituição da Eucaristia', fruit: 'Adoração Eucarística', description: '«Durante a refeição, Jesus tomou o pão, benzeu-o, partiu-o e o deu aos discípulos, dizendo: "Tomai e comei, isto é meu corpo"» (Mt 26, 26)' },
    ],
    dolorosos: [
        { id: 'd1', mysteryNum: 1, type: 'dolorosos', title: 'Agonia no Horto das Oliveiras', fruit: 'Arrependimento', description: '«Adiantou-se um pouco e, prostrando-se com a face por terra, assim rezou: "Meu Pai, se é possível, afasta de mim este cálice! Todavia não se faça o que eu quero, mas sim o que tu queres"» (Mt 26, 39)' },
        { id: 'd2', mysteryNum: 2, type: 'dolorosos', title: 'Flagelação atado à coluna', fruit: 'Mortificação', description: '«Então lhes soltou Barrabás; mas a Jesus mandou açoitar, e o entregou para ser crucificado» (Mt 27, 26)' },
        { id: 'd3', mysteryNum: 3, type: 'dolorosos', title: 'Coroação de Espinhos', fruit: 'Coragem moral', description: '«Trançaram uma coroa de espinhos, meteram-lha na cabeça e puseram-lhe na mão uma vara. Dobrando os joelhos diante dele, diziam com escárnio: "Salve, rei dos judeus!"» (Mt 27, 29)' },
        { id: 'd4', mysteryNum: 4, type: 'dolorosos', title: 'Jesus carrega a Cruz', fruit: 'Paciência nas tribulações', description: '«Passava por ali certo homem de Cirene, chamado Simão [...] e obrigaram-no a que lhe levasse a cruz. Conduziram Jesus ao lugar chamado Gólgota» (Mc 15, 21-22)' },
        { id: 'd5', mysteryNum: 5, type: 'dolorosos', title: 'Crucificação e morte de Jesus', fruit: 'Salvação das almas', description: '«Jesus deu então um grande brado e disse: "Pai, nas tuas mãos entrego o meu espírito". E, dizendo isso, expirou» (Lc 23, 46)' },
    ],
    gloriosos: [
        { id: 'gl1', mysteryNum: 1, type: 'gloriosos', title: 'Ressurreição de Jesus', fruit: 'Fé', description: '«Como estivessem amedrontadas e voltassem o rosto para o chão, disseram-lhes eles: "Por que buscais entre os mortos aquele que está vivo? Não está aqui, mas ressuscitou"» (Lc 24, 5-6)' },
        { id: 'gl2', mysteryNum: 2, type: 'gloriosos', title: 'Ascensão de Jesus ao Céu', fruit: 'Esperança cristã', description: '«Depois que o Senhor Jesus lhes falou, foi levado ao céu e está sentado à direita de Deus» (Mc 16, 19)' },
        { id: 'gl3', mysteryNum: 3, type: 'gloriosos', title: 'Vinda do Espírito Santo', fruit: 'Amor a Deus', description: '«Apareceu-lhes então uma espécie de línguas de fogo que se repartiram e pousaram sobre cada um deles. Ficaram todos cheios do Espírito Santo...» (At 2, 3-4)' },
        { id: 'gl4', mysteryNum: 4, type: 'gloriosos', title: 'Assunção de Nossa Senhora', fruit: 'Graça de uma boa morte', description: '«Por isto, desde agora, me proclamarão bem-aventurada todas as gerações, porque realizou em mim maravilhas aquele que é poderoso e cujo nome é Santo» (Lc 1, 48-49)' },
        { id: 'gl5', mysteryNum: 5, type: 'gloriosos', title: 'Coroação de Nossa Senhora no Céu', fruit: 'Confiança em Maria', description: '«Apareceu em seguida um grande sinal no céu: uma Mulher revestida do sol, a lua debaixo dos seus pés e na cabeça uma coroa de doze estrelas» (Ap 12, 1)' },
    ]
};

export function generateRosarySequence(day: MysteryDay, mode: RosaryBeadMode): RosaryStep[] {
    const steps: RosaryStep[] = [];
    const dayMysteries = mysteries[day];

    // INÍCIO
    steps.push({
        id: 'intro-1',
        type: 'intro',
        title: 'Invocação Inicial',
        content: prayers.invocacao
    });
    steps.push({
        id: 'intro-2',
        type: 'gloria',
        title: 'Glória',
        content: prayers.gloria
    });

    // MISTÉRIOS (1 a 5)
    dayMysteries.forEach((mystery, index) => {
        const decNum = index + 1;

        // Anúncio do Mistério
        steps.push({
            id: `m${decNum}-anuncio`,
            type: 'misterio',
            title: `${decNum}º Mistério: ${mystery.title}`,
            content: `${mystery.description}\nFruto: ${mystery.fruit}`,
            decadeIndex: decNum
        });

        // Se for "advanced", saltamos as contas
        if (mode === 'advanced') return;

        // Pai Nosso (Conta grande)
        steps.push({
            id: `m${decNum}-pn`,
            type: 'pai_nosso',
            title: 'Pai Nosso',
            content: prayers.paiNosso,
            decadeIndex: decNum,
            beadIndex: 0 // 0 = bead grande, 1-10 = bead pequena, 11 = gloria
        });

        // 10 Avé Marias
        for (let i = 1; i <= 10; i++) {
            steps.push({
                id: `m${decNum}-ave-${i}`,
                type: 'ave_maria',
                title: `${i}ª Avé Maria`,
                content: prayers.aveMaria,
                isDecade: true,
                decadeIndex: decNum,
                beadIndex: i
            });
        }

        // Glória e Jaculatória
        steps.push({
            id: `m${decNum}-gloria`,
            type: 'gloria',
            title: 'Glória e Jaculatória',
            content: `${prayers.gloria}\n\n${prayers.jaculatoria1}`,
            decadeIndex: decNum,
            beadIndex: 11
        });
    });

    // CONCLUSÃO
    if (mode === 'beginner') {
        for (let i = 1; i <= 3; i++) {
            steps.push({
                id: `fim-ave-${i}`,
                type: 'ave_maria',
                title: `${i}ª Avé Maria (Conclusão)`,
                content: prayers.aveMaria
            });
        }
    }
    steps.push({
        id: 'fim-salve',
        type: 'salve_rainha',
        title: 'Salve Rainha',
        content: prayers.salveRainha
    });

    // FIM
    steps.push({
        id: 'fim-concluido',
        type: 'final',
        title: 'Terço Concluído',
        content: 'Graças a Deus.'
    });

    return steps;
}

export function getMysteryForToday(): MysteryDay {
    const dayOfWeek = new Date().getDay(); // 0 is Sunday, 1 is Monday...

    if (dayOfWeek === 1 || dayOfWeek === 6) return 'gozosos'; // Monday, Saturday
    if (dayOfWeek === 2 || dayOfWeek === 5) return 'dolorosos'; // Tuesday, Friday
    if (dayOfWeek === 4) return 'luminosos'; // Thursday
    return 'gloriosos'; // Wednesday, Sunday
}
