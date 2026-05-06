# SoloLedger AI

Production URL: https://solo-ledger-ai.vercel.app/

SoloLedger AI is a Next.js + TypeScript app for personal finance tracking with an authenticated AI assistant. Users can sign up, log in, chat with the assistant, and manage their own transactions from a protected dashboard.

## What the project does

- Authenticates users with Supabase Auth
- Stores chat history in Supabase Postgres
- Stores personal income and expense transactions
- Stores monthly category budgets and savings goals
- Stores recurring income and expense templates for fixed commitments
- Shows monthly income, expense, and net summary cards
- Compares current spending against category guardrails
- Tracks savings goal progress and monthly funding pressure
- Surfaces a rolling weekly pulse and upcoming recurring obligations
- Protects user data with Row Level Security rules

## Tech stack

- Next.js App Router
- React 19
- TypeScript
- Supabase Auth + Postgres
- OpenRouter API
- Tailwind CSS 4
- Vercel

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=SoloLedger-AI
```

3. Start the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Supabase schema

Run the SQL migrations in your Supabase project before using planning features:

```sql
-- Run this file in the Supabase SQL editor
-- supabase/migrations/20260422_add_budgets_and_savings_goals.sql
-- supabase/migrations/20260425_add_recurring_transactions.sql
```

## Notes

- If `OPENROUTER_API_KEY` is missing, the app falls back to a local mock AI response so development is not blocked.
- For production on Vercel, add the same environment variables in Project Settings -> Environment Variables.
- Make sure your Supabase project includes the `chat_messages`, `transactions`, `budgets`, `savings_goals`, and `recurring_transactions` tables with RLS enabled.
- The repo now includes a migration at `supabase/migrations/20260422_add_budgets_and_savings_goals.sql` for the new planning layer.
- The repo also includes `supabase/migrations/20260425_add_recurring_transactions.sql` for the recurring planner.

## Product readiness

- Production target: `https://solo-ledger-ai.vercel.app/`
- Presentation plan: [docs/product-presentation-plan.md](docs/product-presentation-plan.md)
- For product walkthroughs and testing, use an account with transactions, budgets, savings goals, and recurring items so the dashboard and AI assistant show meaningful results.
