# Porting mORA to KaiOS 2.5 — Requirements & Feasibility

Target platform: **KaiOS 2.5.x** (Nokia 6300 4G, 8110 4G, JioPhone class —
the large majority of KaiOS devices in the wild). KaiOS 2.5 runs **Gecko 48**
(Firefox, mid-2016), ships apps as Firefox-OS-style *packaged apps*
(`manifest.webapp`), and has **no service workers, no Web Push, no
WebAssembly, and no BigInt**. This document maps the current codebase
(React 19 + Vite 7 PWA, touch-first, 537 kB main JS bundle) against those
constraints.

## TL;DR

- The app **cannot be ported as-built**; this is a compatibility project with
  one true blocker and several structural changes:
  1. **Nostr signing is broken on Gecko 48** — `nostr-tools` →
     `@noble/curves` secp256k1 is built on `BigInt` (49 call sites survive
     into our production bundle), which Gecko 48 lacks and which cannot be
     transpiled or (practically) polyfilled. Nostr sync must either be
     dropped on KaiOS or reimplemented on a non-BigInt crypto stack.
  2. **The service-worker PWA model doesn't exist** — offline comes from
     being a packaged app instead; Web Push reminders become `mozAlarms`.
  3. **The styling relies on CSS Gecko 48 doesn't have** — flexbox `gap`
     (~90 usages) and CSS grid are both unsupported (FF 63 / FF 52).
  4. **All app JS must be transpiled to pre-2017 JavaScript** — no ES
     modules, no `async/await`, no optional chaining/nullish coalescing
     (94 + 78 occurrences in `src/` alone). This part is mechanical
     (`@vitejs/plugin-legacy`), but React 19 at ES5 on a 256 MB phone is a
     performance risk that must be validated on hardware before committing.
- The **UI-free data layer is fully portable**: liturgy fetching/caching,
  breviary assembly, rosary content, and streak logic have no DOM, React, or
  BigInt dependencies and transpile cleanly. Whatever shell strategy wins,
  that core carries over.
- Recommended path: a short device spike of the transpiled-React build
  (Option A below); if it can't hit acceptable start-up/scroll performance,
  fall back to a purpose-built lightweight shell over the shared data layer
  (Option C). Decide the Nostr question (§3.7) independently and early.

## 1. Platform constraints (KaiOS 2.5 / Gecko 48)

Hardware: 240×320 (QVGA) portrait screen (8110: 240×320 landscape-ish flip
variants exist), **D-pad + two softkeys + number pad, no touch**, 256–512 MB
RAM, slow single/dual-core CPUs, small storage quotas (localStorage ~5 MB,
IndexedDB available).

What Gecko 48 **has** that we rely on: ES6 core (classes, arrows,
`let`/`const`, template literals, `Promise`, `Map`/`Set`/`Symbol`),
`fetch`, WebSocket, WebCrypto (`crypto.subtle` incl. PBKDF2 + AES-GCM used
by `src/lib/keyVault.ts`), `localStorage`, CSS custom properties, flexbox,
`position: sticky`, `matchMedia`, `navigator.vibrate`.

What it **lacks**, mapped to our code:

| Missing (landed in FF) | Where it bites us | Fix |
|---|---|---|
| `BigInt` (68) | secp256k1 in `nostr-tools`/`@noble/curves` — all key generation, event signing, NIP-44 ECDH | **Blocker** — see §3.7 |
| Service workers / Push | `vite-plugin-pwa`, `src/sw.ts`, `src/lib/push.ts` | Packaged-app offline + `mozAlarms` (§3.5) |
| WebAssembly (52) | Blocks wasm-based crypto as an alternative | Pure-JS only |
| ES modules (60), `async/await` (52), object spread (55), `?.` (74), `??` (72) | Everywhere in `src/` and dependencies | Transpile (`@vitejs/plugin-legacy`) |
| Flexbox `gap` (63) | ~90 `gap-*` Tailwind usages across `src/` | Replace with `space-x/y-*` or margins (§3.3) |
| CSS grid (52) | `grid-cols-7` calendar, `grid-cols-2/3/5` pickers | Rebuild those few layouts on flexbox |
| Pointer Events (59) | `pointerdown` outside-click handler, `src/pages/LiturgiaHoras.tsx:442` | `mousedown`/`touchstart` fallback |
| `IntersectionObserver` (55) | `src/pages/Liturgy.tsx:537` | Polyfill (small, standard) |
| `AbortController` (57) | 2 direct uses + react-router internals | Polyfill via core-js/plugin-legacy |
| `navigator.clipboard` (63) | Copy-key button in `src/pages/Profile.tsx:271` | `document.execCommand('copy')` fallback |
| `backdrop-filter` (103) | 2 usages in `src/index.css` | Opaque surfaces (also a perf win) |
| Wake Lock API (never in Gecko) | Autoscroll screen-awake, `src/lib/useAutoScroll.ts:112` (already feature-detected) | Packaged-app `requestWakeLock('screen')` system API |
| `queueMicrotask` (69) | React internals | Polyfill (trivial) |

## 2. Shell strategy — three options

**Option A — transpiled React build (spike first, cheapest if it works).**
Add a KaiOS build mode with `@vitejs/plugin-legacy` (SystemJS + core-js
polyfills; Gecko 48 has no ES modules so it always takes the legacy path).
React's published packages are old-syntax-safe and plugin-legacy transpiles
dependency chunks too, so this *should* parse and boot. The open question is
purely performance: ES5 React 19 + polyfills will exceed the current 537 kB
bundle on a 256 MB, ~1.1 GHz device. **Requirement: a go/no-go spike on real
hardware (6300 4G) measuring cold start (< 5 s) and reading-view scroll.**

**Option B — Preact fallback.** Same as A but aliasing `react`/`react-dom`
to `preact/compat` (~120 kB minified savings, smaller heap). Needs a
compatibility pass over React-19-specific usage; worthwhile only if A fails
on memory but the component tree is otherwise fine.

**Option C — lightweight KaiOS shell over the shared core (safest, most
work).** Keep `src/lib/` (liturgy fetching/caching, `breviary/` assembly,
`rosary.ts`, streak logic — all UI-free) and build a small vanilla/JSX-lite
D-pad UI for QVGA. This is the classic KaiOS approach and guarantees the
performance budget, at the cost of a second UI to maintain.

Recommendation: time-box a spike of A (days, not weeks — plugin-legacy
config + CSS gap pass on one page + device test). Treat C as the plan of
record if the spike misses the performance bar.

## 3. Requirements by area

### 3.1 Build & packaging

1. A separate KaiOS build mode (`vite build --mode kaios`): plugin-legacy,
   no `vite-plugin-pwa`, no `src/sw.ts`, output as a **packaged app** —
   every asset in the zip, nothing loaded from the network at boot.
2. **Self-host the fonts or drop them.** `index.html` loads Inter and Lora
   from Google Fonts at runtime — not allowed in a packaged app and wasteful
   at QVGA. Recommendation: system fonts on KaiOS.
3. **No inline scripts.** Privileged packaged apps enforce a CSP
   (`script-src 'self'`) that forbids the inline theme-bootstrap script in
   `index.html:11` — move it to a bundled external file for the KaiOS build.
4. Icons: KaiOS wants 56×56 and 112×112 (we ship 192/512 today).

### 3.2 Input model — the biggest UX work item

The app is touch-first; KaiOS 2.5 has no touchscreen. Everything must work
with ↑↓←→, Enter (D-pad centre), the two softkeys, and the back key.

1. **Spatial focus navigation**: a D-pad layer that moves focus between
   interactive elements and scrolls reading views otherwise. The rosary's
   advance card already handles Enter/Space (`src/pages/Rosary.tsx:185`) —
   that pattern must become universal.
2. **Softkey bar**: persistent 1-line bar showing LSK ("Opções"), Enter
   ("AVANÇAR"/"SELECIONAR"), RSK ("Voltar"). It replaces the 5-item bottom
   tab bar; section switching moves to an LSK menu and/or number-key
   shortcuts (1–5).
3. **Back key**: KaiOS 2.5 fires `Backspace`; unhandled, it exits the app.
   Wire it into router history; on Home, confirm before exit. The Hours
   chooser's Escape handler (`src/pages/LiturgiaHoras.tsx:435`) should also
   accept Backspace.
4. **Long-document reading** (Missa/Horas): ↑/↓ scroll by line; the existing
   autoscroll is a genuinely good fit for hands-free reading on a feature
   phone — keep it, backed by the packaged-app wake lock (§1 table).
5. **T9 text entry is hostile**: manual `nsec`/`bunker://` entry (Profile)
   is impractical on a keypad — moot anyway until §3.7 is resolved.

### 3.3 Layout & styling at 240×320

1. **Replace flexbox `gap`** (~90 usages) with `space-x/y-*`/margins — on
   Gecko 48 `gap` silently collapses all spacing, so this is correctness,
   not polish. Rebuild the few `grid-cols-*` layouts (calendar, pickers) on
   flexbox.
2. Shrink the scale: base font sizes, `p-5/p-6` paddings, `rounded-3xl`
   radii are tuned for ≥360 px; QVGA needs a tighter pass.
3. Drop `backdrop-filter`; keep the liturgical-colour theming (CSS custom
   properties work on Gecko 48, but verify our fallback chains on device).
4. Verify Tailwind 3.4's generated CSS against Gecko 48 (preflight is fine;
   individual utilities like `inset-*` shorthand — FF 66 — need an audit of
   what we actually emit).

### 3.4 Network & data sources

1. `apiapp.glauco.it` (GraphQL) and `liturgia.pt` ICS are plain HTTPS.
   As a **privileged packaged app with `systemXHR`**, cross-origin
   restrictions vanish — the CORS proxy in `src/lib/liturgy.ts` can be
   bypassed entirely on KaiOS (keep it for the web build).
2. Data frugality (prepaid users): the per-day `localStorage` cache with
   past-day pruning (`src/lib/liturgy.ts:87`) is the right shape; never
   background-refetch, fetch on demand only.

### 3.5 Reminders & notifications

No service worker → no Web Push (`src/lib/push.ts` is web-only). KaiOS 2.5
equivalents: schedule with `navigator.mozAlarms`, receive via
`mozSetMessageHandler('alarm')`, display with the Notification API, and
re-arm the next alarm on each firing (the schedule logic in
`src/lib/reminderSchedule.ts` is reusable as-is). The in-app reminder path
(`useNotifications.ts`) remains the fallback while the app is open.

### 3.6 Storage

`localStorage` for liturgy cache + Zustand persistence fits the ~5 MB
quota, with pruning already in place. The ICS cache (`CACHE_KEY`, full ICS
text) is the largest single entry — measure it; move to IndexedDB if it
crowds the quota.

### 3.7 Nostr — decide early, it shapes scope

`BigInt` is the one gap that no transpiler fixes. Every Nostr operation —
key generation (`src/store/auth.ts`), event signing (`src/lib/nostr.ts`),
NIP-44 encryption, NIP-46 bunker signing (`src/lib/signer.ts`) — runs
through `@noble/curves` secp256k1, which is BigInt to the core. WebAssembly
alternatives are also out (no wasm in Gecko 48). The options:

- **A (recommended): ship KaiOS without Nostr sync.** Local streaks and
  profile only; frame sync as a web/smartphone feature. Smallest scope,
  no crypto risk, and T9 makes key management miserable anyway.
- **B: reimplement signing on a BN.js-based stack** (e.g. `elliptic` for
  secp256k1 + a hand-rolled BIP-340 Schnorr layer). Serious
  crypto-engineering effort with real correctness/security risk; only
  justified if portable identity on feature phones is a product goal.
- **C: remote signing.** Delegate signing to the user's NIP-46 bunker so no
  local secp256k1 is needed — but the *client* side of NIP-46 itself
  encrypts with ECDH over secp256k1, so this still runs into BigInt.
  Not viable without B's stack. Listed for completeness.

### 3.8 KaiStore distribution

1. `manifest.webapp` with `type: "privileged"`, permissions
   (`systemXHR`, `alarms`, `desktop-notification`), `default_locale: pt`,
   launch path, developer info, 56/112 icons.
2. KaiStore has historically required KaiAds SDK integration in free apps;
   request the exemption (religious/non-monetized apps have received it) —
   the SDK loads remote code, which we don't want in a prayer app.
3. Review gate: fully D-pad operable, back-key handled, works offline after
   install, acceptable start-up time on reference hardware.

## 4. Suggested phasing

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Hardware + tooling: 6300 4G device, WebIDE/gDeploy sideloading; decide §3.7 (Nostr) | Test rig, scoped feature set |
| 1 | **Spike Option A**: plugin-legacy build mode, CSS `gap` fix on one page, polyfills; measure cold start & scroll on device | Go/no-go on React shell |
| 2 | Shell build-out (A/B or C per spike): full CSS pass, D-pad layer, softkey bar, back-key routing | App fully operable without touch |
| 3 | Platform integration: packaged-app manifest + CSP fixes, `systemXHR` (drop CORS proxy), `mozAlarms` reminders, wake lock for autoscroll | Feature-complete on device |
| 4 | QVGA polish, memory/perf tuning, KaiStore submission (manifest, icons, KaiAds exemption) | Published |

The web PWA and the KaiOS build share the data layer and diverge at the
shell; keep the KaiOS-specific surface behind a build mode so the main app
never pays for it.
