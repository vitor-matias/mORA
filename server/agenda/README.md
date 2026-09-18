# mORA calendar publisher

Mirrors the Portuguese liturgical calendar onto Nostr, one event per day, so
the app can read it from a browser.

## Why

`liturgia.pt` (the calendar) and `vatican.va` (the Pope's monthly theme) both
serve their feeds without CORS headers, so a browser cannot fetch them
directly. The app used to go through public CORS proxies. Every one of them
eventually failed:

| Proxy | How it died |
| --- | --- |
| `corsproxy.io` | went key-only — `401` without a paid key |
| `api.codetabs.com` | `408` for these targets |
| `api.allorigins.win` | answers `200` wrapping its own nginx `500` |

Ten others were tried — dead, rate-limited, behind bot challenges, or
requiring domain registration. The failure was silent: the calendar simply
never appeared.

Relays don't have this problem. They're WebSocket, so CORS never applies, the
app already talks to them for Palavra, and a scheduled job can fetch the feeds
server-side where CORS is not a thing. That job is this one
(`.github/workflows/agenda.yml`, daily).

## Shape

One addressable event (NIP-78, kind `30078`) per day:

- `d` tag `mora-agenda:2026-05-28`, `date` tag `2026-05-28`
- content is the day as the app renders it —
  `{ color, dayName, description, sections }`
- plus `mora-vatican-theme:2026-09` for the month's theme

`description` is liturgia.pt's prose, unchanged. `sections` is that same prose
classified — `celebration` (with its `rank`), `office`, `mass`, `readings`,
`notes`, and `text` for anything that fits none of them — in the order it was
written, and losslessly: every non-blank line lands in exactly one section.
The app renders those fields rather than working the prose over with regexes
on every device, which is how five days of the year (Easter among them) used
to hide their readings behind a "Ver mais".

A day is ~1.5KB, so colouring today costs one small event instead of the
366KB year the proxies used to serve for the same answer. Parsing is shared
with the app (`src/lib/icsCalendar.ts`, imported directly — Node strips the
types) so the publisher can never disagree with the reader about what a day
says — and the app parses `description` itself for any day still published
without sections, using that same function.

Each event carries a `hash` tag of its content. A run reads back what the
relays already hold and publishes only what differs, so a normal day
publishes **nothing**. A run publishes everything that is missing — a full
year takes about twenty seconds — sent in small batches with a pause between
them, since firing 365 events at eight relays at once is how a publisher gets
dropped.

Entries go out today first, then forward, then back into the past. That only
shows when a run cannot finish, which is exactly when it matters: the home
screen and the Mass ask for today, and the directory for the month around it.

## Deploy

**There is nothing to set up.** The calendar is signed by `PALAVRA_NSEC` and
pinned by `VITE_PALAVRA_PUBLISHER_PUBKEY` — the same identity that signs the
daily puzzle, both of which already exist. One key signs everything mORA
publishes: the feeds are told apart by their `d` and `t` tags, never by who
signed them, so a key of its own would buy nothing but a second secret to set
up and rotate, and a second pubkey to forget.

Just run it once: Actions → "Publish Liturgical Calendar" → Run workflow. The
run publishes the whole year.

If the key ever needs replacing, `server/palavra/keygen.js` generates the pair
and both feeds move together.

## Locally

```bash
npm install
PALAVRA_NSEC=nsec1... npm run dry-run    # works out what would go, sends nothing
PALAVRA_NSEC=nsec1... npm run publish-agenda
```

`AGENDA_RELAYS` (comma-separated) overrides the relay list for pointing at a
local relay; otherwise it uses `src/relays.json`, the same list the app reads.
