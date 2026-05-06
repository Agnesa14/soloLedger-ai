# SoloLedger AI - Demo Cheatsheet Shqip

## Qellimi i prezantimit

SoloLedger AI eshte nje aplikacion personal finance qe i ndihmon perdoruesit te:

- regjistrojne te hyra dhe shpenzime
- shohin gjendjen mujore financiare
- vendosin buxhete sipas kategorive
- ndjekin qellime kursimi
- menaxhojne pagesa ose te hyra qe perseriten
- marrin keshilla nga nje asistent AI qe lexon kontekstin financiar te perdoruesit

Fjalia hyrese:

> SoloLedger AI eshte nje web app per menaxhim personal te financave. Ideja kryesore eshte qe perdoruesi jo vetem te regjistroje shpenzimet, por edhe ta kuptoje me mire gjendjen financiare dhe te marre hapa konkrete per buxhetim, kursim dhe pagesa te rregullta.

## Rrjedha e demos 5-7 minuta

### 1. Login dhe workspace i mbrojtur

Cfare te klikosh:

- hap `https://solo-ledger-ai.vercel.app/` ose `http://localhost:3000`
- shko te login
- hy me demo account

Cfare te thuash:

> Aplikacioni perdor Supabase Auth. Secili perdorues ka workspace privat, keshtu qe transaksionet, buxhetet, qellimet dhe historiku i chat-it ruhen per ate account.

### 2. Dashboard overview

Cfare te tregosh:

- monthly income
- monthly expenses
- net result
- setup checklist
- weekly pulse
- recent activity

Cfare te thuash:

> Dashboard-i jep nje pamje te shpejte te muajit aktual: sa para kane hyre, sa jane shpenzuar dhe cfare mbetet neto. Qellimi eshte qe perdoruesi ta kuptoje gjendjen pa hyre ne tabela te komplikuara.

### 3. Shto nje transaction

Cfare te klikosh:

- `Add transaction`
- zgjidh `Money out` ose `Money in`
- vendos amount, category, note dhe date
- ruaje

Cfare te thuash:

> Transaksionet jane baza e aplikacionit. Pasi shtohen te hyra dhe shpenzime, te gjitha pjeset tjera behen me te vlefshme: dashboard-i, buxhetet, weekly pulse dhe AI assistant.

Shembull per demo:

- Income: `1200`, category `Salary`
- Expense: `18.50`, category `Food`, note `Groceries`

### 4. Planning: buxhete dhe qellime kursimi

Cfare te klikosh:

- sidebar `Planning`
- trego budgets
- trego savings goals
- hap modalin `Add budget` ose `Add savings goal`

Cfare te thuash:

> Planning e ben aplikacionin me shume se nje tracker. Perdoruesi mund te vendose limit per kategori, p.sh. Food 250 EUR, dhe aplikacioni e krahason shpenzimin aktual me ate limit. Per qellime kursimi, aplikacioni tregon progresin dhe sa presion mujor ka per ta arritur targetin.

### 5. Recurring: pagesa dhe te hyra qe perseriten

Cfare te klikosh:

- sidebar `Recurring`
- trego recurring bills/income
- nese ka item due, trego log action

Cfare te thuash:

> Ketu ruhen gjera qe perseriten si qiraja, paga, abonimet ose pagesat mujore. Kjo ndihmon perdoruesin te mos harroje obligimet fikse dhe te kuptoje sa para jane te zena para se te filloje shpenzimi fleksibil.

Shembuj:

- Rent, expense, monthly
- Salary, income, monthly
- Spotify, expense, monthly

### 6. AI Assistant

Cfare te klikosh:

- sidebar `AI Assistant`
- perdor nje suggested prompt ose shkruaj:

```text
Review my spending and suggest one simple action for this week.
```

Cfare te thuash:

> AI assistant nuk eshte thjesht chatbot i pergjithshem. Ai merr kontekst nga transaksionet, buxhetet, qellimet e kursimit, recurring items dhe weekly pulse. Prandaj pergjigjet jane me praktike dhe lidhen me numrat e perdoruesit.

## Pikat teknike qe duhen permendur shkurt

- Frontend: Next.js App Router, React, TypeScript
- Styling: Tailwind CSS
- Auth dhe database: Supabase Auth + Supabase Postgres
- AI: OpenRouter API per chat completions
- Data privacy: tabelat perdorin `user_id` dhe Row Level Security ne Supabase
- Bilingual base: UI ka English dhe Albanian language switcher

Fjali teknike e shkurter:

> Arkitektura eshte e ndare ne faqe UI dhe data helper modules. Per shembull, transaksionet, planning, recurring dhe chat messages kane module te ndara ne `lib/`, ndersa Supabase perdoret per auth dhe ruajtje te te dhenave.

## Plan B nese live demo deshton

- perdor `http://localhost:3000`
- projekti eshte verifikuar me `npm run lint`
- projekti eshte verifikuar me `npm run build`
- nese AI nuk pergjigjet, shpjego se pa `OPENROUTER_API_KEY` aplikacioni ka fallback mock per demo lokale
- nese login ka problem, perdor pamjet e pergatitura ose versionin lokal

## Checklist para prezantimit

- hap live URL
- provo login
- sigurohu qe demo account ka data
- kontrollo Dashboard, Planning, Recurring dhe AI Assistant
- provo language switcher English/Shqip
- pergatit nje prompt per AI
- mbaje lokal `http://localhost:3000` si backup

## Mbyllja

> SoloLedger AI e ben menaxhimin personal te financave me te qarte dhe me praktik. Ai kombinon tracking, planning, recurring financial commitments dhe AI guidance ne nje workflow te vetem per perdoruesin.
