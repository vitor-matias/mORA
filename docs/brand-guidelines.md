# Oremus Brand Guidelines v2.1

> Last updated: 2026-10-28
> Status: Draft. Written down from what the app already does; section 9 lists the decisions still open.
> Tokens live in `src/index.css` and `tailwind.config.cjs`. This document describes them; it does not replace them.

## Quick Reference

| Element | Value |
|---------|-------|
| Name | Oremus (title case; formerly mORA) |
| Language | European Portuguese (pt-PT) |
| Primary Color | The day's liturgical colour (section 3.2); brand constant #B45309 |
| Page Background | #F7F7F9 light (Bento) / #0B0B0C dark (Imersivo) |
| Primary Font | Inter (interface) |
| Reading Font | Lora (prayers and readings) |
| Icons | Lucide, outline |
| Voice | Reverent, warm, plain, exact |

---

## 1. Essence

Oremus is a companion for daily Catholic prayer in European Portuguese. It gathers the day's prayer in one place, on the phone, without noise:

- **Missa Diária**: the day's readings, or the full missal.
- **Liturgia das Horas**: the hour that fits the time of day.
- **Santo Terço**: a guided Rosary on the day's mysteries.
- **Palavra Bíblica do Dia**: a daily verse game, the one playful corner.

**What it promises.** The prayer comes first and the app gets out of the way: bars hide while you read, nothing decorates the text, and the colour of the screen follows the Church's calendar.

**What it is not.** Not a social feed, not a productivity tracker, not a devotional gift shop. Streaks and medals exist, but they never outrank the prayer.

**The name.** *Oremus* is Latin for "let us pray": the priest's invitation before the collect in the Roman Rite (*Oremos* in the Portuguese missal). It is the app's own voice: it prays *with* the reader, in the first person plural, as the interface does ("O que vamos rezar hoje?").

**Formerly mORA.** The old name stays wherever changing it would break something: the repository and the GitHub Pages path (`/mORA/`), the Cloudflare Workers (`mora`, `mora-push`), and every stored or published identifier (storage keys, Nostr tags such as `mora-palavra`, the puzzle cipher salt, badge ids, the key-vault labels). Never rename those.

---

## 2. Logo and Marks

### Variants in use today

| Variant | File | Look | Where |
|---------|------|------|-------|
| App icon | `tools/icon-master-512.png` → `public/pwa-*.png`, `apple-touch-icon.png` | Praying hands, fine rose-gold line engraving (≈ #C8988F) on a full-bleed #1D1D1D field | Home screens, app switchers, install prompts |
| Favicon | `public/favicon.svg` | A plain cross, #FAF9F6 strokes on a #B45309 rounded square | Browser tabs |
| Wordmark | `src/components/layout/TabBar.tsx` | The favicon cross tinted with the day's liturgical colour, followed by "Oremus" in Inter Bold, tight tracking | Desktop top bar (xl and up) |
| Medals | `public/badges/palavra-{1,2,3}.png` | Material Symbols `menu_book`, gold, silver and bronze gradients | Palavra podium badges on Nostr |

The app icon and the favicon don't match yet. See section 9.

### Rules

- Regenerate icons with `npm run make-app-icons` from the master. Never edit the PNGs in `public/` by hand.
- The app icon stays full bleed. The launcher supplies the shape; a mark with its own corners ends up on a white plate on Android.
- Medal art stays PNG and stays derived from an Apache-2.0 shape, never an emoji font. Other Nostr clients refuse SVG, and emoji fonts are proprietary.
- The wordmark is the only place the mark changes colour, and only with the liturgical palette.
- Clear space around any mark: at least a quarter of its own height.
- Minimum size: 24px for the cross; 48px for the praying hands, whose line detail fills in below that.
- Don't add shadows, glows or outlines, don't recolour the hands, and don't set "Oremus" in any other casing ("oremus", "OREMUS").

---

## 3. Color Palette

### Neutral Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Page Light | #F7F7F9 | rgb(247,247,249) | Page background, status-bar strip, PWA theme colour |
| Surface Light | #FFFFFF | rgb(255,255,255) | Cards (`.surface`), sheets |
| Ink Light | #18181B | rgb(24,24,27) | Headings, body text (zinc-900) |
| Secondary Light | #71717A | rgb(113,113,122) | Supporting text (zinc-500) |
| Page Dark | #0B0B0C | rgb(11,11,12) | Page background in dark mode |
| Surface Dark | #18181B | rgb(24,24,27) | Tiles in dark mode (zinc-900) |
| Ink Dark | #FAFAFA | rgb(250,250,250) | Headings, body text (zinc-50) |
| Secondary Dark | #A1A1AA | rgb(161,161,170) | Supporting text (zinc-400) |
| Hairline | ink at 8% | rgb(24 24 27 / 0.08) | Card borders (white at 8% in dark) |

By day (**Bento**) the page is a cool light grey and the tiles are white. It is the lightest grey on which zinc-500 still holds 4.5:1 (4.52); text sitting directly on the page, rather than on a tile, uses zinc-600. By night (**Imersivo**) the page is near-black, never blue-black, with zinc-900 tiles.

### Primary Colors (liturgical)

The accent colour is the colour of the day's liturgy, set by `data-theme` on `<html>` from the liturgia.pt calendar. Nothing in the chrome uses a fixed brand hue except the favicon.

| Season | Theme | Text and fill, light (700) | Text and fill, dark (400) | Pill background (50) |
|--------|-------|---------------|---------------|-------------|
| Ordinary Time (green) | `verde` (default) | #047857 | #34D399 | #ECFDF5 |
| Advent, Lent, funerals (purple) | `roxo` | #7E22CE | #C084FC | #FAF5FF |
| Passion, Pentecost, martyrs (red) | `vermelho` | #BE123C | #FB7185 | #FFF1F2 |
| Christmas, Easter, feasts (white, shown as gold) | `branco` | #B45309 | #FBBF24 | #FFFBEB |
| Gaudete, Laetare (rose) | `rosa` | #BE185D | #F472B6 | #FDF2F8 |

How to use them:

- **Accent text** (labels, links, references): 700 in light mode, 400 in dark.
- **Primary button** (`.cta-primary`): a 700 fill with white text in light mode; a 400 fill with ink text (#18181B) in dark. Dark mode has no white-on-colour button, because no bright fill reaches 4.5:1 with white.
- **Selected states** (a chosen day, an active chip) follow the button rule: 700 with white by day, 400 with ink by night. Never white on 500 or 600.
- **Day cards are solid**, by day and by night (no decorative shapes behind them): Home's day card, the day card on Missa, the Terço's mysteries card and the Devocionário's suggestion are blocks of 700 (800 by night) with white text, 5.0:1 or better. Only when the card shows *today*: the Diretório shows other days, whose colour can differ from the page's, so its panel stays white with the colour dot.
- **Progress beads** (Terço, Coroas): 700 by day, 500 by night for beads prayed, 700 / 400 for the current one, which is also larger. 3:1 or better against the page in every season.
- **500 is decorative only**: dots, small ornaments, tints at 8–15% opacity. Against the page it falls below 3:1 in green and gold, and 600 does too in gold.
- **No wash.** The season no longer tints the top of the page (`--app-wash` is `none`); the day cards and the accents carry it.
- One coloured panel per page at most.

### Semantic Colors (fixed: they never follow the season)

| State | Light | Dark | Usage |
|-------|-------|------|-------|
| Palavra correct | #047857, white letter | #34D399, ink letter | Right letter, right place |
| Palavra present | #B45309, white letter | #FBBF24, ink letter | Right letter, wrong place |
| Palavra absent | #71717A, white letter | #52525B, white letter | Letter not in the word |
| Destructive | red-600 | red-400 | Leaving a league, removing (some older sites still use red-500) |

On the Palavra board the colour *is* the feedback, so it can't turn purple in Advent. The colours also match the shared emoji grid (🟩🟨).

### Accessibility

- Every text pairing meets WCAG AA (4.5:1) in all five seasons and both modes. Check new pairings against every theme, not just green.
- Lowest pairings in use: white on gold 700 is 5.02:1; gold 700 text on the page is 4.69:1; ink on purple 400 is 6.70:1; zinc-500 on the page is 4.52:1.
- `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast: more` each have their own rules in `src/index.css`. New floating or animated surfaces join those rules.

---

## 4. Typography

### Font stack

```css
--font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-body: 'Inter', -apple-system, sans-serif;
--font-reading: var(--content-font-family, 'Lora', Georgia, serif);
```

One sans for everything around the prayer, one serif for the prayer itself. The serif is the voice of the text being prayed; the sans is the app speaking.

### Interface scale

| Element | Class | Size | Weight | Notes |
|---------|-------|------|--------|-------|
| Page title | `text-3xl` | 30px | 800 | Extra-bold, tight tracking; collapses to `text-xl` on scroll |
| Section heading | `text-sm` uppercase | 14px | 600 | `tracking-wider`, secondary colour |
| Card title | `text-lg` | 18px | 600–700 | |
| Body | `text-sm` / `text-base` | 14–16px | 400–500 | |
| Small caps label | `text-xs` uppercase | 12px | 700 | 0.1em tracking, accent colour |
| Tab label | `text-[0.65rem]` | 10.4px | 500 | The floor; nothing goes smaller |

### Reading scale (user-chosen in Perfil)

Each option is shown as an "A" drawn at that size (`CONTENT_FONT_SCALE` in `src/store/app.ts`). The two largest steps also scale the whole interface through the root font size; that is the only way to enlarge it, since pinch zoom is off.

| Setting | Reading size | Line height | Interface |
|---------|------|-------------|-----------|
| Pequeno | 18px | 1.70 | 100% |
| Médio (default) | 21px | 1.65 | 100% |
| Grande | 26px | 1.60 | 112.5% |
| Muito grande | 32px | 1.50 | 125% |

Touch targets are fixed at 44px and don't grow with the interface.

Reading text is ragged right with no hyphenation (most of it is verse), uses old-style figures (`onum`) and `text-wrap: pretty`. Labels inside a reading (Oração coleta, Leitura I) switch to Inter small caps so the prayer stays the only serif on the page.

### Loading

Inter 400–800 and Lora 400–600 (plus italics 400, 500) come from Google Fonts with `display=swap` (`index.html`).

---

## 5. Iconography

- **Lucide**, outline only. 22px in the tab bar, 16–20px inline.
- Stroke 1.8 at rest, 2.4 when active (the tab bar's selected state is a heavier stroke plus the accent colour, not a filled icon).
- Icons Lucide lacks are drawn with `createLucideIcon` on the same 24px grid, so they take `size` and `strokeWidth` like the rest (`src/components/icons.ts`, e.g. the Rosary).
- Decorative icons get `aria-hidden="true"`; icon-only buttons get an `aria-label` in Portuguese.
- **No emoji in the interface.** Emoji appear only in text that leaves the app: notification titles (🙏, 🏅) and the Palavra share grid (🟩🟨🟥).

---

## 6. Shape, Surface and Motion

### Radius

| Element | Radius |
|---------|--------|
| Base (`--radius`) | 10px |
| Inputs, small buttons | `rounded-xl` (14px) |
| Tiles, cards, panels | `rounded-3xl` (22px) |
| Search fields, list rows | `rounded-2xl` (18px) |
| Sheets, floating tab bar | `rounded-3xl` (22px) |
| Pills, avatars | full |

### Surfaces

- Bento: white tiles of different sizes on the grey page. On Home, Missa is the tall tile and Palavra the wide one, and every tile shows its own state for today (the next Hour, the day's mysteries, the Palavra streak).
- Flat. Tiles are opaque with a hairline and at most a 2px shadow in light mode, none in dark.
- No cards inside cards: the readings sit on the page, not in a tile, because Horas nests its own cards inside them.
- Anything the page scrolls under is frosted, not opaque: the top bar, the tab bar, the prayer action rail. The reading should pass beneath, not be cut off.
- No gradients except the medal art. No glows, no coloured shadows, no glassmorphism cards.

### Motion

- Touch answers on touch-down: `.pressable` shrinks to 0.97 (rows), 0.985 (cards) or 0.92 (icons, tabs, keys) in 80ms and eases back in 240ms.
- Bars, sheets and the tab bar move on springs (`src/lib/motion.ts`), so they can be caught and reversed mid-flight.
- Direction carries meaning: the next bead of a guided prayer enters from the right, the previous one from the left.
- Reduce Motion turns every slide into a fade with the same timing. A drag still moves, since that motion is the user's own.

---

## 7. Voice and Tone

### Brand Personality

| Trait | We are | We are not |
|-------|--------|------------|
| **Reverent** | Unhurried, attentive to the sacred | Pious-sounding, saccharine |
| **Warm** | A companion praying alongside | Chummy, salesy, gamified |
| **Plain** | Short sentences, everyday words | Churchy jargon left unexplained |
| **Exact** | Literally true, sourced | Exaggerated, "the only", "always" |

### Who speaks

- The app prays **with** the reader: "O que vamos rezar hoje?" Invitations use *nós*.
- Explanatory prose (the guided Mass, notes on prayers) also uses *nós* and never addresses the reader as *tu*. Quoted sources may ("Ele vive e quer-te vivo").
- Direct instructions in the interface address the reader as *tu*: "Escolhe as Horas que queres rezar", "Tenta outra vez", "Que Nossa Senhora interceda por ti e pelos teus". Never *você* forms, *o senhor*, *por si* or *o seu* for the reader. Scripture and prayer texts keep their own forms.

### Writing rules

- **Orthography.** Authored prose uses the pre-1990 European norm: acção, acto, baptismo, exactamente, direcção. Liturgical texts keep their source's own spelling: the Ordinário's "atos e omissões" stays as printed. Don't "correct" one to match the other.
- **Prayer forms.** Use the forms prayed in Portugal: "Amen" (not "Amém"), "Avé Maria", "Salvé Rainha", "Acto de contrição", «E o Verbo divino encarnou». Never Brazilian forms.
- **Capitals.** Capitalise Vós/Vos only for God; possessives ("vosso") stay lowercase.
- **Quotes.** Use «guillemets», and quote only what has been checked against a primary source (vatican.va, liturgia.pt, the Sanctuary of Fátima). Where translations differ, quote the clause they share and paraphrase the rest.
- **Punctuation.** No em dashes in explanatory prose (notes on prayers, the guided Mass); use a colon or a comma. Titles of the form "Oremus — Hora da oração" are the exception.
- **Accuracy.** Words like *único*, *sempre* and *nunca* must survive a literal check. Opinion superlatives ("o momento mais livre") are fine.
- **Practical cues.** When explaining a rite, keep the practical cues: posture, gesture, what to answer.
- **Copyright.** No modern copyrighted devotional texts (living composers, recent authors) unless the rights holder agreed.

### Tone by context

| Context | Tone | Example |
|---------|------|---------|
| Greeting | Simple, time-aware | "Bom dia." / "O que vamos rezar hoje?" |
| Guided prayer | Quiet, instructional | Posture and response, then the text |
| Explanation | Warm, sourced | One idea, one quotation, no sermon |
| Error | Calm, says what to do | "Não foi possível publicar. Tenta outra vez." |
| Empty state | An invitation | "Ainda não pertences a nenhuma liga. Cria uma e partilha o convite…" |
| Achievement | Brief, never boastful | "Nova medalha" |
| Notification | Gentle, names the hour | "Hora da oração" |

### Prohibited Terms

| Avoid |
|-------|
| "Erro:" as a prefix |
| Exclamation marks in interface copy |
| "Desbloqueia conquistas", "subir de nível" |
| Brazilian forms ("Amém", "você" with the gerund, "tela") |
| Unsourced quotations |

Why: an error should say what happened and what to do; prayer isn't an alert; gaming language cheapens prayer; the audience prays in pt-PT; accuracy is part of the brand.

---

## 8. Imagery

The only illustration in the brand is the app icon, and it sets the style for any future art: a single-weight line engraving, devotional and calm, one warm metallic line colour on a dark field, no fill and no texture.

### Base Prompt Template

```
Fine single-weight line engraving, devotional and calm, warm rose-gold line (#C8988F)
on an unbroken near-black field (#1D1D1D), no fill, no gradient, no text, no halo,
centered with generous margin, flat, quiet, timeless.
```

### Style Keywords

| Category | Keywords |
|----------|----------|
| **Lighting** | none: line art on a flat field |
| **Mood** | recollected, quiet, reverent |
| **Composition** | centered, symmetrical, generous margin |
| **Treatment** | single line weight, no shading, no texture |
| **Aesthetic** | engraved holy card, not modern flat illustration |

### Avoid

| Avoid | Why |
|-------|-----|
| Photographs of people praying | Stock piety; competes with the text |
| Glowing halos, light rays, stained-glass effects | Kitsch, and reads as decoration over prayer |
| Emoji-style or 3D icons | Clashes with the engraving and with Lucide |
| Sacred images from paintings or photos without a licence | Copyright, and the brand's commitment to sources |

---

## 9. Open Decisions

These are inconsistencies found while writing this document. Each one needs a choice from the owner before the rule above can be completed.

1. **Orthography in interface strings.** Authored prose is pre-1990, but interface strings mix norms: "detetada", "Desativado" and "ativa" (new) beside "actual" and "actualizada" (old). Either extend the pre-1990 rule to the chrome or exempt it explicitly.
2. **One mark or two.** The app icon (praying hands on near-black) and the favicon and wordmark (cross on gold, or the liturgical colour) don't look like the same brand. Options: a hands favicon, a cross app icon, or keeping both with the cross defined as the small-size mark.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-10-28 | Initial guidelines, written from the app as built, including the AA contrast rules for the liturgical palette |
| 1.1 | 2026-10-28 | The interface addresses the reader as *tu*; the text-size setting scales the interface; touch targets fixed at 44px |
| 2.0 | 2026-10-28 | Bento by day, Imersivo by night: new page colours, no wash, solid day cards, 3xl tiles, extra-bold titles, bead and selected-state contrast rules |
| 2.1 | 2026-10-28 | Renamed from mORA to Oremus; old name kept in every identifier that existing data depends on |
