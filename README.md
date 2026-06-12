# Cashlint Rates

Cashlint Rates is a small exchange-rate app built with care: conversion, pair analysis, quote comparison, charts, formula notes, and a guarded AI helper named Bogart.

The point of the project is not to pretend exchange rates are simple. It is to take messy reference-rate data, clean it up, show the calculations plainly, and explain what is on the screen without drifting into financial advice.

I built this as a real application slice, not a mock dashboard. The API routes validate requests, the domain layer owns the calculations, the UI renders server-owned view models, and Bogart only explains the current result context that the app gives him.

## What is here

- A currency converter using the latest available Frankfurter reference rate.
- Pair analysis over a selected historical range.
- Multi-quote comparison against one base currency.
- Historical and indexed movement charts.
- Clean observation tables, summary tables, formula disclosures, caveats, and attribution.
- Ask Bogart, a result-aware explanation assistant with refusal rules for advice, forecasts, and trading-style prompts.

Bogart can explain things like typical movement, period movement, latest reference rate, and what the chart is showing. He should not tell anyone whether to exchange money, whether a rate is good, or what might happen next.

## Why I am proud of it

This app has a few things I care about as a developer:

- The boundaries are deliberate. UI components do not secretly recalculate domain truth.
- Dates go through the shared date facade, so date behavior stays consistent.
- API responses use a standard envelope and typed DTOs.
- Historical data is treated as imperfect data, not as magic input.
- Formula text lives in a server-owned registry, so the UI and Bogart explain the same calculations.
- The AI layer is grounded by app-owned context instead of being handed loose page text and vibes.

It is still a growing project, but the bones are there. The goal is a usable app that lets someone see how an exchange-rate result was produced.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Vitest and Testing Library
- ESLint
- `date-fns`, routed through `@/shared/date`
- `pristine-styles` and `pristine-charts`
- Frankfurter for exchange-rate data
- Google Gemini for Bogart when `GOOGLE_API_KEY` is configured

## Running locally

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3000
```

Bogart works locally without an AI key by using a deterministic local provider. For live AI answers, add this server-side environment variable:

```bash
GOOGLE_API_KEY=your_google_ai_key
```

Keep it server-side. Do not expose it as a `NEXT_PUBLIC_*` variable.

## Before deploying

These are the checks I run before treating the app as ready:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment notes

This is a standard Next.js app, so Vercel is the natural deployment path.

Set `GOOGLE_API_KEY` in the deployment environment if Bogart should use Gemini. If the key is missing, the app falls back to the local explanation provider, which is useful for development but not the intended live experience.

Frankfurter is called from server-side code. There is no client-side exchange-rate API key to configure.

## Project map

- `src/app` - pages, API routes, layout, and global styles.
- `src/components` - converter, analysis, comparison, charts, Bogart UI, and page-memory wiring.
- `src/server/application` - use-case orchestration and route handlers.
- `src/server/domain` - currency, date-range, rate, statistics, formula, and Bogart policy logic.
- `src/server/adapters` - integrations such as Frankfurter and Bogart providers.
- `src/shared` - DTOs, date helpers, and functional primitives.
- `tests` - unit, component, and integration coverage.
