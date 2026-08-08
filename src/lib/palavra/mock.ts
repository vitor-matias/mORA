// A stand-in for the real puzzles, used when VITE_PALAVRA_PUBLISHER_PUBKEY is
// unset. It exists so the game is playable and testable before a publisher
// key is configured — everything it returns follows the contract in
// server/palavra/README.md exactly, so switching to real puzzles is a
// matter of setting the env var.
//
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { answerHash, normalizeWord, obfuscateAnswer } from './game';
import { BLANK_MARKER, type DailyChallenge } from './types';

/**
 * Text is the Bíblia dos Capuchinhos, verbatim from the corpus at
 * ../../../portuguese-capuchine-translation, mirroring server/palavra/verses.js.
 * `full` is the complete verse, shown in the app once the game is over —
 * `verse` is often only an excerpt of it. Nothing links out: the whole
 * translation is available locally, so the passage is carried, not fetched.
 * See that file for the licensing note and for how the hidden word is chosen.
 */
const VERSES: { ref: string; verse: string; answer: string; full: string }[] = [
    { ref: 'Salmo 119,105', verse: `A tua ${BLANK_MARKER} é farol para os meus passos e luz para os meus caminhos.`, answer: 'palavra', full: `A tua palavra é farol para os meus passos e luz para os meus caminhos.` },
    { ref: 'Salmo 121,2', verse: `O meu ${BLANK_MARKER} vem do Senhor que fez o céu e a terra.`, answer: 'auxílio', full: `O meu auxílio vem do Senhor que fez o céu e a terra.` },
    { ref: 'Salmo 51,12', verse: `Cria em mim, ó Deus, um coração puro; renova e dá firmeza ao meu ${BLANK_MARKER}.`, answer: 'espírito', full: `Cria em mim, ó Deus, um coração puro; renova e dá firmeza ao meu espírito.` },
    { ref: 'Provérbios 3,5', verse: `Confia no Senhor, de todo o teu ${BLANK_MARKER}, e não te fies na tua própria inteligência!`, answer: 'coração', full: `Confia no Senhor, de todo o teu coração, e não te fies na tua própria inteligência!` },
    { ref: 'Isaías 53,6', verse: `Todos nós andávamos desgarrados como ${BLANK_MARKER} perdidas, cada um seguindo o seu caminho…`, answer: 'ovelhas', full: `Todos nós andávamos desgarrados como ovelhas perdidas, cada um seguindo o seu caminho. Mas o Senhor carregou sobre ele todos os nossos crimes.` },
    { ref: 'Mateus 6,21', verse: `Pois, onde estiver o teu ${BLANK_MARKER}, aí estará também o teu coração.`, answer: 'tesouro', full: `Pois, onde estiver o teu tesouro, aí estará também o teu coração.` },
    { ref: 'Mateus 6,33', verse: `Procurai primeiro o ${BLANK_MARKER} de Deus e a sua justiça, e tudo o mais se vos dará por acréscimo.`, answer: 'reino', full: `Procurai primeiro o Reino de Deus e a sua justiça, e tudo o mais se vos dará por acréscimo.` },
    // João 1,14 rather than 1,1 for this word. The Capuchinhos wording of 1,1
    // is "No princípio havia o Verbo; o Verbo estava em Deus; e o Verbo era
    // Deus" — three occurrences, so blanking one leaves the answer printed
    // twice on the same line. 1,14 says it once.
    { ref: 'João 1,14', verse: `E o ${BLANK_MARKER} fez-se homem e veio habitar connosco…`, answer: 'verbo', full: `E o Verbo fez-se homem e veio habitar connosco. E nós contemplámos a sua glória, a glória que possui como Filho Unigénito do Pai, cheio de graça e de verdade.` },
    { ref: 'João 1,29', verse: `…«Eis o ${BLANK_MARKER} de Deus, que tira o pecado do mundo!`, answer: 'cordeiro', full: `No dia seguinte, ao ver Jesus, que se dirigia para ele, exclamou: «Eis o Cordeiro de Deus, que tira o pecado do mundo!` },
    { ref: 'João 8,12', verse: `…«Eu sou a luz do mundo. Quem me segue não andará nas ${BLANK_MARKER}, mas terá a luz da vida.»`, answer: 'trevas', full: `Jesus falou-lhes novamente: «Eu sou a luz do mundo. Quem me segue não andará nas trevas, mas terá a luz da vida.»` },
    { ref: 'João 14,6', verse: `…Eu sou o Caminho, a ${BLANK_MARKER} e a Vida. Ninguém pode ir até ao Pai senão por mim.`, answer: 'verdade', full: `Jesus respondeu-lhe: «Eu sou o Caminho, a Verdade e a Vida. Ninguém pode ir até ao Pai senão por mim.` },
    { ref: 'João 15,5', verse: `Eu sou a ${BLANK_MARKER}; vós, os ramos. Quem permanece em mim e Eu nele, esse dá muito fruto…`, answer: 'videira', full: `Eu sou a videira; vós, os ramos. Quem permanece em mim e Eu nele, esse dá muito fruto, pois, sem mim, nada podeis fazer.` },
    { ref: 'Romanos 6,23', verse: `É que o salário do ${BLANK_MARKER} é a morte; ao passo que o dom gratuito que vem de Deus é a vida eterna…`, answer: 'pecado', full: `É que o salário do pecado é a morte; ao passo que o dom gratuito que vem de Deus é a vida eterna, em Cristo Jesus, Senhor nosso.` },
    { ref: 'Efésios 2,8', verse: `Porque é pela ${BLANK_MARKER} que estais salvos, por meio da fé.…`, answer: 'graça', full: `Porque é pela graça que estais salvos, por meio da fé. E isto não vem de vós; é dom de Deus;` },
    { ref: 'Filipenses 4,13', verse: `De tudo sou capaz naquele que me dá ${BLANK_MARKER}.`, answer: 'força', full: `De tudo sou capaz naquele que me dá força.` },
];

/** Same date, same verse, on every device and every reload. */
function verseForDate(date: string) {
    const digest = sha256(utf8ToBytes(`mora-palavra-mock:${date}`));
    // Two bytes is plenty of spread for a pool this size, and keeps the index
    // well clear of any modulo bias worth worrying about here.
    const index = ((digest[0] << 8) | digest[1]) % VERSES.length;
    return VERSES[index];
}

export function mockDailyChallenge(date: string): DailyChallenge {
    const { ref, verse, answer, full } = verseForDate(date);
    // The displayed verse keeps its accents; only the answer is folded to the
    // 26 keys, which is what makes the length below the playable length.
    const normalized = normalizeWord(answer);
    return {
        date,
        ref,
        full,
        verse,
        length: normalized.length,
        answerHash: answerHash(date, answer),
        answerCipher: obfuscateAnswer(date, answer),
        // From the date, not the clock — otherwise the same call returns
        // different payloads either side of midnight, and an archive day
        // gets the rollover of the day it was loaded on. Matches what
        // buildPuzzle does for published puzzles.
        nextPuzzleAt: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) + 86_400,
    };
}

// Nothing else to mock: the server has one endpoint. Results, rankings, duels
// and leagues are all Nostr, and against real relays either way.
