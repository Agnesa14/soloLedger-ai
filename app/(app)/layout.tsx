"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
        active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-900">
            SoloLedger <span className="text-slate-500">AI</span>
          </Link>

          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-sm text-slate-500">Loading...</span>
            ) : user ? (
              <span className="hidden text-sm text-slate-600 sm:block">{user.email}</span>
            ) : null}

            <button
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1">
            <NavItem href="/dashboard" label="Dashboard" />
            <NavItem href="/" label="AI Chat" />
          </nav>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Tip: Add transactions to unlock insights and budgeting suggestions.
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
