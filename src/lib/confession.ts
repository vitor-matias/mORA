// The Confissão page's texts: the exams of conscience, what is said in the
// confessional, and the Catechism's answers to the usual doubts. Quoted from:
// - Opus Dei Portugal (opusdei.org/pt-pt): the three exams by age of March
//   2016, the guide «A Confissão: guia passo a passo» (Rodolfo Valdés, Juan
//   José Silvestre) and the «Guia para a confissão» poster made for the
//   parish of Our Lady Queen of Peace, Dublin;
// - the «Esquema para o exame de consciência» of the Ritual da Penitência
//   (Secretariado Nacional de Liturgia, 2009 edition, Apêndice III,
//   pp. 405-414), ordered by the Commandments. Its line-wrapped
//   «Julguei-me» is rejoined, «exterior ?» loses its stray space, and
//   item 26, which lacks its question mark, gets one;
// - Pope Francis's exam from «Custodisci il cuore» (LEV, 2015), in the
//   Portuguese of the Dicastério para a Evangelização's «24 Horas para o
//   Senhor» subsidy (2025, pp. 9-10);
// - the Catecismo da Igreja Católica, Portuguese edition on vatican.va.
// Spelling and capitals follow the Devocionário (pre-1990: «acções», «actos»,
// «reflectir»; «Missa», «Ele» for God; «» quotes); the wording does not change.

export interface ExamSection {
    /** The Gospel word that opens a part of the exam, above its title. */
    part?: string;
    title?: string;
    /** As the source prints them: a line can hold several related
        questions. EXAMS splits them into one per tick. */
    questions: readonly string[];
}

export interface Exam {
    id: 'criancas' | 'jovens' | 'adultos' | 'mandamentos' | 'francisco';
    /** Chip label. */
    label: string;
    intro?: string;
    sections: readonly ExamSection[];
    source: string;
}

const INTRO = `A confissão é a oportunidade de pedir perdão a Deus e de receber a sua misericórdia. Antes de se confessar, reserve alguns momentos de silêncio para reflectir no que fez e que possa ter prejudicado outras pessoas, e o que pode fazer para se tornar num cristão melhor. Uma confissão sincera permite a renovação da alma e a sua abertura à graça de Deus. As questões que se seguem podem ajudar a reflectir sobre as acções pelas quais deve pedir perdão.`;

const SOURCE_EXAMS: readonly Exam[] = [
    {
        id: 'criancas',
        label: 'Crianças',
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-criancas/',
        sections: [{
            questions: [
                'Rezo as minhas orações?',
                'Fui à Missa aos domingos?',
                'Falei do nome de Deus sem necessidade?',
                'Estive desatento ou portei-me mal na Missa ou na Igreja?',
                'Ajudei lá em casa?',
                'Fui egoísta ou não tratei com carinho os meus pais e os meus irmãos?',
                'Obedeci aos meus pais e aos meus professores?',
                'Partilho os meus brinquedos com as outras crianças?',
                'Fui impaciente? Fiquei irritado ou fui invejoso?',
                'Fui egoísta ou insisti com teimosia em fazer a minha vontade?',
                'Estou distraído e perco tempo durante as aulas?',
                'Faço os trabalhos de casa o melhor que posso? Copiei nos testes?',
                'Andei à bulha com os meus amigos e colegas?',
                'Magoei alguém, dizendo mal dessa pessoa a outros?',
                'Menti?',
                'Roubei alguma coisa? Parti ou estraguei alguma coisa dos outros?',
                'Dou bom exemplo?',
                'Tenho incentivado os outros a fazer coisas erradas?',
                'Fui egoísta nos meus pensamentos e acções?',
                'Tenho ciúmes dos outros?',
                'Deixei alguém fora dos meus jogos?',
                'Rezei pelas pessoas e tentei ajudá-las a ficar mais perto de Deus?',
            ],
        }],
    },
    {
        id: 'jovens',
        label: 'Jovens',
        intro: INTRO,
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-jovens/',
        sections: [{
            questions: [
                'Neguei ou abandonei a minha fé? Tenho a preocupação de conhecê-la melhor? Recusei-me a defender a minha fé ou fiquei envergonhado dela?',
                'Disse o nome de Deus em vão? Pratiquei o espiritismo? Manifestei falta de respeito pelas pessoas, lugares ou coisas santas?',
                'Faltei voluntariamente à Missa aos domingos ou dias de preceito? Esqueci-me de Deus, descuidando as minhas orações?',
                'Recebi a Sagrada Comunhão tendo algum pecado grave não confessado?',
                'Comunguei sem a devida reverência e sem o devido agradecimento?',
                'Fui prestável em casa? Deixei de dar carinho aos meus pais?',
                'Fui impaciente, fiquei irritado ou fui invejoso? Guardei ressentimentos ou fiquei relutante em perdoar? Estive de mau humor ou cedi à ironia? Julguei mal ou senti ódio por alguém?',
                'Deixei de estudar com empenho na escola? Cedi à preguiça? Tive falta de respeito para com os meus professores ou outros adultos?',
                'Fui violento ou participei em brigas?',
                'Fiz mal a alguma pessoa insultando-a ou falando mal dela? Revelei algum segredo ou disse coisas somente para fazer mal a outros?',
                'Tive pensamentos impuros? Falei de maneira obscena? Cometi actos impuros sozinho ou com outras pessoas? Vi imagens ou vídeos pornográficos?',
                'Contei mentiras para me desculpar, para magoar os outros ou para enaltecer a minha imagem?',
                'Roubei alguma coisa? Estraguei de propósito o que era dos outros? Fiz algum acto de vandalismo?',
                'Tenho inveja dos outros, da sua aparência, da sua popularidade, do seu trabalho, do seu dinheiro? Deixo que o meu coração fique preso ao desejo de possuir?',
                'Encorajei outros a comportarem-se mal?',
                'Consumi álcool em excesso? Usei drogas?',
                'Fui vaidoso ou egoísta nos meus pensamentos ou acções?',
                'Preferi a minha comodidade, fugindo do serviço aos outros? Tive a preocupação de aproximar os outros de Deus, com o meu exemplo e a minha palavra?',
            ],
        }],
    },
    {
        id: 'adultos',
        label: 'Adultos',
        intro: INTRO,
        source: 'https://opusdei.org/pt-pt/article/exame-de-consciencia-para-a-confissao-adultos/',
        sections: [{
            questions: [
                'Neguei ou abandonei a minha fé? Tenho a preocupação de conhecê-la melhor? Recusei-me a defender a minha fé ou tive vergonha dela? Existe algum aspecto da minha fé que eu ainda não aceito?',
                'Disse o nome de Deus em vão? Pratiquei o espiritismo ou coloquei a minha confiança em bruxos ou horóscopos? Manifestei falta de respeito pelas pessoas, lugares ou coisas santas?',
                'Faltei voluntariamente à Missa aos domingos ou dias de preceito?',
                'Recebi a Sagrada Comunhão tendo algum pecado grave não confessado?',
                'Recebi a Comunhão sem agradecimento ou sem a devida reverência?',
                'Fui impaciente, fiquei irritado ou fui invejoso?',
                'Guardei ressentimentos ou fiquei relutante em perdoar?',
                'Fui violento nas palavras ou acções com outros?',
                'Colaborei ou encorajei alguém a fazer um aborto ou a destruir embriões humanos, a praticar eutanásia ou qualquer outro meio de acabar com a vida?',
                'Tive ódio ou fiz juízos críticos, em pensamentos ou acções? Olhei os outros com desprezo?',
                'Falei mal dos outros, levando à má-língua?',
                'Abusei de bebidas alcoólicas? Usei drogas?',
                'Vi vídeos ou sites pornográficos? Cometi actos impuros, sozinho ou com outras pessoas? Vivo com alguém como se fosse casado, sem que o seja?',
                'Se sou casado, procuro amar o meu cônjuge mais do que a qualquer outra pessoa? Coloco o meu casamento em primeiro lugar? E os meus filhos? Tenho uma atitude aberta a novos filhos?',
                'Trabalho de modo desordenado, ocupando o tempo e energias que deveria dedicar à minha família e amigos?',
                'Fui orgulhoso ou egoísta nos meus pensamentos e acções? Deixei de ajudar os pobres e os necessitados? Gastei dinheiro com o meu conforto e luxo pessoal, esquecendo as minhas responsabilidades para com os outros e para com a Igreja?',
                'Disse mentiras? Fui honesto e diligente no meu trabalho? Roubei ou enganei alguém no trabalho?',
                'Cedi à preguiça? Preferi a comodidade ao invés do serviço aos outros? Descuidei a minha responsabilidade de aproximar os outros de Deus, com o meu exemplo e a minha palavra?',
            ],
        }],
    },
    {
        id: 'mandamentos',
        label: 'Mandamentos',
        intro: 'O exame do Ritual da Penitência, pelos dez mandamentos. Muitas perguntas começam por «Se sou…»: cada um responde ao que diz respeito à sua vida.',
        source: 'https://www.liturgia.pt/rituais/Penitencia.pdf',
        sections: [
            {
                title: 'Antes de mais',
                questions: [
                    'Vou aproximar-me do sacramento da Reconciliação com desejo sincero de me purificar e converter? Faço-o para renovar a vida e a amizade com Deus? Celebro o sacramento da Reconciliação com frequência? Faço-o ao menos uma vez cada ano? Quando foi que me confessei a última vez?',
                    'Esqueci ou calei, de propósito ou por vergonha, nas confissões passadas, algum pecado grave?',
                    'Cumpri a penitência que me foi imposta na última confissão? Fiz reparação das injustiças que porventura cometi? Desde a última vez que me confessei, esforcei-me por pôr em prática os propósitos de emenda e por viver segundo o Evangelho?',
                ],
            },
            {
                part: 'O Senhor diz: «Amarás o Senhor teu Deus com todo o teu coração, com toda a tua alma e com todas as tuas forças».',
                title: 'Primeiro mandamento: Adorar a Deus e amá-l’O sobre todas as coisas.',
                questions: [
                    'Adoro a Deus com todo o meu coração? Amo-O sobre todas as coisas? Cumpro fielmente os seus mandamentos?',
                    'Creio que o Pai nos falou por seu Filho? Creio que o Filho nos revelou as palavras do Pai? Creio que a santa Igreja nos ensina o Evangelho de Jesus? Desejo e espero de Deus, com firme confiança, a vida eterna e as graças para a merecer? Tenho uma vontade firme de dar a Deus o que Lhe é devido? Escuto ou leio a palavra de Deus com frequência e atenção? Procuro purificar o espírito e o coração das falsas imagens de Deus? Estudo e aprofundo o ensino do Concílio, do Papa e dos Bispos? Estou a crescer na minha formação e vida cristã? Faço parte de algum grupo de reflexão cristã na minha comunidade paroquial? Já alguma vez tive medo ou vergonha de me apresentar como cristão?',
                    'Prostro-me, em adoração, diante dos ídolos que os homens vão inventando? Divinizo o que não é Deus, como o dinheiro, o prazer, a beleza, o desporto, os artistas e desportistas, os animais de estimação, a raça, o Estado e as suas figuras públicas? Dedico mais amor ou ponho mais confiança em alguém do que em Deus? Recorro a práticas supostamente reveladoras do futuro, como a adivinhação, a magia ou a feitiçaria? Sou supersticioso e deixo-me conduzir por crendices indignas dum discípulo de Cristo? Portei-me indignamente nos lugares sagrados? As promessas que faço são verdadeiro culto a Deus inspirado no Evangelho? Os mandamentos de Deus continuam a ser a referência mais importante da minha vida? Quando os homens fazem leis contra os mandamentos de Deus, como as do divórcio, do aborto e da eutanásia, rejeito-as de todo o coração, ou aprovo-as e passo a orientar-me por elas?',
                    'Faço oração de manhã e à noite? Quando rezo o Pai nosso, faço-o com um coração simples, humilde e confiante? Rezo alguma parte da Liturgia das Horas? Se sou pai ou mãe de família, rezo com os meus filhos? Se sou jovem, convido os meus pais e irmãos a rezar comigo? A minha oração é verdadeiro diálogo íntimo com Deus? Escolho o melhor tempo para orar? No princípio de cada dia ofereço a Deus os meus trabalhos, alegrias e sofrimentos? Antes das refeições bendigo a Deus pelo alimento que me dá e peço-Lhe que dê pão a quem o não tem? Ao longo do dia levanto o pensamento para o Senhor? Peço-Lhe com frequência que me não deixe cair em tentação? A recitação do terço faz parte da minha vida de oração a Deus, por Maria?',
                ],
            },
            {
                title: 'Segundo mandamento: Não invocar o santo nome de Deus em vão',
                questions: [
                    'Invoco sempre com grande respeito o nome de Deus? Quando me levanto e quando me deito faço sobre mim o sinal da Cruz? Digo blasfémias contra as coisas santas ou falo delas sem respeito? Invoco o nome de Deus para dar credibilidade às minhas mentiras e juramentos falsos? Falto ao respeito para com o nome de Jesus, da Santíssima Virgem Maria e dos Santos?',
                ],
            },
            {
                title: 'Terceiro mandamento: Santificar os domingos e festas de guarda',
                questions: [
                    'Santifico o domingo, dia da ressurreição de Cristo, participando na Missa? Faço-o de maneira activa, piedosa e atenta? Comungo o Corpo de Cristo com frequência? Comungo ao menos pela Páscoa da Ressurreição? Faltei alguma vez à Eucaristia dominical sem ser por doença ou por outro motivo sério? Guardo também os outros dias santos de preceito e participo na assembleia litúrgica? No domingo abstenho-me de trabalhos e actividades que me impeçam de adorar a Deus? No domingo pratico as obras de misericórdia? O domingo é para mim o dia de repouso do espírito e do corpo? Impeço alguém, sem necessidade, de guardar o dia do Senhor?',
                    'Preparo-me, pela abstinência e pelo jejum de Sexta-Feira Santa, para celebrar a grande solenidade da Páscoa do Senhor? Em cada sexta-feira do ano, a abstinência de carne ajuda-me viver mais unido à morte de Cristo? O jejum e a abstinência contribuem para me fazer adquirir a liberdade de coração?',
                ],
            },
            {
                part: 'O Senhor diz: «É este o meu mandamento: que vos ameis uns aos outros, como Eu vos amei».',
                title: 'Quarto mandamento: Honrar pai e mãe e os outros legítimos superiores',
                questions: [
                    'Mostro-me reconhecido para com os meus pais pelo dom da vida que eles me transmitiram? Manifesto-lhes quanto aprecio o seu amor e canseiras, que me permitiram crescer? Já alguma vez lhes disse que nunca lhes pagarei o que fizeram por mim? Se ainda sou criança, obedeço ao que os meus pais me dizem? Também obedeço àqueles a quem os meus pais me confiaram? Se sou jovem ou adolescente e ainda vivo em casa de meus pais, obedeço com alegria ao que eles me pedem, pelo seu bem ou pelo bem da família? Se já sou adulto ou mesmo casado, continuo a respeitar os meus pais? Adivinho os seus desejos, peço os seus conselhos e aceito as suas observações? Tenho uma especial gratidão pelos meus pais de quem recebi o dom da fé, a graça do Baptismo e a vida na Igreja? Também me mostro agradecido para com os meus avós, párocos, catequistas, professores ou amigos? Se os meus pais estão velhos, doentes, sozinhos ou desanimados, presto-lhes ajuda material e moral? Estou a ser pouco paciente para com eles, agora que já não têm força nem saúde? Se os meus pais já morreram, peço a Deus que lhes dê o eterno descanso e a recompensa do seu amor?',
                    'Se sou marido ou esposa, estou a viver de modo que os meus filhos aprendam comigo a preocupar-se com as pessoas velhas, doentes e pobres? Pertenço a algum movimento de solidariedade na minha paróquia? O meu papel de pai ou mãe estende-se à educação moral e à formação cristã dos meus filhos? Ou apenas me preocupa a sua formação intelectual e humana? Olho os meus filhos como filhos de Deus? Respeito-os como pessoas? Ensino os meus filhos a cumprir a lei de Deus, mostrando-me eu próprio obediente à vontade do Pai dos Céus? Faço todo o possível para que no meu lar haja ternura, perdão, respeito, fidelidade e serviço desinteressado aos mais pobres? Sou o primeiro a dar à minha família o exemplo da abnegação, do autodomínio, da tolerância e da verdadeira liberdade? Estou a ensinar aos meus filhos que os valores do espírito são mais importantes que os do corpo? Reconheço diante deles os meus defeitos, para me tornar mais capaz de os guiar e corrigir a eles? Comecei a interessar os meus filhos, desde pequenos, pela vida da Igreja? A catequese familiar que lhes dou, acompanha e enriquece as outras formas de transmissão da fé? Ensino os meus filhos a rezar e a descobrir a sua vocação de filhos de Deus? Vejo na minha paróquia e na Missa dominical o lugar privilegiado da minha catequese e dos meus filhos? Na medida do possível uso do meu direito de escolher as escolas que melhor me apoiem na tarefa de educar cristãmente os meus filhos? Estou convencido de que a primeira vocação dos meus filhos, porque são cristãos, é a de seguir Jesus? Peço ao Senhor a graça de algum deles desejar segui-l’O na vida religiosa ou no ministério sacerdotal?',
                    'Se tenho autoridade sobre alguém, exerço-a como um serviço? Se atendo os cidadãos num serviço público, faço-o com respeito e disponibilidade? Fiz ou mandei fazer o que é contrário à dignidade das pessoas e à lei natural? Procedo como cidadão livre mas consciente dos meus deveres? Abuso da liberdade para fazer o que não devo? Tenho o respeito que é devido às autoridades legítimas? Cumpro o meu papel na vida da comunidade política, pagando os impostos e exercendo o direito de voto? Respeito, defendo e trato como irmãos os estrangeiros que vivem e trabalham no meu país? Rejeito as leis que não respeitam os direitos fundamentais da pessoa humana e das famílias? Oponho-me, em consciência, às prescrições civis contrárias à moral cristã?',
                ],
            },
            {
                title: 'Quinto mandamento: Não matar nem causar outro dano, no corpo ou na alma, a si mesmo ou ao próximo',
                questions: [
                    'O Evangelho da vida encontra um eco profundo no meu coração? Alegro-me por ver a Igreja a ser sempre a favor da vida? Defendo o valor sagrado da vida humana desde o seu início até ao seu termo? Seria capaz de justificar algum crime contra a vida em nome da liberdade individual? Se sou profissional da saúde, médico, enfermeiro ou enfermeira, estou a ser aliado da cultura da vida? Se trabalho nos meios de comunicação social, estou empenhado na luta a favor da vida? Apresento o recurso à contracepção, à esterilização, ao aborto e à eutanásia como sinal de retrocesso e atentados à vida? As posições a favor da vida contam sempre com a minha adesão? Tenho bem firme na minha consciência que matar alguém voluntariamente é um pecado muito grave contra a lei de Deus? Cometi algum assassínio? Participei nalgum atentado violento contra a vida ou a integridade física dos outros? Aconselhei, procurei ou provoquei o aborto?',
                    'Tenho verdadeiro amor ao meu próximo? Amo-o como a mim mesmo por amor de Deus? Amo-o como Jesus nos amou? Abuso do meu próximo? Sirvo-me dele para os meus fins? Faço-lhe a ele o que não quero que me façam a mim? Fui para ele ocasião de escândalo grave com as minhas palavras e acções? Considero como meu próximo todo o ser humano, de qualquer raça, cor, religião ou cultura?',
                    'Deixei-me dominar pela cólera até ao ponto de desejar matar ou ferir gravemente o meu próximo? Tenho ódio a alguém? Permiti que alguma ofensa ou discussão acabasse com uma amizade sincera? Destruí o bom nome e a reputação de alguém?',
                    'Colaboro em estruturas sociais que levam à degradação dos costumes e à corrupção da vida religiosa? Se tenho poder sobre algum meio de comunicação, sirvo-me dele para manipular a opinião pública, desviando-a dos valores morais? Abuso da comida, da bebida e dos medicamentos? Ponho em risco a segurança e a vida dos outros, conduzindo em estado de embriaguez ou com velocidade excessiva? Sou vendedor ou consumidor de droga?',
                ],
            },
            {
                title: 'Sexto mandamento: Guardar castidade nas palavras e nas obras',
                questions: [
                    'Guardei o meu corpo na pureza e na castidade? Manchei a minha carne com relações sexuais fora do matrimónio? Pratiquei a impureza? Deixei-me dominar pelo prazer? Disse palavras indignas e obscenas? Tenho feito leituras, assistido a espectáculos e participado em divertimentos contrários à honestidade cristã? Com as minhas atitudes levei outros ao pecado? No meu ambiente de trabalho, a minha linguagem e atitudes são dignas de um cristão?',
                    'Se tenho namorada ou namorado, estou a fazer do namoro uma preparação séria para o casamento segundo a vontade de Deus? Cultivamos entre nós o respeito mútuo e a verdade? Os nossos gestos de amizade estão a ser dignos de discípulos de Cristo? Estamos a ser sinceros um com o outro ou andamos a enganar-nos? Pedimos a Deus, na nossa oração comum, a graça de virmos a ser um casal unido todos os dias da nossa vida? Nos nossos gestos de amizade guardamos respeito um ao outro como irmãos em Cristo? Pedimos ajuda a Deus e um ao outro nas nossas dificuldades mútuas? A fidelidade inviolável no nosso matrimónio e o respeito mútuo são para mim, já desde agora, valores indiscutíveis? Se sou homem casado ou mulher casada, prefiro a minha esposa ou o meu marido à minha própria vida? Ponho o seu amor acima de tudo? Sou fiel à minha promessa de fidelidade conjugal? Cultivo sinceramente a virtude da castidade conjugal?',
                ],
            },
            {
                title: 'Sétimo mandamento: Não furtar nem injustamente reter ou danificar os bens do próximo',
                questions: [
                    'Furtei ou guardei injustamente coisas alheias, nomeadamente dinheiro? Restituí o que roubei, ou ainda o guardo em meu poder? Cometi fraudes? Causei voluntariamente dano em propriedades privadas ou públicas? Não restituí bens emprestados ou objectos perdidos?',
                    'Se sou dono ou responsável de alguma empresa, pago salários justos aos trabalhadores? Cumpro os compromissos assumidos e os contratos que fiz com eles? Retenho os descontos que lhes são feitos para a Segurança Social? Na minha empresa há condições de trabalho dignas?',
                    'Se sou trabalhador, procuro merecer o que ganho? Realizo o meu trabalho com perfeição? Sou fiel aos compromissos que assumi livremente? Vejo o trabalho numa perspectiva cristã, como uma realização pessoal, uma colaboração com Jesus na sua obra redentora e um meio de santificação de mim próprio?',
                    'Reparto os meus bens com os que são mais pobres do que eu? Tenho um amor de predilecção pelos pobres? Defendo os oprimidos, ajudo os infelizes, socorro os necessitados? Desprezo os pobres, os fracos, os velhos, os estrangeiros, os homens de outra raça? Pertenço a algum movimento ou obra paroquial que procura estar perto das necessidades dos que mais precisam? Os mais pobres e infelizes encontram no meu lar acolhimento e ajuda fraterna?',
                    'Contribuo, segundo as minhas posses, para as necessidades da minha comunidade paroquial, suas obras apostólicas e de caridade? Destino uma parte dos meus rendimentos para a honesta sustentação dos ministros do Evangelho, segundo as determinações da Igreja? A minha contribuição é dada com generosidade?',
                    'Estimo os animais e trato-os com delicadeza? Faço-os sofrer inutilmente ou desprezo as suas vidas? Gasto com eles somas que deveriam aliviar a miséria humana? Tenho por eles o afecto só devido às pessoas?',
                ],
            },
            {
                title: 'Oitavo mandamento: Não levantar falsos testemunhos (nem de qualquer outro modo faltar à verdade ou difamar o próximo)',
                questions: [
                    'Levo uma vida simples e verdadeira conforme ao exemplo de Jesus? Falei ou agi contrariamente à verdade? Fiz reparação do mal que causei a alguém com as minhas mentiras? Evito a duplicidade, a simulação e a hipocrisia? Digo sempre o que deve ser dito e guardo segredo do que deve ser guardado? Manifesto, pelo exemplo da minha vida e pelo testemunho da palavra, que sou cristão?',
                    'Sou ponderado e comedido nos juízos que faço dos outros e nos meus comportamentos e atitudes? Jurei falso a propósito de alguma pessoa? Revelei os defeitos e faltas de outrem? Prejudiquei a reputação dos outros por atitudes contrárias à verdade? Destruí a reputação e a honra do próximo com a minha maledicência e calúnia? Com palavras ou gestos irónicos depreciei alguém? Sou constante e forte no meio das dificuldades? Deixo-me abater e desanimar diante dos obstáculos?',
                ],
            },
            {
                title: 'Nono mandamento: Guardar castidade nos pensamentos e nos desejos',
                questions: [
                    'Guardei os meus sentidos na pureza e na castidade? Lutei contra os pensamentos indignos? Afastei do meu coração os maus sentimentos e desejos? As minhas intenções foram honestas? Sou puro no meu olhar interior e exterior? Peço a Deus que me dê a virtude da continência?',
                ],
            },
            {
                title: 'Décimo mandamento: Não cobiçar as coisas alheias',
                questions: [
                    'Peço a Deus que me conduza pelo seu Espírito? Prefiro Jesus e o seu Evangelho a todos os valores? Cultivo o espírito de pobreza de Cristo, que Se fez pobre por causa de nós? Cobicei as coisas alheias? Ponho a minha felicidade na abundância de bens ou na vida com Deus? Tenho desejos desmedidos de possuir bens terrenos e poder? Desapego-me das riquezas para entrar no Reino dos Céus? Desejei cometer alguma injustiça para me apoderar dos bens do próximo? Ordenei rectamente os meus afectos às pessoas e às coisas? Afastei os meus desejos de tudo o que não me pertence? Tenho inveja de alguém? Tenho inveja de não ser eu o único a possuir ou a saber uma coisa? Sinto alegria ou fico triste com o progresso dos outros? Tive inveja ao ver a prosperidade do meu próximo? Desejei vingar-me de alguém? Desejei um mal grave ou a infelicidade a alguém? Tenho verdadeira sede de Deus? Sou discreto e equilibrado no uso dos bens criados?',
                ],
            },
            {
                part: 'Nosso Senhor Jesus Cristo diz: «Sede perfeitos como o Pai do Céu é perfeito»',
                questions: [
                    'O espírito das bem-aventuranças está a purificar o meu coração? Está a levar-me a procurar o amor de Deus acima de tudo? Está a ensinar-me que a verdadeira felicidade não reside em qualquer riqueza, poder, glória ou obra humana, nem em qualquer criatura, mas só em Deus? Estou a progredir nos caminhos que conduzem ao Reino dos Céus?',
                    'O sentido e valor fundamental da minha vida é Deus? Vivo animado pela esperança da vida eterna? O ser interior que há em mim está a crescer com a idade? Tenho um programa de vida espiritual? Desse programa faz parte a oração, a leitura da palavra de Deus e a participação frequente na Eucaristia e na Reconciliação? Estou a lutar contra os meus defeitos, más inclinações e paixões? Julguei-me superior a alguém? Pretendo ter sempre razão e impor a minha vontade? Dou pouco valor às opiniões e palavras dos outros? Tenho falta de delicadeza no trato com o meu próximo? Estou a fazer render os dons que Deus me deu? Utilizo mal o meu tempo? Passo os dias sem fazer nada?',
                    'Tenho sabido aceitar as doenças e contrariedades da vida com espírito cristão? As dores maiores e mais difíceis têm-me unido à paixão de Jesus Cristo?',
                ],
            },
        ],
    },
    {
        id: 'francisco',
        label: 'Papa Francisco',
        intro: 'O exame de consciência que o Papa Francisco ofereceu aos fiéis em 2015, em «Custodisci il cuore». Para adultos, em três partes.',
        source: 'https://www.evangelizatio.va/content/dam/pcpne/image/24ore/2025/PT%20Sussidio%2024ore%2025.pdf',
        sections: [
            {
                title: 'Para com Deus',
                questions: [
                    'Só me dirijo a Deus em caso de necessidade?',
                    'Vou à Missa aos domingos e dias de preceito?',
                    'Começo e termino o dia com a oração?',
                    'Invoco o nome de Deus, da Virgem, dos Santos em vão?',
                    'Tenho vergonha de me mostrar cristão?',
                    'O que faço para crescer espiritualmente? Como? Quando?',
                    'Revolto-me perante os desígnios de Deus?',
                    'Exijo que Ele faça a minha vontade?',
                ],
            },
            {
                title: 'Para com os outros',
                questions: [
                    'Sei perdoar, compadecer-me, ajudar o próximo?',
                    'Caluniei, roubei, desprezei os pequenos e indefesos?',
                    'Sou invejoso, colérico, parcial?',
                    'Preocupo-me com os pobres e os doentes?',
                    'Envergonho-me do meu irmão, da minha irmã?',
                    'Sou honesto e justo com todos, ou alimento a «cultura do desperdício»?',
                    'Incitei os outros a fazer o mal?',
                    'Observo a moral conjugal e familiar ensinada pelo Evangelho?',
                    'Como vivo a minha responsabilidade educativa para com os meus filhos? Honro e respeito os meus pais?',
                    'Rejeitei a vida assim que foi concebida?',
                    'Extingui o dom da vida? Ajudei a fazê-lo?',
                    'Respeito o ambiente?',
                ],
            },
            {
                title: 'Para consigo mesmo',
                questions: [
                    'Sou um pouco mundano e um pouco crente?',
                    'Exagero a comer, a beber, a fumar, a divertir-me?',
                    'Preocupo-me demasiado com a minha saúde física, com os meus bens?',
                    'Como é que utilizo o meu tempo? Sou preguiçoso?',
                    'Quero ser servido?',
                    'Amo e cultivo a pureza do coração, dos pensamentos e das acções?',
                    'Cultivo a vingança, guardo rancor?',
                    'Sou manso, humilde, construtor de paz?',
                ],
            },
        ],
    },
];

/** One tick per question. The sources group related questions on one line,
    and each «?» ends one; a fragment that only makes sense after the one
    before it («Como? Quando?», «E os meus filhos?», «Ou apenas…?», «Ajudei a
    fazê-lo?») stays with it. */
export function splitQuestions(line: string): string[] {
    const out: string[] = [];
    for (const part of line.split(/(?<=\?)\s+/)) {
        const leansOnPrevious = !/\s/.test(part) || /^(E|Ou) /.test(part) || /-l[oa]\?$/.test(part);
        if (leansOnPrevious && out.length) out[out.length - 1] += ` ${part}`;
        else out.push(part);
    }
    return out;
}

/** The exams as the page shows them, one question per tick. */
export const EXAMS: readonly Exam[] = SOURCE_EXAMS.map((exam) => ({
    ...exam,
    sections: exam.sections.map((section) => ({ ...section, questions: section.questions.flatMap(splitQuestions) })),
}));

export const EXAM_GUIDE_URL = 'https://opusdei.org/pt-pt/article/guia-breve-confissao-jubileu-misericordia/';
export const CATECHISM_URL = 'https://www.vatican.va/archive/cathechism_po/index_new/prima-pagina-cic_po.html';

/** Our own cue, above every exam: the list is a reminder, not a script. */
export const HOW_TO = 'Cada pergunta marca-se com um toque. A lista que se forma é só um lembrete: na confissão, dizemos os pecados por palavras nossas.';

/** From the guide: the questions are a help, not a form. It opens «Servem»;
    the subject is named here because the sentence no longer follows them. */
export const EXAM_NOTE = `As perguntas servem apenas como uma orientação: o mais importante é entrar no próprio coração e admitir as próprias faltas. Se queremos, durante a confissão podemos pedir ao sacerdote que nos ajude propondo-nos outras questões.`;

/** The guide's «4 C» of a good confession. */
export const FOUR_CS: readonly (readonly [string, string])[] = [
    ['Clara', 'indicar qual foi a falta específica, sem acrescentar desculpas.'],
    ['Concreta', 'referir o acto ou pensamento preciso, não usar frases genéricas.'],
    ['Concisa', 'evitar dar explicações ou descrições desnecessárias.'],
    ['Completa', 'sem calar nenhum pecado grave, vencendo a vergonha.'],
];

/** The guide on contrition: sorrow need not be felt to be real. */
export const CONTRITION_NOTE = `Por vezes, o arrependimento chega com um sentimento intenso de dor ou vergonha, que nos ajuda a emendar-nos. No entanto, não é indispensável sentir esse tipo de dor; o importante é compreender que agimos mal, ter desejos de melhorar como cristãos e fazer o propósito de não voltar a cometer essas faltas.`;

export const PENANCE_NOTE = `A satisfação consiste no cumprimento de certos actos de penitência (orações, alguma mortificação, etc.), que o confessor indica ao penitente para reparar o dano causado pelo pecado. É uma ocasião também para dar graças a Deus pelo perdão recebido e renovar o propósito de não voltar a pecar.`;

/** The Catechism's answers to what people ask before confessing. The
    question is our own wording; the answer is the Catechism's. */
export const DOUBTS: readonly { question: string; answer: string; cic: string }[] = [
    {
        question: 'O que torna um pecado grave?',
        cic: '1857, 1860',
        answer: `Para que um pecado seja mortal, requerem-se, em simultâneo, três condições: «É pecado mortal o que tem por objecto uma matéria grave, e é cometido com plena consciência e de propósito deliberado».

A ignorância involuntária pode diminuir, ou mesmo desculpar, a imputabilidade duma falta grave. […] Os impulsos da sensibilidade e as paixões podem também diminuir o carácter voluntário e livre da falta. O mesmo se diga de pressões externas e de perturbações patológicas.`,
    },
    {
        question: 'Tenho de dizer todos os pecados? E se me esquecer de algum?',
        cic: '1456',
        answer: `«Os penitentes devem, na confissão, enumerar todos os pecados mortais de que têm consciência, após se terem seriamente examinado […]». «Quando os fiéis se esforçam por confessar todos os pecados de que se lembram, não se pode duvidar de que os apresentam todos ao perdão da misericórdia divina.»`,
    },
    {
        question: 'Vale a pena confessar pecados leves?',
        cic: '1458',
        answer: `Sem ser estritamente necessária, a confissão das faltas quotidianas (pecados veniais) é contudo vivamente recomendada pela Igreja. Com efeito, a confissão regular dos nossos pecados veniais ajuda-nos a formar a nossa consciência, a lutar contra as más inclinações, a deixarmo-nos curar por Cristo, a progredir na vida do Espírito.`,
    },
    {
        question: 'O sacerdote pode contar a alguém?',
        cic: '1467',
        answer: `Dada a delicadeza e a grandeza deste ministério e o respeito devido às pessoas, a Igreja declara que todo o sacerdote que ouve confissões está obrigado a guardar segredo absoluto sobre os pecados que os seus penitentes lhe confessaram, sob penas severíssimas. Tão pouco pode servir-se dos conhecimentos que a confissão lhe proporciona sobre a vida dos penitentes. Este segredo, que não admite excepções, é chamado «sigilo sacramental», porque aquilo que o penitente manifestou ao sacerdote fica «selado» pelo sacramento.`,
    },
    {
        question: 'E se não me puder confessar?',
        cic: '1452',
        answer: `Quando procedente do amor de Deus, amado sobre todas as coisas, a contrição é dita «perfeita» (contrição de caridade). Uma tal contrição perdoa as faltas veniais: obtém igualmente o perdão dos pecados mortais, se incluir o propósito firme de recorrer, logo que possível, à confissão sacramental.`,
    },
];

export type RiteLine =
    | { who: 'penitente' | 'sacerdote'; text: string }
    /** A cue in the app's own words, or a prayer from the Devocionário by id. */
    | { who: 'nota'; text: string; prayerId?: string };

/** Under the «No confessionário» heading: the greeting, the counsel and the
    dismissal are the priest's own, so the dialogue is a guide, not a script. */
export const RITE_NOTE = 'As palavras do sacerdote podem variar.';

/** The Dublin poster's five steps. The spoken lines are the poster's, except
    the Sign of the Cross and the act of contrition, which the Devocionário
    carries in the form prayed in Portugal, and the absolution, which is the
    full formula as the Catechism gives it (n.º 1449). */
export const RITE: readonly (readonly RiteLine[])[] = [
    [
        { who: 'nota', text: 'Depois dos cumprimentos, fazemos o sinal da cruz:' },
        { who: 'penitente', text: 'Em nome do Pai e do Filho e do Espírito Santo.' },
        { who: 'sacerdote', text: 'O Senhor esteja no teu coração para que confesses os teus pecados com espírito arrependido.' },
    ],
    [
        { who: 'penitente', text: 'Já se passaram… dias / semanas / anos desde a minha última confissão.' },
        { who: 'nota', text: 'Se não sabemos ao certo, basta um número aproximado.' },
        { who: 'penitente', text: 'Os meus pecados são…' },
        { who: 'nota', text: 'Confessamos os pecados por palavras nossas, começando pelos mais graves.' },
    ],
    [
        { who: 'nota', text: 'O sacerdote dá-nos alguns conselhos e indica-nos uma penitência, habitualmente uma oração.' },
    ],
    [
        { who: 'nota', text: 'Exprimimos o arrependimento com um acto de contrição:', prayerId: 'acto-de-contricao-simples' },
    ],
    [
        { who: 'nota', text: 'Com a fórmula da absolvição, é o próprio Jesus que nos perdoa:' },
        { who: 'sacerdote', text: 'Deus, Pai de misericórdia, que, pela morte e ressurreição de seu Filho, reconciliou o mundo consigo e enviou o Espírito Santo para a remissão dos pecados, te conceda, pelo ministério da Igreja, o perdão e a paz. E Eu te absolvo dos teus pecados em nome do Pai, e do Filho e do Espírito Santo.' },
        { who: 'nota', text: 'Respondemos:' },
        { who: 'penitente', text: 'Amen.' },
        { who: 'nota', text: 'No fim, o sacerdote despede-nos em paz.' },
    ],
];
