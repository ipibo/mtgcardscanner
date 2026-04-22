# MTG Collection Scanner

Personal Magic: The Gathering card collection manager. Scan cards with your phone camera, manage your collection, import decklists, and check European prices.

**Live:** https://mtgcardscanner.vercel.app  
**Repo:** https://github.com/ipibo/mtgcardscanner

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (Turbopack), TypeScript, React 19 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Turso (libSQL/SQLite) + Drizzle ORM |
| Card data & prices | Scryfall API (EUR prices via Cardmarket partnership) |
| OCR | Tesseract.js v6 (client-side, WASM) |
| PWA | Custom service worker (`public/sw.js`) + `app/manifest.ts` |
| Hosting | Vercel (app) + Turso EU West (DB) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── collection/          # GET list, POST add, PATCH qty, DELETE
│   │   ├── scryfall/            # Proxies: named, autocomplete, search, collection
│   │   └── health/              # DB connection diagnostic
│   ├── collection/              # Browse + filter collection
│   ├── scan/                    # Camera scanner + card confirmation sheet
│   ├── card/[scryfallId]/       # Card detail page with prices
│   ├── decklist/                # Decklist import (Have/Short/Missing)
│   └── manifest.ts              # PWA manifest
├── components/
│   ├── scanner/CameraViewfinder.tsx   # OCR scan loop, guide box, lookup
│   ├── collection/              # CardRow, SearchBar, QuantityControl
│   └── decklist/                # DecklistInput, ImportResults
├── lib/
│   ├── db/
│   │   ├── client.ts            # Turso singleton (global to survive hot reload)
│   │   ├── schema.ts            # Drizzle schema
│   │   └── queries/             # collection.ts, cache.ts
│   ├── scryfall/
│   │   ├── client.ts            # Typed fetch + 100ms rate limiter
│   │   └── types.ts             # ScryfallCard, ScryfallPrices, etc.
│   ├── ocr/
│   │   ├── cropCardName.ts      # Capture visible frame, Otsu threshold, 3x upscale
│   │   ├── cropConstants.ts     # CROP.top / .height / .marginX (shared by crop + guide)
│   │   └── worker.ts            # Tesseract worker singleton, PSM.SINGLE_LINE
│   └── decklist/parser.ts       # Parses MTGO/Arena/standard decklist text
└── hooks/
    ├── useCamera.ts             # getUserMedia, rear camera, flip
    └── useCollection.ts         # Client-side collection CRUD
```

---

## Database Schema

```
collections          id, user_id, created_at
collection_cards     id, collection_id, scryfall_id, card_name, set_code, quantity, foil, added_at
card_cache           scryfall_id, data (full JSON), cached_at, prices_at
```

Local dev: `file:./local.db` (set in `.env.local`)  
Production: `libsql://mtg-cards-ipibo.aws-eu-west-1.turso.io`

Run migrations: `npx drizzle-kit migrate`

---

## OCR Pipeline

1. **Capture visible frame** — render `<video>` to canvas at container size using object-cover source rect (so guide box CSS percentages exactly match what gets cropped)
2. **Crop name strip** — `CROP.top=1.5%`, `CROP.height=11%`, `CROP.marginX=5%` of container
3. **3× upscale** — Tesseract needs ~300dpi equivalent
4. **Greyscale + Otsu threshold** — pure black/white, kills foil shimmer and art gradients
5. **Tesseract** — PSM.SINGLE_LINE, char whitelist = printable ASCII letters + `',.-!'`

### Lookup strategy (in order, stops at first match)

1. Scryfall fuzzy — handles typos
2. Autocomplete on full text — handles truncated words (`"wil"` → `"Wilds"`)
3. Noise-filtered joined — strips single chars and short all-caps blobs, joins remaining words (`"N oriq Loremag EZ a"` → `"oriq Loremag"` → `"Oriq Loremage"`)
4. Noise-filtered per-word — tries each real word individually, longest first
5. No-space variant — handles OCR merging words (`"LightningBolt"`)
6. Raw per-word — last resort

---

## Scan Flow

- Camera opens on mount, Tesseract warms up in parallel
- OCR runs every 1.5 s while scanning
- Auto-confirms at **≥ 80% confidence** → lookup → bottom sheet slides up
- Bottom sheet: card image, set name, rarity dot, EUR price, foil toggle, **"Change set"** picker
- Change set: fetches all printings via `!"Card Name"&unique=prints`, scrollable list with EUR prices per printing
- Camera stays live throughout — no restart between cards

---

## Possible Next Steps

### OCR / Scanning
- **Scan the set symbol area** — set code is printed in text at the bottom of the card (e.g. `M21 · EN · 123 · R`); a second OCR pass there could auto-select the correct printing
- **Scan speed** — reduce interval from 1.5 s to ~1 s; or use confidence smoothing across frames (average 3 consecutive reads) to reduce false positives on partial reads
- **Vibration on success** — `navigator.vibrate(80)` on confirmed scan for tactile feedback

### Collection
- **Filter by set / colour / type** in the collection view
- **Card condition** — NM / LP / MP / HP / DMG per card
- **Multiple collections** — separate binders, trade binder vs. playing copies
- **Export to CSV** — for backup or import into Moxfield / Archidekt
- **Bulk quantity edit** — tap and hold to set exact quantity instead of +/−
- **Total collection value** — sum of `quantity × eur` for all cards, shown on dashboard

### Prices
- **Price history** — store Scryfall price snapshots daily in Turso, plot with a chart library
- **Price alerts** — notify when a card exceeds a threshold (Vercel Cron + push notifications)

### Decklist
- **Moxfield / Archidekt URL import** — fetch decklist from a URL instead of paste
- **Save decklists** — store imported decklists in DB, re-check later as collection grows
- **Missing card quick-add** — tap a missing card in the import results to scan/add it

### Auth / Multi-user
- `user_id` column already exists on `collections` — add NextAuth.js (Google/GitHub OAuth) when needed
- Each user gets their own collection with no code changes to the query layer

### PWA / Mobile
- **Splash screens** — add iOS splash screen meta tags for a polished install experience
- **Offline collection browse** — cache collection API responses in the service worker
