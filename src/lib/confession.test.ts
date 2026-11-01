import source from '../pages/Confissao.tsx?raw';
import { describe, expect, it } from 'vitest';
import { getPrayer } from '@/lib/devotional';
import { CONTRITION_NOTE, DOUBTS, EXAM_NOTE, EXAMS, FOUR_CS, HOW_TO, PENANCE_NOTE, RITE, RITE_NOTE, splitQuestions } from './confession';

const QUESTIONS = EXAMS.flatMap((e) => e.sections.flatMap((s) => s.questions));
const ALL_TEXT = [
    ...EXAMS.flatMap((e) => [e.intro ?? '', ...e.sections.flatMap((s) => [s.part ?? '', s.title ?? ''])]),
    ...QUESTIONS,
    HOW_TO, EXAM_NOTE, CONTRITION_NOTE, PENANCE_NOTE, RITE_NOTE,
    ...FOUR_CS.flat(),
    ...DOUBTS.flatMap((d) => [d.question, d.answer]),
    ...RITE.flat().map((line) => line.text),
];

describe('exams of conscience', () => {
    it('has every exam, each with questions', () => {
        expect(EXAMS.map((e) => e.id)).toEqual(['criancas', 'jovens', 'adultos', 'mandamentos', 'francisco']);
        for (const exam of EXAMS) {
            expect(exam.sections.flatMap((s) => s.questions).length).toBeGreaterThan(10);
        }
    });

    it('splits a source line into one question per tick', () => {
        expect(splitQuestions('Consumi álcool em excesso? Usei drogas?')).toEqual(['Consumi álcool em excesso?', 'Usei drogas?']);
        expect(splitQuestions('Menti?')).toEqual(['Menti?']);
    });

    it('keeps a fragment that leans on the question before it', () => {
        expect(splitQuestions('O que faço para crescer espiritualmente? Como? Quando?')).toEqual(['O que faço para crescer espiritualmente? Como? Quando?']);
        expect(splitQuestions('Coloco o meu casamento em primeiro lugar? E os meus filhos? Tenho uma atitude aberta a novos filhos?'))
            .toEqual(['Coloco o meu casamento em primeiro lugar? E os meus filhos?', 'Tenho uma atitude aberta a novos filhos?']);
        expect(splitQuestions('Extingui o dom da vida? Ajudei a fazê-lo?')).toEqual(['Extingui o dom da vida? Ajudei a fazê-lo?']);
        expect(splitQuestions('Olho os meus filhos? Ou apenas me preocupa a sua formação?')).toEqual(['Olho os meus filhos? Ou apenas me preocupa a sua formação?']);
    });

    it('loses no words in the split', () => {
        const line = 'Furtei ou guardei injustamente coisas alheias, nomeadamente dinheiro? Restituí o que roubei, ou ainda o guardo em meu poder? Cometi fraudes?';
        expect(splitQuestions(line)).toHaveLength(3);
        expect(splitQuestions(line).join(' ')).toBe(line);
    });

    it('asks a question on every line', () => {
        for (const question of [...QUESTIONS, ...DOUBTS.map((d) => d.question)]) expect(question).toMatch(/\?$/);
    });

    it('keeps the Devocionário spelling and punctuation', () => {
        // The sources are post-1990; these are the forms that slip through.
        const modern = /\b(ação|ações|ato|atos|atua|atue|refletir|aspeto|ativ\w*|objeto|exceções)\b/i;
        for (const text of ALL_TEXT) {
            expect(text).not.toMatch(modern);
            expect(text).not.toContain('—');
            expect(text).not.toMatch(/[“”]/);
        }
    });

    it('points the rite at prayers that exist', () => {
        for (const line of RITE.flat()) {
            if (line.who === 'nota' && line.prayerId) expect(getPrayer(line.prayerId)).toBeDefined();
        }
        expect(getPrayer('acto-de-contricao')).toBeDefined();
        expect(getPrayer('exame-de-consciencia')).toBeDefined();
    });
});

describe('Confissão page privacy', () => {
    // What someone marks in an exam of conscience must never outlive the page.
    // The page has no tests that render it, so guard its source instead: any
    // way of keeping or sending the marks has to be added here on purpose.
    it('imports nothing that could keep or send the marks', () => {
        const imports = [...source.matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]).sort();
        expect(imports).toEqual([
            '@/components/PrayerText', '@/components/layout/PageHeader', '@/lib/confession',
            '@/lib/devotional', 'lucide-react', 'react', 'react-router-dom',
        ]);
    });

    it.each([
        'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'cookie',
        'useAppStore', 'useAuthStore', 'zustand', 'persist(',
        'useSearchParams', 'useNavigate', 'history.', '<input', '<form',
        'fetch(', 'sendBeacon', 'WebSocket', 'postMessage', 'BroadcastChannel',
        'navigator.share', 'clipboard', 'console.', 'nostr', 'publish',
    ])('never uses %s', (api) => {
        expect(source).not.toContain(api);
    });
});
