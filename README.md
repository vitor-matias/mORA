# mORA

A Catholic companion app (PWA) for daily prayer in European Portuguese. mORA brings together the three daily pillars of prayer in a single, mobile-first interface:

- **Santo Terço** — a guided Rosary that follows the day's mysteries (Joyful, Luminous, Sorrowful, Glorious), with beginner and advanced modes.
- **Missa Diária** — the day's Mass readings, with a toggle between readings-only and the full missal.
- **Liturgia das Horas** — the Liturgy of the Hours (Office of Readings, Lauds, Daytime Prayer, Vespers, Compline), defaulting to the canonical hour for the current time of day.
- **Palavra Bíblica do Dia** — a daily scripture word game: a verse with one word hidden, guessed Wordle-style in six tries, with a leaderboard, head-to-head duels and private leagues carried entirely on Nostr.

It tracks prayer **streaks** and can optionally sync them and your profile to the [Nostr](https://nostr.com/) network, so your identity and progress are portable and self-owned (NIP-07 extension, an `nsec`/hex key, or a locally-generated anonymous key).

## Data sources

- Mass and Hours content: `apiapp.glauco.it` (GraphQL, Portuguese rite).
- Liturgical calendar / colour: `liturgia.pt` ICS feed (fetched via a CORS proxy and cached in `localStorage`).
- Palavra verses: the Bíblia dos Capuchinhos corpus, quoted verbatim. See `server/palavra/README.md` for the licensing note.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS (with `tailwindcss-animate`) and Radix UI primitives
- Zustand (persisted) for auth and app state
- `nostr-tools` for Nostr identity and publishing
- `vite-plugin-pwa` for offline/installable support
- `DOMPurify` to sanitize the remote liturgy HTML before rendering

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint      # run ESLint
```

## Palavra Bíblica do Dia

The game has no backend. A small publisher script writes each day's puzzle to
Nostr at 00:00 UTC and the app reads it back; everything social — the daily
ranking, streaks, duels, leagues — is assembled client-side from relay queries.
So there is nothing to keep online, and the app deploys as static files.

**Deploying, once:**

```bash
cd server/palavra
npm install
npm run keygen        # prints PALAVRA_NSEC (secret) + the publisher pubkey (public)
npm run verify        # checks the verse pool against the corpus
```

Set `VITE_PALAVRA_PUBLISHER_PUBKEY` where the app is *built* — Vite inlines it,
so for GitHub Pages that is a repository **variable**, not a secret (it ships in
the bundle either way). `.github/workflows/deploy.yml` already passes it through.
If it is missing at build time the app silently falls back to a demo pool of
fifteen verses, so check the first deploy.

**Running the publisher:**

```bash
PALAVRA_NSEC=nsec1… npm start     # publishes, then sleeps to the next 00:00 UTC
```

That is the whole schedule — no cron. On every wake it asks the relays which
days it already has and publishes the gap, so a machine that was off for a week
catches up by itself. `server/palavra/README.md` has a systemd unit, a cron
fallback, and the two traps cron brings (local-timezone scheduling, and `node`
not being on cron's `PATH`).

The publisher key is the only secret in the system. Clients pin the matching
pubkey and ignore puzzles signed by anyone else, which is what distinguishes
the real puzzle from an impersonator's. Generate it once and keep it —
rotating it orphans the whole published archive.
