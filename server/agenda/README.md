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
- content is the day as the app renders it — `{ color, dayName, description }`
- plus `mora-vatican-theme:2026-09` for the month's theme

A day is ~700 bytes, so colouring today costs one small event instead of the
366KB year the proxies used to serve for the same answer. Parsing is shared
with the app (`src/lib/icsCalendar.ts`, imported directly — Node strips the
types) so the publisher can never disagree with the reader about what a day
says.

Each event carries a `hash` tag of its content. A run reads back what the
relays already hold and publishes only what differs, so a normal day
publishes **nothing**. Runs are capped (`--max`, default 150) and sent in
small batches: a year is 365 events, and firing those at eight relays at once
is how a publisher gets rate-limited. A cold start fills itself in over a few
daily runs, oldest first.

## Deploy

**If Palavra is already publishing, there is nothing to set up.** The calendar
signs with `PALAVRA_NSEC` and the app pins `VITE_PALAVRA_PUBLISHER_PUBKEY`,
both of which already exist. Just run the workflow once: Actions → "Publish
Liturgical Calendar" → Run workflow. The first run publishes 150 days; the
next daily runs fill in the rest.

One identity signing both feeds is the sensible default rather than a
shortcut: they are both "mORA publishes something official", it means one
profile on the relays, and the events are told apart by their `d` and `t`
tags, never by who signed them.

### Under its own key instead

Worth doing only if you want to rotate the calendar without disturbing
Palavra:

1. **Generate the identity** (once):

   ```bash
   npm run keygen
   ```

2. **Set the secret**: `AGENDA_NSEC`, under Settings → Secrets and variables →
   Actions → **Secrets**. It signs the calendar and must never reach the Pages
   build.

3. **Set the variable**: `VITE_AGENDA_PUBLISHER_PUBKEY` (the pubkey from step
   1), under the same page → **Variables**. The app pins it, so a stranger's
   event cannot pose as the calendar. This one *does* ship in the bundle, and
   is meant to.

Both take precedence over the Palavra pair when present. With neither key set
the workflow fails loudly rather than publishing nothing quietly; with no
pubkey pinned the app shows no liturgical colours or day names.

## Locally

```bash
npm install
AGENDA_NSEC=nsec1... npm run dry-run    # works out what would go, sends nothing
AGENDA_NSEC=nsec1... npm run publish-agenda
# (or PALAVRA_NSEC=..., the same key the workflow falls back to)
```

`AGENDA_RELAYS` (comma-separated) overrides the relay list for pointing at a
local relay; otherwise it uses `src/relays.json`, the same list the app reads.
