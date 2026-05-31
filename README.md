# mORA

A Catholic companion app (PWA) for daily prayer in European Portuguese. mORA brings together the three daily pillars of prayer in a single, mobile-first interface:

- **Santo Terço** — a guided Rosary that follows the day's mysteries (Joyful, Luminous, Sorrowful, Glorious), with beginner and advanced modes.
- **Missa Diária** — the day's Mass readings, with a toggle between readings-only and the full missal.
- **Liturgia das Horas** — the Liturgy of the Hours (Office of Readings, Lauds, Daytime Prayer, Vespers, Compline), defaulting to the canonical hour for the current time of day.

It tracks prayer **streaks** and can optionally sync them and your profile to the [Nostr](https://nostr.com/) network, so your identity and progress are portable and self-owned (NIP-07 extension, an `nsec`/hex key, or a locally-generated anonymous key).

## Data sources

- Mass and Hours content: `apiapp.glauco.it` (GraphQL, Portuguese rite).
- Liturgical calendar / colour: `liturgia.pt` ICS feed (fetched via a CORS proxy and cached in `localStorage`).

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS (with `tailwindcss-animate`) and Radix UI primitives
- Zustand (persisted) for auth and app state
- `nostr-tools` for Nostr identity and publishing
- `vite-plugin-pwa` for offline/installable support
- `@vitejs/plugin-legacy` targeting older engines (e.g. KaiOS / Firefox 48)

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint      # run ESLint
```
