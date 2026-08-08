// Checks the verse pool. Run it after editing verses.js.
//
//   npm run verify
//
// The last check is the one that matters most: it puts the answer back into
// the blank, strips the ellipses, and requires the result to appear verbatim
// somewhere in the corpus. Everything else here catches a malformed entry; that
// one catches a *misquoted* one, which is the failure nobody would notice.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VERSES } from './verses.js';
import { normalizeWord } from './palavra.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = process.env.PALAVRA_CORPUS
    ?? path.resolve(HERE, '../../../portuguese-capuchine-translation/usfm-nv');

const MIN_LEN = 35, MAX_LEN = 110;
const MIN_FOLD = 5, MAX_FOLD = 8;
const MAX_ANSWER_USES = 3;

// The publisher's own function, not a copy: checking the pool with a
// different fold than the one that builds it would defeat the point.
const fold = normalizeWord;
const norm = (s) => s.replace(/\s+([!?;:,.»])/g, '$1').replace(/«\s+/g, '«').replace(/\s+/g, ' ').trim();

function loadCorpus() {
    if (!fs.existsSync(CORPUS)) return null;
    let blob = '';
    for (const f of fs.readdirSync(CORPUS)) {
        const raw = fs.readFileSync(path.join(CORPUS, f), 'utf8');
        blob += ' ' + raw
            .replace(/\\v\s+\d+\s*/g, ' ')
            .replace(/\\c\s+\d+\s*/g, ' ')
            .replace(/\\\+?[a-z0-9]+\*?/gi, ' ')
            .replace(/\*/g, ' ');
    }
    return norm(blob).toLowerCase();
}

const problems = [];
const refs = new Set();
const uses = {};
const corpus = loadCorpus();

for (const [i, e] of VERSES.entries()) {
    const at = `#${i} ${e.ref ?? '(no ref)'}`;
    if (!e.ref || !e.verse || !e.answer) { problems.push(`${at}: missing field`); continue; }

    if (!e.verse.includes('{{blank}}')) problems.push(`${at}: no {{blank}}`);

    const a = fold(e.answer);
    if (a.length < MIN_FOLD || a.length > MAX_FOLD) {
        problems.push(`${at}: "${e.answer}" folds to ${a.length}, want ${MIN_FOLD}-${MAX_FOLD}`);
    }

    // Every occurrence must be blanked, or the answer sits beside its own gap.
    const rest = fold(e.verse.split('{{blank}}').join(' '));
    if (a && rest.includes(a)) problems.push(`${at}: answer still visible in the text`);

    if (e.verse.length < MIN_LEN || e.verse.length > MAX_LEN) {
        problems.push(`${at}: ${e.verse.length} chars, want ${MIN_LEN}-${MAX_LEN}`);
    }
    if (/[\\*]| {2}/.test(e.verse)) problems.push(`${at}: markup artifact or double space`);
    if (refs.has(e.ref)) problems.push(`${at}: duplicate ref`);
    refs.add(e.ref);

    // `full` is what the app shows after the reveal, so it must be the plain
    // verse — a stray blank marker would print "{{blank}}" at the player, and
    // an ellipsis would mean an excerpt got copied in where the whole verse
    // was meant to go.
    if (!e.full) {
        problems.push(`${at}: no full verse`);
    } else {
        if (e.full.includes('{{blank}}')) problems.push(`${at}: full still has a blank marker`);
        if (e.full.includes('…')) problems.push(`${at}: full is an excerpt, not the whole verse`);
        if (/[\\*]| {2}/.test(e.full)) problems.push(`${at}: markup artifact in full`);
        // The answer has to be in there, or the reveal has nothing to point at.
        if (a && !fold(e.full).includes(a)) problems.push(`${at}: answer missing from full`);
        if (e.full.length > 600) problems.push(`${at}: full is ${e.full.length} chars`);
    }
    if (e.refUrl) problems.push(`${at}: refUrl is obsolete — the app carries the text, not a link`);

    // Keyed on the folded form: `graça` and `graca` are one word to the
    // player, so they must share a cap.
    uses[a] = (uses[a] ?? 0) + 1;

    if (corpus) {
        // Case-insensitive: `answer` is stored lowercase, but the corpus
        // capitalises titles (Messias, Salvador, Reino). That is a difference
        // in the field, not in the quotation.
        const filled = norm(e.verse.split('{{blank}}').join(e.answer).replace(/…/g, '')).toLowerCase();
        // Trim the ends: an ellipsis can cut mid-word at either edge.
        const probe = filled.length > 40 ? filled.slice(2, -2) : filled;
        if (!corpus.includes(probe)) problems.push(`${at}: verse NOT VERBATIM in the corpus`);

        if (e.full) {
            const whole = norm(e.full).toLowerCase();
            if (!corpus.includes(whole)) problems.push(`${at}: full NOT VERBATIM in the corpus`);
        }
    }
}

for (const [answer, n] of Object.entries(uses)) {
    if (n > MAX_ANSWER_USES) problems.push(`answer "${answer}" used ${n}x, cap is ${MAX_ANSWER_USES}`);
}

const dist = {};
for (const e of VERSES) dist[fold(e.answer).length] = (dist[fold(e.answer).length] ?? 0) + 1;

console.log(`${VERSES.length} entries`);
console.log(`  books        ${new Set(VERSES.map((e) => e.ref.replace(/\s+\d+,\d+$/, ''))).size}`);
console.log(`  lengths      ${JSON.stringify(dist)}`);
console.log(`  excerpts     ${VERSES.filter((e) => e.verse.includes('…')).length}`);
console.log(`  multi-blank  ${VERSES.filter((e) => e.verse.split('{{blank}}').length > 2).length}`);
const skipCorpus = process.argv.includes('--allow-missing-corpus');
console.log(corpus ? '  corpus       checked verbatim' : `  corpus       SKIPPED (not found at ${CORPUS})`);

// Without the corpus the only check that catches a *misquoted* verse doesn't
// run, and everything else passing says nothing about whether the text is
// real. A green run that verified nothing is worse than a red one, so this
// fails unless the caller opted out — which CI does, because the texts are
// not in this repository.
if (!corpus && !skipCorpus) {
    console.error(`\ncorpus not found at ${CORPUS}`);
    console.error('Set PALAVRA_CORPUS, or pass --allow-missing-corpus to skip the verbatim check.');
    process.exit(1);
}

if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
    if (problems.length > 40) console.error(`  …and ${problems.length - 40} more`);
    process.exit(1);
}
console.log('\nall clean');
