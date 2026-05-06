import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const capabilities = [
  {
    title: "Transactions",
    detail: "Income and expenses with category, note, date, and monthly summaries.",
  },
  {
    title: "Planning",
    detail: "Budgets, savings goals, spending risk, and goal funding pressure.",
  },
  {
    title: "Recurring",
    detail: "Salary, rent, subscriptions, and fixed commitments due soon.",
  },
  {
    title: "AI context",
    detail: "Assistant prompts grounded in records, plans, recurring items, and weekly pulse.",
  },
];

const workflow = [
  "Add a few income and expense records",
  "Set category limits and savings targets",
  "Register recurring bills and income",
  "Ask the assistant what to improve next",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f5f6] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <BrandLogo compact />

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:py-18">
          <div className="max-w-4xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Personal finance operating system
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              A calmer way to track money, plan the month, and ask better financial questions.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              SoloLedger AI combines account-based tracking, planning, recurring commitments, and contextual AI
              guidance in one workspace built for practical personal finance decisions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-black"
              >
                Create workspace
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-50"
              >
                Log in
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {capabilities.map((item) => (
                <article key={item.title} className="border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace sequence
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">From records to decisions</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The product is designed around a simple loop: enter the money movement, define the plan, keep fixed
              commitments visible, then ask the assistant for the next best action.
            </p>

            <div className="mt-6 divide-y divide-slate-800 border border-slate-800">
              {workflow.map((item, index) => (
                <div key={item} className="flex gap-4 bg-slate-900 px-4 py-4">
                  <div className="grid h-8 w-8 shrink-0 place-items-center border border-slate-700 text-sm font-semibold text-slate-200">
                    {index + 1}
                  </div>
                  <div className="text-sm font-medium leading-7 text-slate-200">{item}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 border border-slate-800 bg-slate-900 p-4">
              <div className="text-sm font-semibold text-white">What makes it different</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The assistant is not isolated chat. It receives summarized financial context from the authenticated
                workspace, so responses can refer to tracked behavior instead of generic advice.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        <div className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Product value
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              One clear workspace for personal finance decisions.
            </h2>
          </div>

          <p className="text-sm leading-7 text-slate-600">
            A user starts by logging transactions, then adds budgets and goals, then registers recurring obligations.
            The dashboard summarizes the state of the month.
          </p>

          <p className="text-sm leading-7 text-slate-600">
            The AI assistant uses that context to suggest concrete next steps, such as reducing a category, protecting a
            savings goal, or preparing for upcoming fixed costs.
          </p>
        </div>
      </section>
    </main>
  );
}
