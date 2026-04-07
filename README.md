# SoloLedger AI

**Live Demo:** https://solo-ledger-ai.vercel.app/

SoloLedger AI is a **Next.js (TypeScript)** application that provides an authenticated **AI chat** experience. It uses **Supabase Auth** for signup/login and **Supabase Postgres** to persist chat messages so users can refresh or reopen the app and continue where they left off. **Row Level Security (RLS)** ensures each user can only access their own data.

## Features
- Authentication (Sign up / Login) with Supabase Auth
- Protected routes (only authenticated users can access the dashboard/chat)
- AI Chat (user + assistant messages)
- Database persistence (messages stored in Supabase `chat_messages`)
- Row Level Security (RLS): users can only read/insert their own rows (`auth.uid() = user_id`)

## Tech Stack
- Next.js (App Router)
- TypeScript
- Supabase (Auth + Postgres)
- OpenRouter (AI API)
- Vercel (Deployment)

## Environment Variables
To run locally, create a `.env.local` file in the project root and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`

In Vercel, set the same variables in **Project → Settings → Environment Variables**, then redeploy.

## Run Locally
```bash
npm install
npm run dev
```

Open: http://localhost:3000