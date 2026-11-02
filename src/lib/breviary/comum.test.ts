import { describe, expect, it } from 'vitest';
import { parseComum } from './comum.ts';
import type { PdfLine } from './pdfLines.ts';

describe('parseComum audiences', () => {
    const line = (text: string, h = 10, x = 28): PdfLine => ({ p: 1, y: 0, x, h, text, items: [] });

    const blocks = parseComum([
        line('COMUM DOS SANTOS', 12, 100),
        line('Laudes', 10, 130),
        line('CÂNTICO EVANGÉLICO (Benedictus)'),
        line('Para um Santo', 9, 50),
        line('Ant. Primeira.', 10, 43),
        line('Para um Santo Educador', 9, 50),
        line('Ant. Segunda.', 10, 43),
        line('PRECES'),
        line('Peçamos a Deus Pai.'),
        line('Pai nosso', 9, 100),
        line('Oração', 9, 130),
        line('Oração própria. Na sua falta, uma das seguintes:', 9, 43),
        line('Coleta de todos.'),
        line('Para um Santo Religioso', 9, 50),
        line('Coleta do religioso.'),
    ]).hours['Laudes'].map((b) => [b.kind, b.variant]);

    it('ends with their section, and each section can name its own', () => {
        expect(blocks).toEqual([
            ['ant-benedictus', 'Para um Santo'],
            ['ant-benedictus', 'Para um Santo Educador'],
            ['preces', undefined],
            ['rubrica', undefined],
            ['rubrica', undefined],
            ['oração', undefined],
            ['oração', 'Para um Santo Religioso'],
        ]);
    });
});
