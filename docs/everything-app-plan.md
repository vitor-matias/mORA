# Oremus: the Catholic everything app

*Plan written 2026-10-31. Owner: Vítor. Status: proposal.*

## 1. Goal

A Portuguese Catholic's phone typically has a folder of nine apps: one for the
Mass readings, one for the Hours, one for the Rosary, one for prayers, a Bible,
a confession guide, a catechism, Church documents and a guided-prayer app.
Oremus should replace that folder with one app, in faithful European
Portuguese, built around **one daily page**.

Positioning in one line: *the pt-PT app that replaces the whole folder.*

What Oremus already has that none of the nine has, and which this plan must not
dilute:

- Texts checked word for word against pt-PT sources, in pre-1990 orthography.
- Streaks, the Resumo da Semana and the Saturday summary.
- Palavra, the daily scripture game, with duels and leagues.
- Theming that follows the liturgical colour of the day.
- A portable, self-owned identity (Nostr) with no account to create.

## 2. Where we stand

| App in the folder | Its job | Oremus today | Gap | Phase |
|---|---|---|---|---|
| LiturgiaDiaria | Mass readings | **Missa Diária** (`/liturgia`). Missa guiada is [PR #32](https://github.com/vitor-matias/mORA/pull/32), open, 26 commits ahead of `main` | Land the PR | 0 |
| Liturgia (CEP) | Liturgy of the Hours | **Liturgia das Horas** (`/liturgia-horas`), official audio already plays ([LiturgiaHoras.tsx:862](../src/pages/LiturgiaHoras.tsx)) | None in features. Licence (see 2.1) | 2 |
| Pocket Terço | Rosary, novenas | **Coroas** (`/coroas`): Rosary plus eight chaplets | **Novenas** | 1 |
| Católico | Prayers, saint of the day | **Devocionário**, SaintOfDay card | Small | none |
| Peregrinus | Prayers, liturgy, confession, Bible | A nightly exame in [dia.ts](../src/lib/devotional/dia.ts) | **Confession guide** | 1 |
| Bíblia Ave Maria | Bible | Home links out to biblia.capuchinhos.org | **Bible inside the app** | 1 |
| Laudate | Prayers, Church documents | Devocionário | **Documents** (as links) | 1 |
| YOUCAT Daily | Five minutes of teaching a day | Compêndio formulas only ([formulas.ts](../src/lib/devotional/formulas.ts)) | **Catechism of the day** (licence) | 2 |
| Hallow | Guided audio prayer | Text only | **Guided prayer**, then audio | 1, 3 |

**The Bible is not a licensing problem.** The Palavra publisher already quotes
the Bíblia dos Capuchinhos verbatim, and its README records that the rights
are held by this project's owner ([server/palavra/README.md](../server/palavra/README.md),
"Licensing is settled"). The full corpus sits next to the repo at
`../portuguese-capuchine-translation/usfm-nv`: 73 books, 5 MB of USFM
(7.7 MB with notes and introductions in `usfm-notes-intro`).

## 3. Principles

These hold for every phase. A feature that breaks one does not ship.

1. **One daily spine.** Home stays the hub. Daily items appear on Home only
   while they are active (a novena in progress, today's question). Everything
   else joins the **Explorar** list in [Home.tsx](../src/pages/Home.tsx)
   (`exploreAreas`). No sixth tab.
2. **Verified texts only.** Every prayer is quoted from a named pt-PT source,
   never written from memory. Pre-1990 orthography ("acção", "Baptismo",
   "Amen."), no em dashes in reader-facing copy. Modern authored texts stay
   out unless their rights holder says yes.
3. **Private by default.** Anything confessional never touches storage or the
   network. Sync stays opt-in and encrypted.
4. **Offline first.** New corpora are static JSON under `public/`, built by a
   script in `tools/`, the way `public/lh` is built by `npm run parse-lh`.
5. **Reuse the engines.** The devotional corpus ([types.ts](../src/lib/devotional/types.ts)),
   the bead player ([chaplets/index.ts](../src/lib/chaplets/index.ts)), streaks
   ([store/app.ts](../src/store/app.ts)), reminders
   ([reminderSchedule.ts](../src/lib/reminderSchedule.ts)), search
   ([textSearch.ts](../src/lib/textSearch.ts)) and Nostr sync
   ([useNostrSync.ts](../src/lib/useNostrSync.ts)) cover most of what follows.
   New engines need a reason.

## 4. Phase 0: ship what is built (2 to 6 November)

### 0.1 Land Missa guiada

- Bring PR #32 up to date with `main` (it last merged `main` on 29 October),
  run `npm test` and `npm run build`, review the copy against the house rules,
  merge.
- **Done when** the guided mode is live on the deployed app.

### 0.2 Start every licence conversation now

These take months, so the emails go out in week one, in parallel with Phase 1.
Details in Phase 2.

- Secretariado Nacional de Liturgia / CEP: Mass and Hours texts.
- Libreria Editrice Vaticana and the publisher of the pt-PT Compêndio:
  catechism of the day.

## 5. Phase 1: fill the gaps with what exists (November 2026 to January 2027)

Ordered by deadline, not size. The liturgical year sets the dates.

### 1.1 Novenas (must ship by 27 November)

**Why now:** the Novena da Imaculada Conceição runs 29 November to
7 December, and Advent starts on 29 November. The Novena do Natal follows,
16 to 24 December.

**Data.** `src/lib/novenas/`, in the same style as the devotional corpus:

```ts
interface Novena {
    id: string;              // stable slug: URL and storage key
    title: string;
    note?: string;           // provenance or occasion
    opening?: string[];      // Prayer ids said every day (from src/lib/devotional)
    days: { title: string; text: string }[];   // exactly 9
    closing?: string[];      // Prayer ids said every day
    /** When the Church usually starts it: a fixed "MM-DD", or days before Easter. */
    starts?: { fixed: string } | { easterOffset: number };
}
```

**First set**, each quoted from paroquias.org or paroquiapeniche.pt and
checked like the devotional corpus:

| Novena | Usual dates |
|---|---|
| Imaculada Conceição | 29 Nov to 7 Dec |
| Natal | 16 to 24 Dec |
| São José | 10 to 18 Mar |
| Divina Misericórdia | Good Friday to the Saturday after Easter (26 Mar to 3 Apr 2027) |
| Nossa Senhora de Fátima | 4 to 12 May |
| Espírito Santo | the nine days before Pentecost (16 May 2027) |
| Santo António | 4 to 12 Jun |
| Sagrado Coração | the nine days before the Solemnity |

Check the Divina Misericórdia text's source before using it: the novena comes
from St Faustina's Diary, and the pt-PT translation may be copyrighted.

**State.** Add `activePlans: { id: string; startedOn: string; daysDone: number[] }[]`
to the app store, bump the persisted version and extend `migrateAppState`.
Sync it in the same merged payload as the starred prayers. A novena is a
nine-day plan and +365 (1.4) is a 365-day one, so build the plan state once
and both use it.

**UI.**

- Catalogue: a "Novenas" category in the Devocionário, route
  `/novenas/:novenaId?` in [main.tsx](../src/main.tsx).
- Reading view: "Dia 3 de 9", today's text between the shared opening and
  closing, and a "Rezei hoje" button.
- Home: one card **only** while a novena is active, or within three days of a
  usual start date ("A Novena da Imaculada começa domingo").
- Reminder: one `ReminderEntry` per active novena, opening `#/novenas/<id>`.

**Rules to settle and test.** Missing a day doesn't reset anything, matching
popular practice: the novena shows the next unprayed day and the date it was
meant for. Starting late is allowed. Finishing clears it from Home.

**Tests:** day-of-nine from `startedOn` and today, including missed days and a
start across a month boundary; the Easter offset (computus, about ten lines);
a corpus test that every novena has nine days and every opening and closing id
exists.

**Done when** a user can start the Imaculada novena on 29 November, gets a
daily reminder and sees "Dia N de 9" on Home.

### 1.2 Confissão (by mid-December, before the Advent penitential services)

**Status (1 November):** v1 is built at `/confissao`, reviewed by a panel of
six agents.

- **What it has**, all in `src/lib/confession.ts`:
  - the Opus Dei Portugal exams for children, young people and adults;
  - Pope Francis's exam (the Dicastery's official pt-PT text);
  - five Catechism answers (grave sin, saying everything, venial sins, the
    seal, perfect contrition);
  - the five steps with the full absolution formula (CIC 1449), the «4 C»
    and the penance note.
- **How it behaves:** each exam keeps its own list, the ticks clear after 15
  minutes away, and an import allowlist guards the privacy promise.
- **No usable pt-PT exam found** for married couples or parents, the sick,
  priests, or a full exam by the Commandments. The best candidates need
  permission first:
  - the Fundação AIS exam ("todos os direitos reservados", ~156 questions, by
    Commandment, with spouses, parents and precepts);
  - the Lajedo (Açores) parish exam (no named author);
  - the Bruno Forte decalogue in D. António Marto's letter (Leiria-Fátima).
- **Still to do:** a priest's review; LEV/Dicastery permission for the
  Francisco text; children's 6th/9th Commandment and young people's digital
  life (no sources yet).

**Route:** `/confissao`, listed in Explorar.

**Content**, each section from a verified source:

1. *Como me confessar:* the steps of the rite, checked against the Ritual da
   Penitência (official pt-PT text from liturgia.pt or the printed ritual).
2. *Exame de consciência:* by the Commandments and the precepts of the Church
   (both already in `formulas.ts`), with variants by state of life (children,
   young people, married, single). Needs a pt-PT source; do not author it.
3. *Acto de contrição:* reuse the entry in `comuns.ts`.
4. *Depois da confissão:* link to thanksgiving prayers in the Devocionário.

**Privacy (non-negotiable).**

- Ticked items live in component state only: no Zustand, no `localStorage`,
  no sync, no share button.
- Leaving the page clears them, and so does a "Limpar" button.
- Say so on screen: "Nada do que marca aqui fica guardado."
- A test renders the page, ticks items and asserts that `localStorage` is
  unchanged.

**AI, and where it stops.** The exam is where AI is most tempting and most
dangerous. What a penitent types is the most private thing they will ever
write, and no provider's data retention is covered by the seal of confession.
Judging whether something is grave is the confessor's job, and a model that
gets it wrong feeds either scruples or complacency. So:

- *Yes, before release.* AI helps build the question bank from the verified
  sources: variants by age and state of life (young people especially), plain
  pt-PT rewrites, a "Porquê?" note on each question pointing to its
  Commandment and Catechism paragraph, and tags so the screen shows only what
  applies. A priest reviews every question before it ships. The user then
  picks their state of life and how long since their last confession, and the
  phone filters the bank. It feels personal and nothing leaves the device.
- *No, at run time.* No chat, no free text sent anywhere, no verdict on
  gravity, nothing that sounds like absolution.
- *Maybe, later.* Where the browser offers an on-device model (nothing sent),
  free text could point to the matching questions, and do only that.
  Revisit once such models are on most phones.

**Done when** the guide works offline and the privacy test passes.

### 1.3 Bíblia in the app (December)

**Corpus build.** `tools/parse-bible.ts` reads `usfm-nv` and writes:

- `public/biblia/index.json`: book order, pt names and abbreviations (from the
  `\toc1`, `\toc2` and `\toc3` markers: "Evangelho de São Lucas", "Lucas", "Lc").
- `public/biblia/<abbr>.json`: chapters, verses, and section headings (`\s`).
  Strip the corpus's `*` verse markers, which are not text.
- A `npm run verify-bible` check that re-reads the USFM and compares every
  verse, the way `server/palavra/verify.js` does.

Books are fetched on demand and cached by the service worker (cache-first),
not precached, so the install stays small. Leave the notes and introductions
out of v1.

**Reader.** `/biblia/:book?/:chapter?` replaces the external `href` on the
Home Explorar entry. Book grid, then chapter grid, then text, using the
existing text-size and theme settings.

**References.** A parser for Portuguese citations ("Lc 10, 1-9",
"Is 52, 13 – 53, 12", "Sl 22 (23)") with unit tests covering each form the
Mass data uses. Then:

- Missa: the reference above each reading opens the passage.
- Palavra: the solved verse opens its chapter.

**Search** (after the reader ships): fold-accent search with `textSearch.ts`,
one book at a time to keep memory down.

**Done when** tapping the Gospel reference on Missa opens the passage, and it
still opens offline after the first view.

### 1.4 +365: a Bíblia num ano, com a EJNS (by 31 December)

**What it is.** +365 is the daily podcast of the Equipas Jovens de Nossa
Senhora: the whole Bible in a year, about 20 minutes a day, each day's
readings followed by a short commentary and prayer from a priest. It started
on 1 January 2026 and today (1 November) is Dia 305. Its plan appears to
follow Ascension's Bible in a Year (Dia 1 is Génesis 1–2 and Salmo 19).

**Why by 31 December.** 1 January is when people start a Bible-in-a-year.
Whether or not EJNS runs a second year, the archive lets anyone start at
Dia 1 on any day.

**What the feed gives** (checked 2026-11-01):

- RSS at `https://anchor.fm/s/fbcf8b30/podcast/rss`, served with
  `Access-Control-Allow-Origin: *`, so the app reads it directly. No proxy,
  no Worker.
- 318 items, 700 KB: 304 days so far and 14 introductions to the biblical
  periods ("Introdução à Criação do Mundo").
- The title carries the day ("Dia 305 - O defensor"). The description names
  the readings in prose ("Hoje vamos ler 2 Macabeus 8; Sabedoria 5–6;
  Provérbios 24:30-34") and the priest.
- Audio: 17 to 24 MB per episode, on Spotify's CDN.

**Build.**

- `src/lib/mais365.ts`: fetch the feed, keep only what the app needs (day,
  title, period, priest, readings, audio URL, duration), cache it, refresh
  once a day.
- Readings: the reference parser from 1.3, extended to full book names and
  the colon form ("Provérbios 24:30-34"). A small alias map covers where the
  feed and the Capuchinhos index differ: "Obadias" is *Abdias*, "Salmo" is
  *Salmos*, and "Deuteronômio" (a Brazilian spelling that slips in) is
  *Deuteronómio*.
- Test: a saved snapshot of the feed as a fixture. Every "Dia N" episode must
  yield at least one reading, and every reading must resolve to a real book
  and chapter in the Bible index. The wording varies ("vamos ler", "lemos:",
  "Hoje, no tempo do Egipto e Êxodo lemos"), and a quick regex missed 6 of the
  304 days, so the test runs over all of them.
- Player: a native `<audio>` streaming the enclosure URL exactly as published,
  so EJNS's play counts still count. Never re-host the audio. Media Session for
  lock-screen and headphone controls, playback speed, and resuming where you
  stopped.
- Text: under the player, the day's passages from the in-app Bible (1.3), to
  read along. Until 1.3 ships, the readings link out the way the Bible does
  today.
- Progress: a 365-day plan on the plan state from 1.1. Two modes: *Com todos*
  (the episode EJNS published today) and *Ao meu ritmo* (the next day you
  haven't finished). A day counts as done at about 90% played, or with
  "Ouvi e li".
- Home card while active: "+365 · Dia 42 · Génesis 30–31 · 20 min". A daily
  reminder through `ReminderEntry`. An Explorar entry. Add it to the streaks
  and to the Resumo da Semana.

**Ask EJNS first** (apoio@ejns.pt):

- Their blessing and the credit line they want.
- Which Bible translation the readings use. If it isn't the Capuchinhos text,
  the screen and the audio will differ slightly, and the app should say so.
- Whether a 2027 cycle is planned.
- Whether they would share the reading plan as data.

A public RSS feed exists for apps to play, so this is courtesy and partnership
more than a licence. Their goodwill is still worth more than the shortcut, and
their audience (ages 16 to 26) is exactly who Oremus needs.

**Not in v1:** downloading episodes for offline (17 to 24 MB each),
transcripts, our own commentary.

**Done when** someone can start at Dia 1 on 1 January, hear the episode from
the lock screen, read the same passages in the app, and see "Dia N" on Home.

### 1.5 Documentos da Igreja (January, small)

A curated list in Explorar linking to the pt pages on vatican.va: Vatican II
constitutions, recent encyclicals and exhortations, the Catechism. Links only,
as the Bible was, so there are no rights to clear. One static array, no route
beyond the list.

### 1.6 Rezar com o Evangelho: guided lectio divina (January)

Hallow's core without the recording studio.

- Entry point: a button under the Gospel on Missa.
- Four steps in a sheet ([Sheet.tsx](../src/components/Sheet.tsx)):
  *Lectio* (today's Gospel, from the Mass data already fetched), *Meditatio*
  (three short questions, written once in house style and the same every day),
  *Oratio*, *Contemplatio* (a 2, 5 or 10 minute timer with the screen kept
  awake and a haptic at the end). Close with the Pai-Nosso.
- No new streak in v1. Add one only if people use it.

**Done when** it works on any day the Mass loads, including Sundays read
the night before.

### 1.7 Via-Sacra, step by step (by 10 February 2027, Ash Wednesday)

The Devocionário has a short Via-Sacra ([senhor.ts:893](../src/lib/devotional/senhor.ts))
listing the fourteen stations. Turn it into a stepped prayer through the bead
player: one step per station, with the versicle, a meditation from a verified
pt-PT source, and the Pai-Nosso, Avé-Maria and Glória. It's the most-prayed
devotion of Lent in Portugal, and Lent Fridays are a natural reminder.

## 6. Phase 2: licensed content (start now, ship when granted)

### 2.1 Mass and Hours (the existential risk)

Today the Mass and Hours come from the private backend of the CEP's
"LITURGIA" app (`apiapp.glauco.it`), without a licence. The texts are
© CEP / Secretariado Nacional de Liturgia.

- **Ask:** permission for a free, ad-free app to show the texts, ideally with a
  supported feed, and in return a credit line and a link to their app.
- **If refused:** there is no clean fallback, since the liturgia.pt PDFs are
  SNL texts too. Keep the client-side cache, keep the date validation in
  [liturgy.ts](../src/lib/liturgy.ts), and treat this as the top risk.

### 2.2 Catecismo do dia (YOUCAT Daily, done our way)

- **Text:** the Compêndio do Catecismo (598 questions and answers) suits one a
  day. The full CIC (2865 paragraphs) is the deeper second option. Both are
  © LEV. YOUCAT is © YOUCAT Foundation and is not the target.
- **Once licensed:** `public/catecismo/compendio.json`; a Home card
  "Pergunta do dia" that walks the questions in order from the day the user
  starts (sequential, because catechesis builds on itself), with a reminder
  option and the existing streak plumbing.
- **If refused:** keep the formulas already in the Devocionário and link to the
  Catechism on vatican.va (1.5).

## 7. Phase 3: audio (2027)

Cheapest first.

1. **The official audio we already have.** Hours verses carry `audio_url`.
   Add a "play the whole Hour" queue with Media Session controls (lock screen,
   headphones). Check whether the Mass data carries audio too.
2. **Rosary audio.** The Rosary is a small, closed set of texts: the Sinal da
   Cruz, Credo, Pai-Nosso, Avé-Maria, Glória, Ó meu Jesus, Salvé-Rainha and
   the twenty mystery announcements. About thirty clips cover every mystery.
   Spike pt-PT text-to-speech first (device voices vary a lot); if it sounds
   wrong, record one human voice. The bead player then advances with the audio.
3. **Guided meditations.** Only after (2) proves people listen. Needs both
   authored texts and a voice, so it's the most expensive item in this plan.

## 8. Phase 4: distribution (Q1 to Q2 2027)

- **Android:** a Trusted Web Activity (Bubblewrap) puts the same PWA in the
  Play Store with no second codebase. Push and offline keep working. The
  status bar shows the manifest colour, as it already does on Android 15+.
- **iOS:** the PWA stays the path. A Capacitor wrapper means native push
  (APNs) and App Store review under guideline 4.2, so do it only if Android
  shows the stores bring real users.
- **Identity:** keep Nostr underneath, but onboarding never says "Nostr":
  start on the local anonymous key and make "guardar a minha chave" (backup)
  prominent once there are streaks worth keeping.

## 9. Home as the daily spine

By the end of Phase 2, Home holds, in this order and only when relevant:

1. Today (feast, colour, saint).
2. Rezar: Missa, Horas (current hour), Coroas, Devocionário, Cânticos.
3. Active plans: a novena (1.1) or +365 (1.4), while one is running.
4. Pergunta do dia (2.2), once licensed and started.
5. Explorar: Bíblia, Confissão, Documentos, Resumo da Semana, Diretório,
   Palavra.

Each new card has to earn its place. One that's ignored for a month gets folded
back into Explorar.

## 10. AI and new ideas

### 10.1 Rules for AI in a prayer app

1. **AI chooses and reads; it never writes what is prayed or taught.**
   Everything a user prays, or reads as Church teaching, stays a verified text
   with a named source (principle 2).
2. **Build time before run time.** Most of the help is in our own tools
   (tagging, proofreading, generating audio), with a human signing off.
   A model runs while the user is in the app only where a fixed corpus can't
   do the job.
3. **Nothing personal goes to a model.** Confissão never sends anything to a
   model. AI only helps build its question bank before release (1.2).
   Free-text searches and intentions reach a model only through our own
   Worker, with no logging, and the screen says so.
4. **No persona.** No AI priest, saint or "spiritual director". In April 2024
   Catholic Answers launched an AI priest, "Father Justin", and dropped the
   priest persona within days after it presented itself as a priest and
   offered to hear confessions. The Holy See's note *Antiqua et nova*
   (January 2025) is the reference for where the line sits.

### 10.2 AI ideas, ranked

**A1. Rezar por uma necessidade.** Chips such as "Luto", "Doença",
"Ansiedade", "Exames", "Viagem", "Gratidão", "Família" open the prayers,
psalms, hymns, saints and (once 1.3 ships) Bible passages that fit.

- v1: an LLM pass over the corpus proposes tags, Vítor reviews them, and they
  are stored as `needs?: string[]` on each `Prayer` (and the chant and
  chaplet types). Offline, nothing at run time, cheap.
- v2: free text ("o meu filho saiu de casa") matched by embeddings, using a
  multilingual model on Workers AI (for example bge-m3) over the same corpus.
  Results are always verbatim texts with their source, never generated prose.
- When: v1 in January; v2 after the Bible reader, so verses join the index.

**A2. Neural voices for the fixed texts.** A pt-PT neural text-to-speech
voice generates the ~30 Rosary clips (3.2) and the devotional audio at build
time. Every clip is listened to before it ships as a static file. This turns
the Rosary audio from a studio job into an afternoon. The Mass and Hours stay
with the official audio (CEP texts). Separately, an "Ouvir" button on any text
uses the device's own voice (`speechSynthesis`) as an accessibility feature.
When: the Phase 3 spike, and it can move earlier.

**A3. Perguntar ao Catecismo.** A question returns the matching Catechism or
Compêndio paragraphs, quoted with their numbers. A one-paragraph summary may
sit above them, labelled as written by AI. Needs the LEV licence (2.2). The
alternative to building it is partnering with an existing Catholic retrieval
service (Magisterium AI has an API; check its terms and its pt-PT quality).
When: only after 2.2.

**A4. Corpus proofreader (internal).** An LLM check in CI flags
Brazilianisms, post-1990 spelling, em dashes and wording that drifts from the
cited source. It's a second net next to the existing shingle diff, not a
replacement. When: now, before the novena texts land.

**A5. A public-domain library.** AI drafts pt-PT translations of classics
that have no public-domain pt-PT version (for example, Church Fathers'
homilies on the Sunday Gospel). Each is reviewed by a competent human (a
priest or theologian) and labelled as a translation. That gives a weekly
commentary without needing LEV or CEP rights. The bottleneck is reviewer
time, not the AI. When: pilot the six Sundays of Lent 2027 first.

### 10.3 New ideas that need no AI

**N1. Terço a dois.** The app prays the second half of each Avé-Maria and the
user the first, the way two choirs alternate in church. Turn-taking comes from
noticing when the user stops speaking: an audio level on the device, with no
speech recognition and nothing recorded or sent. Needs the clips from A2. No
app in the folder does this. When: Phase 3.

**N2. Terço em família à distância.** One person starts a session and shares a
link. Everyone's bead player moves together, with the avatars of who is
present. It runs on Nostr ephemeral events (kinds 20000 to 29999, which relays
forward but don't store). It's built for the diaspora: families split between
Portugal, France, Switzerland and Luxembourg. Voice stays on whatever call
they already use. When: Q2 2027.

**N3. Caminhos do tempo litúrgico.** Advent and Lent as a daily path: one
short step a day (a reading, a prayer, a small act), and a badge at the end
using the badge artwork pipeline Palavra already has. For Lent, private
check-ins for prayer, fasting and almsgiving. This is where the gamification
belongs. When: the Lent path by 10 February 2027; Advent waits for 2027,
since this November belongs to the novenas.

**N4. Modo Peregrino.** For the walking pilgrimages to Fátima (May and
October) and the Portuguese Caminho de Santiago: an offline kit per day
(morning prayer, the Rosary on the road, the travellers' blessing, the Fátima
prayers), with group mode from N2. Walking groups share apps with each other,
so this is also how Oremus spreads. When: by late April 2027, for the
13 May pilgrimages.

**N5. Correntes de oração.** Post an intention to a closed group (a Palavra
league, or the people you follow). Members tap "Rezei" and you see the count.
It's encrypted to the group and nothing is public, so there's no moderation
queue. When: Q2 2027.

**N6. Paróquia no Nostr.** Parishes publish their Mass times and notices as
signed events, and users follow their parish. This answers "there is no data
source for Mass times" by letting parishes be the source. Pilot it with one or
two parishes before building more. When: an experiment, Q2 2027 or later.

**N7. "Tenho 5 minutos".** One button on Home picks what fits the time and
the hour: five minutes gives the Gospel or a decade, fifteen the current Hour,
twenty-five the Rosary. Rule-based. When: January, it's tiny.

**N8. Versículo da semana.** Learn one verse a week, with more words hidden
each day, on the Palavra board. When: after the Bible reader.

**N9. Partilhar com o padrinho.** Send your Resumo da Semana to one person (a
godparent or spiritual director) as an encrypted message. When: any time,
it's small.

**If only four get built:** A1 (daily use from the corpus we already have),
N3 (it has a deadline and carries the gamification), N1 (nobody else has it)
and N4 (it's Portuguese and it spreads the app).

### 10.4 Spending the first $100 of AI credits

Credits are a one-off, so spend them on build-time jobs that leave a
permanent, reviewed asset. Don't spend them on a run-time feature whose bill
outlives them. Corpus sizes, measured 2026-10-31, at roughly 3.5 to 4
characters per token:

| Corpus | Size | Tokens per pass |
|---|---|---|
| Devocionário, Coroas, Cânticos | 314 K chars, 147 prayers | ~85 K |
| Liturgia das Horas (`public/lh`) | 787 K chars | ~210 K |
| Bible (`usfm-nv`) | 5.06 M chars, 3,861 sections | ~1.3 M |

In order:

1. **Need tags for the prayers, chaplets and hymns (A1 v1).** One pass, almost
   free. It does the most per dollar: someone grieving reaches the right prayer
   in two taps.
2. **"Quando…" index of the Bible.** Tag the 3,861 sections (`\s` headings)
   by need and occasion: the classic "where to read when I am afraid", for the
   whole Bible. Most of the budget goes here. Run 50 sections first and
   extrapolate the cost before running the rest.
3. **Proofread everything (A4).** Corpus plus Hours, about 300 K tokens. Cheap,
   and it catches errors before users do.
4. **Draft the Lent path (N3).** Forty-six daily small acts: practical prompts,
   not prayers or teaching, and every line edited by hand.
5. **Patristic Sundays (A5).** Cheap in tokens, expensive in review. Only if a
   reviewer has said yes.
6. **Keep the rest** for A1 v2 or the neural voices (A2), depending on what
   the credits can buy.

## 11. Not doing

| Idea | Why not |
|---|---|
| Parish and Mass-times finder | No reliable data source in Portugal; stale times are worse than none |
| Social feed or community beyond Palavra | Moderation cost, and not why people open a prayer app |
| pt-BR or other languages | pt-PT accuracy is the moat |
| Open AI chat, an AI persona, AI anywhere in Confissão | Conflicts with "verified texts only" and the rules in 10.1 |
| Donations and payments | Not needed to run; adds store and tax work |
| Own saints' biographies | The CEP text is already shown; writing our own is a corpus of its own |
| Usage analytics | None today. If ever needed, aggregate and cookie-free only |

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| SNL/CEP refuses, or the private API changes or closes | Mass and Hours go dark | Start talks in week one; keep the client cache and validation; keep the data access in one module |
| API serves the wrong day | Wrong readings shown | Date validation already in `liturgy.ts` |
| LEV refuses | No catechism of the day | Formulas stay; link to vatican.va |
| Novena slips past 27 November | Miss the Imaculada and Advent | Ship the engine with Imaculada and Natal only; add the rest later |
| Confession data leaks | Trust gone for good | Never persisted; test enforces it |
| Bible grows the install | Slow first load | Per-book JSON, runtime cache, no precache |
| A text quoted from memory | A Portuguese user spots it immediately | Every text has a named source and a check script |
| EJNS objects, or the +365 feed moves or ends | Lose the podcast | Ask first; cache the feed; the plan and the Bible text still work without the audio |
| AI text mistaken for Church teaching | Doctrinal error under our name | Rules in 10.1: AI picks verified texts, generated text is labelled and human-reviewed |
| Scope creep | Nothing ships | Section 11, and "if only four" in 10.3 |

## 13. Timeline

| When | What | Hard date |
|---|---|---|
| 2 to 6 Nov | Land Missa guiada; send licence emails | |
| 9 to 27 Nov | Novenas engine + Imaculada + Natal; corpus proofreader (A4) | Imaculada starts 29 Nov |
| 30 Nov to 11 Dec | Confissão | Advent penitential services |
| Dec | Bíblia reader, references from Missa and Palavra | Natal novena starts 16 Dec |
| by 31 Dec | +365 player and plan (1.4); email EJNS in November | New Year's starters, 1 Jan |
| Jan 2027 | Documentos; Rezar com o Evangelho; remaining novenas; Rezar por uma necessidade v1 (A1); "Tenho 5 minutos" (N7) | |
| by 10 Feb | Via-Sacra step by step; Lent path (N3); patristic Sundays pilot (A5) | Ash Wednesday 10 Feb |
| by 10 Mar | São José novena live | 10 Mar |
| by 26 Mar | Divina Misericórdia novena (if the text clears) | Good Friday 26 Mar |
| Q1 to Q2 | Android TWA; Hours audio queue; neural Rosary voice (A2), then Terço a dois (N1) | |
| by late Apr | Modo Peregrino (N4) | Fátima pilgrimages, 13 May |
| Q2 | Terço em família à distância (N2); Correntes de oração (N5); parish pilot (N6) | |
| when granted | Catecismo do dia; Mass and Hours licence | |

## 14. Open decisions for Vítor

1. Novenas inside the Devocionário, or their own Explorar entry?
2. Sync active novenas across devices, or keep them on the device?
3. Include the Bible's notes and introductions in v1 (adds 2.7 MB), or later?
4. Rosary audio: text-to-speech or a recorded voice, and whose?
5. Go to the app stores at all, or stay PWA-only?
6. Any AI at run time (A1 v2, A3), or build-time AI only?
7. Who reviews AI-drafted translations (A5), and is there time for it?
8. +365's default mode: *Com todos* or *Ao meu ritmo*?
9. Which priest reviews the exame's question bank (1.2)?
