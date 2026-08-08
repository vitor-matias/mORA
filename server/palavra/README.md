# Palavra Bíblica do Dia — the publisher

**There is no server.** A cron publishes each day's puzzle to Nostr at 00:00
UTC, and the app reads it back. The app half lives in `src/lib/palavra/`.

The app was already a Nostr client for everything social — the daily ranking,
streaks, duels, leagues — so putting the puzzle on the same transport removes
an entire moving part: nothing to keep online, no CORS, no rate limiting, no
hosting bill. The archive comes free, because every past day is still an event
on the relays.

Until `VITE_PALAVRA_PUBLISHER_PUBKEY` is set the app falls through to
`src/lib/palavra/mock.ts`, which serves the same shape from a built-in pool of
fifteen verses. The game is fully playable in that mode; the UI badges it as
demo data.

## Setup

**1. Install and generate the publisher key.**

```bash
cd server/palavra
npm install
npm run keygen
```

`keygen` prints a keypair:

```
PALAVRA_NSEC=nsec1…                  # keep secret — this signs the puzzles
VITE_PALAVRA_PUBLISHER_PUBKEY=079e…  # public — give this to the app
```

**Generate it once and keep it.** Rotating the key orphans every puzzle already
on the relays, the archive included, and every client would need the new pubkey
before it could load anything.

**2. Give the pubkey to the app.** It is compiled in, not read at runtime — see
"Deploying the app" below.

**3. Check the pool.**

```bash
npm run verify
```

**4. Run it.**

```bash
PALAVRA_NSEC=nsec1… npm start
```

That is `publish.js --watch`, and it is the whole schedule — no cron needed.
On every wake it:

1. **asks the relays which days it already has** and publishes whatever is
   missing, oldest first;
2. sleeps until the next 00:00 UTC (plus five seconds), then repeats.

Working the gap out from the relays rather than from a local record is what
makes it robust: a box that was rebuilt, restored from backup, or simply off
for a week catches up by itself on the next start, and a second publisher
running somewhere else won't double-post. On a brand-new key the first run
seeds up to 60 days of archive in one go, which is intentional — it gives the
date picker somewhere to go.

The sleep target is recomputed from the clock each cycle rather than
accumulated, so drift and suspend/resume can't gradually walk the schedule off
midnight. A failed cycle is logged and retried on the next wake instead of
killing the process, and since the gap check will still see that day as
missing, nothing is lost.

**Keeping it alive.** Anything that restarts a process will do — systemd:

```ini
# /etc/systemd/system/palavra.service
[Unit]
Description=mORA Palavra publisher
After=network-online.target

[Service]
WorkingDirectory=/srv/mora/server/palavra
ExecStart=/usr/bin/node publish.js --watch
EnvironmentFile=/etc/palavra.env     # PALAVRA_NSEC=nsec1… — mode 600
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

Keeping the nsec in an `EnvironmentFile` rather than the unit keeps it out of
`systemctl show` and process listings.

### If you'd rather use cron

`npm run backfill` is idempotent and safe to run as often as you like:

```cron
5 0 * * *  cd /srv/mora/server/palavra && . /etc/palavra.env && /usr/bin/node publish.js --backfill 7 >> /var/log/palavra.log 2>&1
```

Two things bite here that `--watch` avoids: **cron runs in the machine's local
timezone** unless you set `CRON_TZ=UTC`, and if the box is ahead of UTC the job
will ask for a date `publish.js` considers to be in the future and publish
nothing. And **`node` needs an absolute path**, because cron's `PATH` is
minimal and a version manager's shim won't be on it.

### Backfilling

```bash
node publish.js 2026-08-08     # one specific day
node publish.js --backfill 7   # last 7 days, skipping any already published
```

A failed run is not a lost day. The puzzle is a pure function of the date
(hash → verse index), so re-running produces byte-identical output — which is
what makes a cron acceptable here where it normally wouldn't be. Publishing
ahead of the current UTC day is refused: it would put tomorrow's answer on a
public relay today.

Relays default to the same five the app uses; override with `PALAVRA_RELAYS`
(comma-separated). **Keep the two lists in step** — a puzzle published only
where the app doesn't look is a day with no puzzle.

## Deploying the app

The app is a static build, so GitHub Pages (or any static host) is enough —
there is nothing to run. Vite inlines `VITE_*` **at build time**, so the
publisher pubkey has to be present when the bundle is built, not at runtime.

For GitHub Pages, `.github/workflows/deploy.yml` passes them through. Set them
as repository **variables** (Settings → Secrets and variables → Actions →
Variables), not secrets:

| Variable | Value |
|---|---|
| `VITE_PALAVRA_PUBLISHER_PUBKEY` | the hex pubkey from `keygen` |
| `VITE_NOSTR_RELAYS` | leave unset unless overriding the defaults |

Variables rather than secrets because both end up verbatim in the shipped
JavaScript — marking them secret would hide them from your build log while
publishing them to every visitor. `PALAVRA_NSEC` is the only real secret and it
never goes near the app build; it lives on whatever machine runs the cron.

If `VITE_PALAVRA_PUBLISHER_PUBKEY` is missing at build time the app silently
falls back to the demo mock in production, so it is worth confirming after the
first deploy that the puzzle matches what you published.

## Why the key exists

Anyone can publish an event claiming to be today's puzzle. The pinned publisher
pubkey is the only thing that lets a client tell the real one apart, so the app
filters by author **and** re-checks `event.pubkey` and the signature after the
relay answers — a hostile relay is free to reply with whatever it likes.

That is the only secret in the whole system. Nothing signs *results*: those are
self-reported (see below).

## The event

Kind `30078`, addressable, one per day:

```jsonc
{
  "kind": 30078,
  "pubkey": "<publisher>",
  "tags": [
    ["d", "mora-palavra-p:2026-08-08"],
    ["date", "2026-08-08"],
    ["t", "morapalavra"],
    ["client", "mora-palavra"]
  ],
  "content": "{ …the puzzle, as JSON… }"
}
```

`content`:

```jsonc
{
  "date": "2026-08-08",                 // UTC day
  "ref": "João 1,1",
  "refUrl": "https://biblia.capuchinhos.org/jo/1?verseStart=1",
  "verse": "No princípio havia o {{blank}}; o {{blank}} estava em Deus; e o {{blank}} era Deus.",
  "length": 5,
  "answerHash": "…",                    // sha256(`${date}:${FOLDED_ANSWER}`), hex
  "answerCipher": "…",
  "nextPuzzleAt": 1786233600            // epoch seconds; the next 00:00 UTC
}
```

- `verse` — the verse with the placeholder token **`{{blank}}`** where the
  hidden word goes. It may appear **more than once**: where a verse repeats the
  word, every occurrence is blanked, or the answer sits in plain sight beside
  its own gap. That is what makes João 1,1 playable at all. Keep the accents.
  Max 220 characters, though the pool aims at 35–110 — the card sits directly
  above the board, and a long verse pushes the keyboard off a laptop screen.
- `refUrl` — optional, must be `https:`. The app links the reference to the
  Bíblia dos Capuchinhos reader, whose routes are
  `/<abreviatura>/<capítulo>?verseStart=<versículo>`. The client will not derive
  this from `ref`: a book-name-to-abbreviation table is silently wrong for
  whichever book it gets wrong, and that site answers an unknown slug with its
  app shell instead of a 404.
- `length` — letters in the **folded** answer, 5 to 8 inclusive. The board is
  drawn from it.
- `answerHash` — `sha256(date + ":" + FOLDED_ANSWER)`. Lets the client
  recognise a win.
- `answerCipher` — base64 of the answer **with its accents**, uppercased and
  UTF-8 encoded, XOR'd bytewise with `sha256("mora-palavra-v1:" + date + ":0")`.

  Note the asymmetry, and it is deliberate: **`answerHash` covers the folded
  form, `answerCipher` carries the accented one.** Guessing is accent-free, but
  the reveal shows the real spelling — printing "SALVACAO" as the answer to a
  Portuguese verse misspells it in front of the reader. So `SALVAÇÃO` is ten
  UTF-8 bytes while `length` is 8; the client decodes as UTF-8 and folds with
  `normalizeWord` before scoring. Encode the bytes, not the characters.
- `nextPuzzleAt` — optional; the client computes the next 00:00 UTC itself
  otherwise. It ignores a value in the past or more than 48h out.

**Answer normalization** must match `normalizeWord()` in
`src/lib/palavra/game.ts` exactly, or wins won't register:
NFD → strip `\p{Mn}` → uppercase → drop everything outside `A-Z`.
`palavra.js` is this side's copy; if the two drift the day becomes unwinnable
with no visible cause, which is why the client re-checks the deciphered answer
against `answerHash` on load and refuses the puzzle rather than serving a
broken board.

## Rollover: 00:00 UTC, globally

The puzzle day is the **UTC** day, the same for everyone.

Not each player's local midnight. Results are ranked partly by how fast the
word was solved, and a per-timezone rollover would spread one "day" across a
26-hour window — someone in UTC+14 finished before someone in UTC-11 had
started. One clock for everybody is the only way that ranking compares like
with like. The client uses `formatUTCDate`, not its local date, throughout.

## What this does and doesn't protect

The client scores guesses locally, which means **the answer must reach the
browser** — you cannot mark a wrong guess without the whole word. So it travels
in `answerCipher`, XOR-obfuscated. That is obfuscation, not encryption: anyone
who opens devtools can recover it, and the code says so.

And nothing countersigns a finished game, so **results are self-reported**. A
player can publish an event claiming a win they didn't earn. That is a
deliberate trade for a system with no server and a social graph owned entirely
by its users. What *is* enforced is a NIP-13 proof of work on each published
result (`src/lib/palavra/pow.ts`), which makes minting a thousand fake entries
expensive without pretending to say anything about any single one.

## Known weak point: relay retention

The archive is only as durable as the relays. If they prune old events, past
days stop loading. Mitigations, in order of effort: run `--backfill` on a
schedule so recent days are re-pushed; add a relay that keeps history; or pin
the events with a paid relay. The puzzle being deterministic means nothing is
ever truly lost — it can always be republished.

## The verse pool

`verses.js`, text taken verbatim from the **Bíblia dos Capuchinhos** corpus at
`../portuguese-capuchine-translation`. It has to be that translation: `refUrl`
sends the reader to biblia.capuchinhos.org, and quoting one wording while
linking to another means the passage they click through to doesn't match what
they just played.

Licensing is the operator's call. These are not public-domain texts; the corpus
ships a CrossWire permission document, and reprinting verses in a game is a use
worth checking against it.

### How a day gets its verse

A shuffled cycle, not `hash(date) % pool`. Hashing straight to an index looks
fine and isn't — it's the birthday problem, and measured against this pool it
repeated a verse on **140 days of a 365-day year** while never showing about
150 of them at all.

Instead, days are counted from a fixed epoch and the pool is walked in a
permuted order. Each complete pass through all 379 verses is **reshuffled with
a new seed**, so every verse appears exactly once per cycle and the next cycle
deals a different order. With 379 entries that's a fresh verse every day for
just over a year before anything recurs.

It stays a pure function of the date, which is what makes backfilling safe: any
republish of the same day produces byte-identical output.

**Two things will re-deal every day, past and future** — adding or removing
entries in `verses.js` (the pool size is part of the arithmetic), and changing
`EPOCH_MS`. Neither matters for days that were never published, but avoid
force-republishing a day that is already out: players would see the archive
change under them. Append-only, and let the next cycle pick up the additions.

### Choosing the hidden word

Two rules, in this order.

**It must be inferable from the clause.** `PASTOR` in Salmo 23,1 is guessable;
a proper noun buried in a genealogy is not. If three different words would fill
the gap equally well, the verse is unusable — six guesses become six coin flips.

**It should carry theological or scriptural weight, in the large majority of
cases.** The game is *Palavra Bíblica do Dia*; the word revealed at the end
should be worth revealing. Two kinds qualify:

- *Doctrinal vocabulary* that fits the 5–8 letter window — graça, pecado,
  justiça, verdade, aliança, perdão, espírito, glória, oração, profeta, templo,
  bênção, salvação, redenção, eterna, reino, batismo, parábola, promessa,
  refúgio. (Much of the richest vocabulary is simply too long: `misericórdia`
  is 12 letters, `ressurreição` 13. Don't chase them.)
- *Central scriptural imagery* — pastor, cordeiro, videira, rebanho, semente,
  colheita, rocha, jugo, coroa, armadura, lâmpada, tesouro, herança, vinha.

What doesn't qualify: ordinary nouns that merely happen to sit in a verse
(`montes`, `cidade`, `tempo`, `casa`), and grammatical filler (`fostes`,
`alguma`, `nenhuma`) — those are unguessable as well as uninteresting.

Aim for roughly 70% weighted rather than 100%. Where the two rules conflict,
**inferability wins**.

An excerpt is marked with `…` where it was cut, and must be a contiguous,
verbatim span — never a paraphrase or a stitched-together shortening.
