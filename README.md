# Trading Lab

A personal ICT trading journal — log trades, track rules, study setups, and watch your equity curve. Built with React + Vite, synced across devices via Supabase.

> **Live:** https://seancully.github.io/trading-lab/

## Features

- **Journal** — log trades with screenshots, R-multiples, sessions, confluences
- **Rules** — your trading rulebook, scored against every trade
- **A+ Setups** — Notion-style block notes for each entry model
- **Performance** — win rate, profit factor, equity curve, drawdown, model breakdown
- **Calendar** — month-grid view of daily P&L (Mon–Fri)
- **Cross-device sync** — Supabase auth + RLS, your data stays private to your account

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

If `.env.local` is missing the app falls back to local-only mode (works on this device, no cross-device sync).

## Supabase setup

Run [`supabase/schema.sql`](supabase/schema.sql) in your project's SQL Editor — once. It creates a per-user `tl_data` table with row-level security so every authenticated user only ever reads their own rows.

Then in **Project Settings → API** copy the Project URL and the anon (public) key into `.env.local`.

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow needs two repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set them under **Settings → Secrets and variables → Actions**.

## Stack

- React 19 + Vite
- Supabase (auth + Postgres with RLS)
- Plain CSS with design tokens
- LocalStorage as the always-available cache; Supabase as the source of truth when signed in
