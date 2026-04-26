"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

function SidebarLink({
  href,
  label,
  caption,
  active,
}: {
  href: string;
  label: string;
  caption: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group block rounded-lg border px-4 py-3 transition",
        active
          ? "border-slate-700 bg-slate-900 text-white"
          : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span
          className={[
            "h-2 w-2 transition",
            active ? "bg-emerald-400" : "bg-slate-600 group-hover:bg-slate-400",
          ].join(" ")}
        />
      </div>
      <p className={["mt-1 text-xs leading-5", active ? "text-slate-300" : "text-slate-500 group-hover:text-slate-400"].join(" ")}>
        {caption}
      </p>
    </Link>
  );
}

function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-950">
              SoloLedger AI
            </Link>
            <p className="mt-1 text-xs text-slate-500">Personal finance planning and AI guidance.</p>
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-sm text-slate-500">Loading...</span>
            ) : user ? (
              <div className="hidden border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 md:block">
                {user.email}
              </div>
            ) : null}

            <button
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="border border-slate-900 bg-slate-950 p-4 text-white shadow-sm">
            <div className="border border-slate-800 bg-slate-900 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Your money workspace</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Move step by step: review activity, plan your month, and keep recurring bills or income in view.
              </p>
            </div>

            <nav className="mt-4 space-y-2">
              <SidebarLink
                href="/dashboard"
                label="Overview"
                caption="Start here: cash flow, recent activity, and what needs attention now."
                active={pathname === "/dashboard"}
              />
              <SidebarLink
                href="/dashboard/plan"
                label="Planning"
                caption="Budgets, savings goals, and a clearer monthly plan."
                active={pathname === "/dashboard/plan"}
              />
              <SidebarLink
                href="/dashboard/automation"
                label="Recurring"
                caption="Bills, subscriptions, salary, and other repeating items."
                active={pathname === "/dashboard/automation"}
              />
              <SidebarLink
                href="/"
                label="AI Assistant"
                caption="Ask questions and get guidance using your financial data."
                active={pathname === "/"}
              />
            </nav>

            <div className="mt-5 border border-slate-800 bg-slate-900 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">How to use it</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                If you are new here, begin in Overview, then add a budget, a savings goal, and any recurring bills.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6">
          <main className="min-w-0">{children}</main>
        </div>
      }
    >
      <AppLayoutShell>{children}</AppLayoutShell>
    </Suspense>
  );
}
