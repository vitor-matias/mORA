# Porting mORA to KaiOS — Requirements & Feasibility

This document maps what it would take to bring mORA to KaiOS feature phones
(Nokia 6300 4G / 8110 4G / 2780 Flip class devices). It is grounded in the
current codebase (React 19 + Vite 7 PWA, touch-first, ~537 kB main JS bundle)
and in the two KaiOS platform generations that exist in the wild.

## TL;DR

- **KaiOS 3.x (Gecko 84) is a realistic port target.** The current stack
  (React 19, Zustand, nostr-tools, WebCrypto, WebSocket, service worker)
  runs on Gecko 84 with a lowered build target and a handful of
  feature-detected fallbacks. The real work is UX: D-pad/softkey navigation
  and a 240×320 layout.
- **KaiOS 2.5 (Gecko 48) is effectively a rewrite of the shell.** No service
  workers, no pointer events, 2016-era JavaScript. Reaching those devices
  (still the majority of the installed base) means a separate lightweight
  build — legacy transpilation at minimum, more realistically Preact or
  vanilla JS — packaged as a Firefox-OS-style `manifest.webapp` app.
- Recommended path: port to KaiOS 3.x first (phases below), and only then
  decide whether the 2.5 installed base justifies a second build.

## 1. The two KaiOS targets

| | KaiOS 2.5.x | KaiOS 3.x |
|---|---|---|
| Engine | Gecko 48 (Firefox, mid-2016) | Gecko 84 (late 2020) |
| JS | No `async/await`, no optional chaining, no ES modules | Full ES2020 (but **no private class fields** — Gecko 90+) |
| CSS | No `grid`, limited custom-property support | Grid, custom properties, most of modern CSS |
| Service worker / Web Push | **Not available** | Available |
| App format | Packaged app, `manifest.webapp` | PWA-style, `manifest.webmanifest` + KaiOS extensions |
| Installed base | Large majority (6300 4G, 8110 4G, JioPhone) | Small but growing (2780 Flip, newer devices) |

Common hardware constraints on both: **240×320 (QVGA) portrait screen,
D-pad + two softkeys + number pad (no touch), 256–512 MB RAM**, slow
single/dual-core CPUs, and distribution through the KaiStore.

## 2. What already works in our favour

- **Mobile-first layout.** The app is a single column on small screens; the
  60 `lg:` breakpoint usages only add the desktop sidebar/topbar, which a
  KaiOS build simply never triggers. Only a handful of `grid-cols-*` spots
  (calendar, mode pickers) need review at 240 px width.
- **Feature detection is already the habit.** The wake-lock code guards with
  `'wakeLock' in navigator` (`src/lib/useAutoScroll.ts:112`) — important
  because Gecko has no Wake Lock API at all, so on KaiOS autoscroll will
  simply not keep the screen awake unless we add a KaiOS-specific fallback
  (`requestWakeLock` system API in packaged apps).
- **Some keyboard support exists.** The rosary's tap-to-advance card already
  handles Enter/Space (`src/pages/Rosary.tsx:185`), and the Hours chooser
  closes on Escape. These are seeds of a D-pad flow, not the whole flow.
- **Offline-first design.** Liturgy days and the liturgical calendar ICS are
  cached in `localStorage` with pruning of past days (`src/lib/liturgy.ts`),
  which fits KaiOS's small storage quotas (~5–10 MB per origin).
- **Pure-JS crypto.** `@noble/hashes`/`nostr-tools` don't depend on APIs
  missing from Gecko 84; `crypto.subtle` (key vault) exists since Firefox 34.
- **Vibration works.** `navigator.vibrate` (rosary bead feedback) is
  supported by Gecko on both generations.

## 3. Requirements by area

### 3.1 Build & runtime compatibility (KaiOS 3.x)

1. **Lower the build target.** Vite 7's default target
   (`baseline-widely-available`, ≈ Firefox 104) can emit syntax Gecko 84
   does not parse — notably private class fields (`#x`, Gecko 90) and
   top-level await (Gecko 89). Set `build.target: 'firefox84'` (esbuild
   supports it) in a KaiOS build mode and smoke-test the output in a
   Firefox 84-era profile or the KaiOS simulator.
2. **Self-host the fonts.** `index.html` loads Inter and Lora from Google
   Fonts at runtime. A KaiOS app must work offline and KaiStore review
   frowns on render-blocking remote fetches; bundle the two families as
   local `woff2` (or drop to system fonts on KaiOS to save memory —
   QVGA screens don't benefit much from webfonts).
3. **Trim dead dependencies.** `framer-motion` and `radix-ui` are declared
   in `package.json` but no longer imported anywhere in `src/` — remove
   them so they can't creep back into the bundle. (`pdfjs-dist` is
   dev-only, used by the breviary parsing tool, and doesn't ship.)
4. **Feature-detect the small gaps in Gecko 84:**
   - `navigator.clipboard` exists (FF 63+) but `write`/permissions differ —
     the Profile page's copy-key button needs a `document.execCommand`
     fallback or a "long-press to select" hint.
   - `IntersectionObserver` (used in `src/pages/Liturgy.tsx:537`) is fine
     (FF 55+).
   - Web Push: KaiOS 3 supports service workers and push, but its push
     service is KaiOS-specific; the VAPID web-push flow in `src/lib/push.ts`
     must be verified against a real device — treat push as best-effort and
     keep the in-app reminder fallback (`useNotifications.ts`) primary.
5. **Memory budget.** 537 kB minified JS (175 kB gzip) parses slowly on a
   256 MB device. Required: route-level code splitting (Rosary, Missa,
   Horas, Profile as separate chunks — today everything except the Nostr
   signer is one chunk) and a hard look at `date-fns` imports. Optional but
   high-value: alias `react`/`react-dom` to `preact/compat` for the KaiOS
   build (~120 kB minified savings) — needs a compatibility pass over
   React 19-specific APIs first.

### 3.2 Input model — the biggest work item

The app is touch-first; KaiOS has no touchscreen. Everything must be
reachable with ↑↓←→, Enter (D-pad centre), the two softkeys, and Backspace.

1. **Spatial focus navigation.** Adopt (or write) a small D-pad navigation
   layer that moves focus with arrow keys between focusable elements and
   scrolls reading views when nothing else is below/above. All interactive
   elements already being real `<button>`s helps; audit the few
   `div role="button"` cases (rosary card) — already focusable, keep them.
2. **Softkey bar.** KaiOS conventions: a persistent 1-line bar at the bottom
   showing what LSK ("Options"), Enter ("SELECIONAR"/"AVANÇAR"), and RSK
   ("Voltar") do. This replaces the current 5-item bottom tab bar, which at
   240 px wide and touch-driven doesn't translate. Navigation between the
   five sections becomes an LSK options menu (or number-key shortcuts, e.g.
   1–5).
3. **Back key semantics.** KaiOS fires `Backspace` for the physical back
   key; unhandled, it exits the app. Wire it into `react-router` history
   (go back; on Home, ask before exit). The Hours chooser's
   Escape-to-close handler (`src/pages/LiturgiaHoras.tsx:435`) should also
   accept Backspace.
4. **Rosary flow maps well.** Tap-to-advance becomes Enter-to-advance
   (already works); add ←/→ for previous/next and hold the undo/restart
   actions behind the LSK menu.
5. **Long-document reading.** Missa and Horas are long scrolling documents:
   ↑/↓ must scroll by line, and the existing autoscroll feature is actually
   a good fit for KaiOS (hands-free reading) — keep it, minus the wake-lock
   (see §2) — a KaiOS packaged app can request the system wake lock instead.
6. **Text entry is expensive (T9).** The Nostr `nsec`/bunker URI entry in
   Profile is impractical to type on a keypad. Keep the locally-generated
   anonymous key as the default identity on KaiOS; demote manual key entry
   to "supported but discouraged". NIP-07 browser extensions don't exist on
   KaiOS at all.

### 3.3 Layout at 240×320

1. Add a small-screen pass (Tailwind default styles already apply; the work
   is shrinking, not restructuring): reduce base font sizes and the generous
   `p-5/p-6` paddings and `rounded-3xl` radii; verify `grid-cols-7`
   (calendar) and `grid-cols-3/5` pickers fit 240 px.
2. Drop `backdrop-filter` (2 usages in `index.css`) on KaiOS — it's a
   compositing cost these GPUs can't afford; use opaque surfaces.
3. Keep the liturgical-colour theming — it's CSS custom properties, fine on
   Gecko 84 (needs review under Gecko 48's partial support if 2.5 is ever
   targeted).
4. Test both 240×320 and the 2780 Flip's 240×294 usable area.

### 3.4 Network & data sources

1. `apiapp.glauco.it` GraphQL and the `liturgia.pt` ICS (via CORS proxy)
   are plain HTTPS — fine on KaiOS 3 PWAs. If shipped as a *packaged* app,
   cross-origin rules differ: KaiOS 2.5 packaged apps get `systemXHR`
   permission which would let us drop the CORS proxy entirely.
2. Data frugality matters (KaiOS users are often on prepaid data): the
   existing per-day caching is right; add explicit cache headers/ETags if
   the proxy allows, and never background-refetch on metered connections.

### 3.5 Nostr sync

- WebSocket relays work on both Gecko generations; `SimplePool`
  (`src/lib/nostr.ts`) needs no changes.
- NIP-46 bunker signing (`src/lib/signer.ts`, lazy-loaded chunk) is
  keypad-hostile (typing `bunker://…` URIs) — keep it lazy and desktop-only
  in practice.
- Streak sync should be tolerant of long offline stretches — already the
  design, but worth re-testing under KaiOS's aggressive process killing.

### 3.6 Packaging & distribution (KaiStore)

1. KaiOS 3.x: submit as a hosted/packaged PWA with a `manifest.webmanifest`
   carrying KaiOS-specific fields (`b2g_features`: category, cursor
   disabled, default_locale `pt-PT`); KaiOS 2.5 would need the older
   `manifest.webapp`.
2. Store assets: 56×56 and 112×112 icons (we ship 192/512 today), QVGA
   screenshots, privacy policy URL.
3. Review requirements: app must be fully D-pad operable, handle the back
   key, work offline after first load, and start in a few seconds on
   reference hardware.

## 4. KaiOS 2.5 — what it would additionally take

Only worth doing if reaching the 6300 4G/8110 4G installed base is a goal:

- **No service workers** → no `vite-plugin-pwa`, no web push. Offline comes
  free from being a packaged app; reminders would use the KaiOS 2.5 alarms
  API (`navigator.mozAlarms`) instead.
- **Gecko 48 JavaScript** → React 19 is out of reach as-built. Options, in
  increasing effort: `@vitejs/plugin-legacy` (ES5 output + polyfills, big
  bundle on a 256 MB phone), Preact + heavy transpilation, or a purpose-built
  vanilla shell that reuses only the data layer (`src/lib/liturgy.ts`,
  `breviary/`, `rosary.ts` are UI-free and would transpile cleanly).
- **No Pointer Events** (Gecko 59+) → the `pointerdown` outside-click
  handler in `LiturgiaHoras.tsx` needs a `mousedown`/`touchstart` fallback —
  irrelevant if the 2.5 shell is rebuilt anyway.
- The shared, portable core is real: rosary content, breviary assembly,
  liturgy fetching/caching, and streak logic have no DOM or React
  dependencies. A 2.5 port is "new shell, same engine".

## 5. Suggested phasing

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Decide target generation; get a KaiOS 3 device + simulator | Go/no-go, test rig |
| 1 | KaiOS build mode: `target: 'firefox84'`, self-hosted fonts, dead-dep removal, route code-splitting | App boots on device |
| 2 | D-pad layer, softkey bar, back-key routing, section menu | App fully operable without touch |
| 3 | QVGA layout pass, perf tuning (no backdrop-filter, memory profiling) | App pleasant at 240×320 |
| 4 | KaiStore manifest, icons, review fixes | Published |
| 5 (optional) | KaiOS 2.5 lightweight shell over the shared data layer | Legacy-device coverage |

Phases 1–4 are incremental and keep a single codebase (a `VITE_KAIOS` build
mode plus runtime checks). Phase 5 is a separate deliverable and should be
scoped only after 3.x ships.
