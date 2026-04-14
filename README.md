# Midsommardagsgolfen 2026

[![CI](https://github.com/danlentamlen/Midsommargolfen/actions/workflows/ci.yml/badge.svg)](https://github.com/danlentamlen/Midsommargolfen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node-20-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-62%20passing-brightgreen.svg)](#testing)

Golf, middag & midsommarfest on Rya GK, Helsingborg — 20 June 2026.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Local Development](#local-development)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Security](#security)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Data Flow](#data-flow)
- [Admin Access](#admin-access)
- [Deployment](#deployment)
- [Server-Side Security Recommendations](#server-side-security-recommendations)
- [License](#license)

---

## Features

### Registration & Packages
- **3 package tiers**: Full (900 kr), Golf-only (500 kr), Dinner & Party (400 kr)
- Form validation: name, email, Golf-ID (`YYMMDD-NNN`), handicap
- Duplicate detection via backend lookup (email + Golf-ID + name)
- Real-time capacity bars (golf: 32 slots, dinner: 60 slots) with colour coding
- Swish payment integration with pre-filled amounts

### Betting
- Select up to 5 golfers, 20 kr per pick
- Live odds display ranked by vote count
- Duplicate-bet prevention (backend check)
- Betting slip with running total

### Photo Management
- Drag-and-drop or file-picker upload
- Client-side compression (300 px, JPEG 0.5 quality)
- Chunked upload to Google Drive (4 KB chunks)
- **Drive = primary storage**, localStorage = write-through cache
- Instant preview from local cache while Drive upload completes

### Admin Dashboard
- Hidden access via triple-tap on logo
- SHA-256 password verification
- Tabbed view: Registrations + Bets
- Per-row payment status updates (Obetald → Betald → Återbetald)
- One-click confirmation / refund emails

### Other
- SPA navigation with hash routing and `data-nav` attributes
- Demo mode with sample data when no backend is configured
- Sponsor banner loaded from Google Drive folder
- About page with event history and Hall of Fame
- Info page with tournament rules (collapsible)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│                   (HTML shell — no inline JS/CSS)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    main.js      │  Entry point: event wiring,
                    │                 │  nav, init, data fetching
                    └──┬──┬──┬──┬──┬─┘
         ┌─────────────┤  │  │  │  └──────────────┐
         ▼             ▼  ▼  ▼  ▼                  ▼
   ┌──────────┐  ┌─────┐ │  │ ┌──────────┐  ┌──────────┐
   │config.js │  │state│ │  │ │ photos.js│  │sponsors.js│
   │          │  │.js  │ │  │ │          │  │           │
   │ CFG,     │  │     │ │  │ │ Drive    │  │ Drive     │
   │ env vars │  │App  │ │  │ │ upload,  │  │ logos,    │
   │          │  │state │ │  │ │ cache    │  │ fallback  │
   └──────────┘  └─────┘ │  │ └──────────┘  └───────────┘
                          │  │
               ┌──────────┘  └──────────┐
               ▼                        ▼
      ┌──────────────┐        ┌──────────────┐
      │registration  │        │  betting.js  │
      │.js           │        │              │
      │ Packages,    │        │ Player pick, │
      │ startlista,  │        │ odds, submit │
      │ form submit  │        │              │
      └──────────────┘        └──────────────┘
               │                        │
               └────────┬───────────────┘
                        ▼
                 ┌────────────┐
                 │  fetch.js  │  fetchWithTimeout
                 │            │  (10 s, CSRF header)
                 └────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  Google Apps      │
              │  Script Backend   │
              │  (Sheets + Drive) │
              └───────────────────┘

  Shared utilities:
  ┌──────────┐   ┌──────────┐
  │ utils.js │   │ admin.js │
  │escapeHtml│   │ SHA-256  │
  │sanitize  │   │ dashboard│
  │formatTel │   │ status   │
  └──────────┘   └──────────┘
```

**10 ES modules** — zero inline JavaScript, zero inline CSS.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm 10+

### Install

```bash
git clone https://github.com/danlentamlen/Midsommargolfen.git
cd Midsommargolfen
npm install
```

### Quick Start

```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
```

The app works without a backend — it loads demo data with a banner:
`"⚠️ Demoläge — ingen API konfigurerad"`.

---

## Local Development

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint on `src/` and `tests/` |

### Full Local Workflow

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure backend
cp .env.example .env
# Edit .env with your Google Apps Script URL

# 3. Start dev server
npm run dev

# 4. Run tests
npm test

# 5. Lint
npm run lint

# 6. Production build
npm run build

# 7. Preview production build
npm run preview
```

### Demo Mode

If `VITE_APPS_SCRIPT_URL` is not set, the app runs in demo mode:
- Loads 8 sample players from [src/state.js](src/state.js)
- All features work (registration form, betting, photo upload, admin)
- A yellow banner indicates demo mode
- No network requests are made

---

## Testing

**62 tests** across 5 files using [Vitest](https://vitest.dev/) + jsdom.

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

### Test Breakdown

| File | Tests | Coverage |
|---|---|---|
| [tests/utils.test.js](tests/utils.test.js) | 22 | `escapeHtml` (10 XSS vectors), `formatTel` (7), `photoKey` (5) |
| [tests/registration.test.js](tests/registration.test.js) | 12 | Form validation, pricing logic, capacity calculations |
| [tests/betting.test.js](tests/betting.test.js) | 12 | Player toggle, odds calculation, submit validation |
| [tests/admin.test.js](tests/admin.test.js) | 8 | SHA-256 auth (5), tab switching, visibility |
| [tests/fetch.test.js](tests/fetch.test.js) | 8 | Timeout/abort, CSRF header, signal pass-through, error handling |

### What's Tested

- **XSS prevention**: `<script>`, `<img onerror>`, `<svg onload>`, `javascript:` URIs, event handlers
- **Swedish phone formatting**: country codes, 10-digit normalization
- **Photo key determinism**: spelarid → golfid → name fallback chain
- **Golf-ID validation**: strict `YYMMDD-NNN` regex
- **Package pricing**: 900 / 500 / 400 kr per tier
- **Capacity math**: slot counting, percentage capping, remaining spots
- **Betting rules**: max 5 picks, 20 kr each, odds ranking
- **Admin auth**: SHA-256 hash determinism, wrong-password rejection
- **Fetch wrapper**: AbortController timeout, CSRF header injection, header merging

### CI/CD

GitHub Actions runs on every push and PR to `main`:

1. **Lint** — `npm run lint`
2. **Test** — `npm test`
3. **Build** — `npm run build`

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `VITE_APPS_SCRIPT_URL` | No | Google Apps Script web app URL. Omit for demo mode. |

The Apps Script URL is injected at build time via `import.meta.env` — never hardcoded in source.

---

## Project Structure

```
.
├── index.html                  HTML shell (no inline JS/CSS)
├── src/
│   ├── main.js                 Entry point — event wiring, init, SPA nav
│   ├── config.js               CFG constants, env vars, pricing
│   ├── state.js                Shared state singleton + demo SAMPLE data
│   ├── utils.js                escapeHtml, sanitizeHtml (DOMPurify), formatTel
│   ├── fetch.js                fetchWithTimeout (10 s, CSRF header)
│   ├── registration.js         Packages, startlista, form validation, submit
│   ├── betting.js              Player selection, odds, bet submission
│   ├── admin.js                SHA-256 login, dashboard, status updates, email
│   ├── photos.js               Photo key, Drive upload, localStorage cache
│   ├── sponsors.js             Sponsor banner from Drive folder
│   └── styles.css              All CSS (custom properties, responsive)
├── public/
│   └── logo.jpg                Event logo (extracted from original base64)
├── tests/
│   ├── utils.test.js           22 tests — escapeHtml, formatTel, photoKey
│   ├── registration.test.js    12 tests — validation, pricing, capacity
│   ├── betting.test.js         12 tests — toggle, odds, submit rules
│   ├── admin.test.js            8 tests — SHA-256 auth, tabs, visibility
│   └── fetch.test.js            8 tests — timeout, abort, CSRF, errors
├── .github/workflows/ci.yml   GitHub Actions: lint → test → build
├── .env.example                Environment variable template
├── .gitignore                  node_modules, dist, .env, .DS_Store
├── vite.config.js              Vite build config
├── vitest.config.js            Vitest test config (jsdom)
├── eslint.config.js            ESLint flat config
├── netlify.toml                Netlify build + deploy settings
├── package.json                Dependencies, scripts
├── CONTRIBUTING.md             Development workflow & code style
├── LICENSE                     MIT
└── README.md                   ← You are here
```

---

## Security

| Feature | Implementation |
|---|---|
| **XSS prevention** | `escapeHtml()` on all user data in innerHTML; `sanitizeHtml()` (DOMPurify) for rich HTML content |
| **Admin auth** | SHA-256 hash comparison via `crypto.subtle.digest` — no plaintext password in source |
| **CSRF header** | Every `fetchWithTimeout` call includes `X-Requested-With: XMLHttpRequest` |
| **Env vars** | Backend URL from `VITE_APPS_SCRIPT_URL` — not committed to repo |
| **Rate limiting** | Client-side 5-second cooldown on registration/bet submissions (sessionStorage) |
| **Duplicate prevention** | Backend duplicate checks before registration and betting |
| **Input validation** | Golf-ID regex, required fields, HTML5 email validation |

---

## Performance

| Optimization | Detail |
|---|---|
| **Code splitting** | Vite bundles into hashed CSS + JS files for long-term caching |
| **Font loading** | `preconnect` + `preload` for Google Fonts with `display=swap` |
| **Lazy images** | All images use `loading="lazy"` + `decoding="async"` |
| **Deferred sponsors** | Sponsor logos loaded via `requestIdleCallback` after main render |
| **Photo caching** | Drive = primary, localStorage = write-through cache with instant preview |
| **Photo compression** | Canvas-based JPEG resize (300 px, 0.5 quality) before upload |
| **Demo mode** | Zero network requests when no backend is configured |

---

## Accessibility

| Feature | Detail |
|---|---|
| **Skip navigation** | `<a class="skip-nav">Hoppa till innehåll</a>` for keyboard users |
| **ARIA labels** | Hamburger menu (`aria-label="Öppna meny"`), nav buttons |
| **aria-hidden** | Decorative emoji icons hidden from screen readers |
| **role="alert"** | Error messages announced by screen readers |
| **Semantic HTML** | `<header>`, `<nav>`, `<section>`, `<main>`, proper heading hierarchy |
| **Keyboard nav** | All interactive elements are `<button>`, no `<div onclick>` |
| **Colour coding** | Capacity bars: green → amber → red with text labels |

---

## Data Flow

### Registration

```
User fills form
  → Client validates (name, email, Golf-ID format)
  → GET ?action=checkDuplikat (duplicate check)
  → POST {action:'anmalan', namn, email, telefon, golfid, handicap, paket, ...}
  → Backend writes to Google Sheet
  → Confirm page + Swish payment link
```

### Betting

```
User selects 1–5 golfers
  → GET ?action=checkBet (duplicate check)
  → POST {action:'bet', namn, email, spelare, spelarid, totalbelopp, ...}
  → Backend writes to Google Sheet
  → Confirm page + Swish payment link
```

### Photo Upload

```
User selects photo
  → Compress to 300 px JPEG (canvas)
  → Save data URL to localStorage (instant preview)
  → Split into 4 KB chunks
  → POST each chunk: ?action=uploadChunk&uploadId=...&chunk=...&index=...&total=...
  → Backend assembles file in Drive
  → Drive URL cached locally (replaces data URL)
```

### Initial Page Load

```
App starts
  → Promise.all([GET ?action=spelare, GET ?action=deltagare])
  → Populate state.betPlayers + state.allParts
  → fetchDrivePhotos() in background → cache in localStorage → re-render
  → requestIdleCallback → loadSponsors()
  → If no backend: load SAMPLE data + show demo banner
```

---

## Admin Access

1. **Triple-tap** the nav logo (3 taps within 400 ms)
2. Enter the admin password at the login prompt
3. Dashboard shows two tabs: **Anmälningar** (registrations) and **Bets**

To change the admin password:

```bash
echo -n 'newpassword' | shasum -a 256
```

Update `adminLosenordHash` in [src/config.js](src/config.js).

---

## Deployment

**Netlify** auto-builds on every push to `main`.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 20 |

Set `VITE_APPS_SCRIPT_URL` in Netlify's environment variables (Site settings → Environment variables).

---

## Server-Side Security Recommendations

The client-side codebase sanitizes user input and uses SHA-256 hashed password comparison. For production hardening, the Google Apps Script backend should also implement:

| Area | Recommendation |
|---|---|
| **Authentication** | Move admin auth to a server-side endpoint. Client-side hash comparison reveals the hash in source. |
| **CSRF protection** | All client requests include an `X-Requested-With: XMLHttpRequest` header. Validate this header (and/or `Origin`) on all POST endpoints server-side to reject cross-origin form submissions. |
| **Input validation** | Validate and sanitize all incoming fields (name, email, Golf-ID format) server-side before writing to Google Sheets. |
| **Rate limiting** | Limit registration/bet submissions per IP or email (e.g. 5 per hour) to prevent abuse. |
| **CORS** | Restrict `Access-Control-Allow-Origin` to the deployed Netlify domain only. |
| **Data exposure** | The `adminData` endpoint should require server-verified authentication, not just a client-side flag. |

---

## License

[MIT](LICENSE)
