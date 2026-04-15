# SoloLedger AI

Live demo: https://solo-ledger-ai.vercel.app/

SoloLedger AI is a Next.js + TypeScript app for personal finance tracking with an authenticated AI assistant. Users can sign up, log in, chat with the assistant, and manage their own transactions from a protected dashboard.

## What the project does

- Authenticates users with Supabase Auth
- Stores chat history in Supabase Postgres
- Stores personal income and expense transactions
- Shows monthly income, expense, and net summary cards
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

## Notes

- If `OPENROUTER_API_KEY` is missing, the app falls back to a mock AI response for easier local demos.
- For production on Vercel, add the same environment variables in Project Settings -> Environment Variables.
- Make sure your Supabase project includes the `chat_messages` and `transactions` tables with RLS enabled.
