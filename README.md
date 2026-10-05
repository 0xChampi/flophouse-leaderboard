# Flophouse leaderboard

[Live dashboard](https://flophouse.vercel.app) · [GitHub repository](https://github.com/0xChampi/flophouse-leaderboard)

A Flophouse community dashboard mapped from [Gamba leaderboard #20764](https://gamba.com/promotions/exclusive-leaderboards/20764). The source identifies the race as **Flophouse Lb!**, hosted by **Travszzz**, with eligibility code **flop**. Its source dates are September 14–October 14, 2026.

The dashboard uses Gamba’s dark navy and mint green palette, actual public player names and avatars, qualifying wagers, prize distribution, and house-edge contribution bands. Community attribution uses the existing Trav / HyperThreat TV × Flophouse material; no private intake answers or unverified social links are published.

Branding uses the supplied Flophouse gold and green `$FLOP` emblem, preserved as AVIF with a PNG copy for the site icon and share preview. [Flophouse’s public Kick About page](https://kick.com/flophouse/about) confirms the matching emblem, host Travszzz, Gamba code `FLOP`, and [FlophouseHQ on X](https://x.com/FlophouseHQ). The dashboard links to those community accounts. Source verification is recorded in `data/community-source.json`.

## Run

Node 24 is used in production.

```sh
npm ci
npm run dev
```

The local dashboard opens at `http://127.0.0.1:3247`.

## Data and refresh

`data/leaderboard.json` is a normalized, verified public source capture. `data/source-capture.json` preserves its public Gamba payload. Capture time is shown in the interface and exported CSV. Prize amounts are projected, in the source currency, USDT. Rankings preserve the source positions.

Gamba currently restricts direct server requests. `/api/leaderboard` attempts the fixed public source endpoint with a bounded timeout and validates the result. A rejected or malformed response retains the bundled capture and its original timestamp. A dashboard refresh does not pretend to update saved standings when the upstream cannot be reached. The Gamba link always provides a route to the current official board.

Refresh the capture through an ordinary anonymous browser:

```sh
npm run sync
npm test
npm run typecheck
npm run build
```

Review and commit the data diff, then push to `main` for the connected Vercel deployment. Refresh is an explicit local command; the project has no automatic job schedule and never starts a game, purchases credit, or uses a paid image generation service. If Gamba denies the browser request, the previous capture is retained.

Source date strings do not include a timezone. The absolute deadline was verified against Gamba’s rendered countdown in both UTC and America/New_York browser contexts: both resolve to October 14, 2026 at 23:59:59 UTC, within one second. The observations are recorded in `data/deadline-verification.json`. A changed source deadline will not inherit that verification; it displays a source date until verified again.

## Features and validation

- Responsive overview and podium; all captured standings with search, prize-place filter, sorting, and pagination.
- Player details, projected prizes, source contribution rules, eligibility-code copy, dashboard sharing, and CSV download.
- Native keyboard-accessible player dialog, reduced motion support, mobile layout, source provenance and explicit freshness state.
- Tests cover mapping, invalid source values, duplicate IDs, source denial/timeout fallback, and spreadsheet-safe CSV export.

The browser exercise is reproducible with `node scripts/check-dashboard.mjs` against the local app, or with a deployed URL as its argument. It verifies the real search/filter/pagination/dialog/download/clipboard/refresh flows and checks 320, 390, 768 and 1440 pixel layouts. Evidence is saved under `reports/`.

The site is an independent community view. Gamba determines eligibility, final standings, and payouts.
