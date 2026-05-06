"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";
import { useLanguage } from "../providers/LanguageProvider";

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

function SidebarSubLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "block border-l px-4 py-2 text-sm transition",
        active
          ? "border-emerald-400 bg-slate-900 text-white"
          : "border-slate-800 text-slate-500 hover:border-slate-600 hover:bg-slate-900 hover:text-slate-300",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const planningSection = searchParams.get("section") === "goals" ? "goals" : "budgets";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <BrandLogo href="/dashboard" compact />
            <p className="mt-1 text-xs text-slate-500">{t("app_tagline")}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span>{t("common_language")}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "sq")}
                className="border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="en">{t("common_english")}</option>
                <option value="sq">{t("common_albanian")}</option>
              </select>
            </label>

            {loading ? (
              <span className="text-sm text-slate-500">{t("common_loading")}</span>
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
              {t("nav_logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="grid w-full grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="border border-slate-900 bg-slate-950 p-4 text-white shadow-sm">
            <div className="border border-slate-800 bg-slate-900 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t("nav_workspace")}</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{t("nav_workspace_title")}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {t("nav_workspace_description")}
              </p>
            </div>

            <nav className="mt-4 space-y-2">
              <SidebarLink
                href="/dashboard"
                label={t("nav_overview")}
                caption={t("nav_overview_caption")}
                active={pathname === "/dashboard"}
              />
              <SidebarLink
                href="/dashboard/plan"
                label={t("nav_planning")}
                caption={t("nav_planning_caption")}
                active={pathname === "/dashboard/plan"}
              />
              {pathname === "/dashboard/plan" ? (
                <div className="ml-4 space-y-1 border-l border-slate-800 pl-3">
                  <SidebarSubLink
                    href="/dashboard/plan?section=budgets"
                    label="Budgets"
                    active={planningSection === "budgets"}
                  />
                  <SidebarSubLink
                    href="/dashboard/plan?section=goals"
                    label="Goals"
                    active={planningSection === "goals"}
                  />
                </div>
              ) : null}
              <SidebarLink
                href="/dashboard/automation"
                label={t("nav_recurring")}
                caption={t("nav_recurring_caption")}
                active={pathname === "/dashboard/automation"}
              />
              <SidebarLink
                href="/dashboard/assistant"
                label={t("nav_ai_assistant")}
                caption={t("nav_ai_assistant_caption")}
                active={pathname === "/dashboard/assistant"}
              />
            </nav>

            <div className="mt-5 border border-slate-800 bg-slate-900 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t("nav_how_to_use")}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {t("nav_how_to_use_description")}
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
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <main className="min-w-0">{children}</main>
        </div>
      }
    >
      <AppLayoutShell>{children}</AppLayoutShell>
    </Suspense>
  );
}
