"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";
import { useLanguage } from "../providers/LanguageProvider";
import { getErrorMessage, hasMessage } from "@/lib/errors";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const showCheckEmailHint = useMemo(() => searchParams.get("checkEmail") === "1", [searchParams]);

  useEffect(() => {
    if (showCheckEmailHint) {
      setInfo(t("auth_check_email"));
    }
  }, [showCheckEmailHint, t]);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError(t("auth_invalid_email"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth_password_short"));
      return;
    }

    setSubmitting(true);
    try {
      await signIn({ email: normalizedEmail, password });
      router.replace("/dashboard");
    } catch (signInError) {
      if (hasMessage(signInError, "email not confirmed")) {
        setError(t("auth_email_not_confirmed"));
      } else if (hasMessage(signInError, "invalid login credentials")) {
        setError(t("auth_invalid_credentials"));
      } else if (hasMessage(signInError, "too many requests")) {
        setError(t("auth_too_many_attempts"));
      } else {
        setError(getErrorMessage(signInError, t("auth_login_failed")));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] text-slate-950">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="hidden border-r border-slate-200 bg-white px-8 py-10 lg:block">
          <BrandLogo />

          <div className="mt-16 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Secure finance workspace
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
              Continue from tracking to planning without losing the financial context.
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-600">
              Your transactions, budgets, savings goals, recurring commitments, and AI history stay tied to your own
              authenticated workspace.
            </p>
          </div>

          <div className="mt-12 grid max-w-3xl gap-4 xl:grid-cols-3">
            {[
              ["Records", "Transactions feed the monthly summary and AI assistant."],
              ["Planning", "Budgets and goals show where the month needs attention."],
              ["Recurring", "Fixed commitments stay visible before they affect cash flow."],
            ].map(([title, detail]) => (
              <div key={title} className="border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 border border-slate-950 bg-slate-950 p-5 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace path
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm font-semibold">Dashboard</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">Monthly income, expenses, net, and weekly pulse.</p>
              </div>
              <div className="border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm font-semibold">AI Assistant</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">Personalized guidance from real workspace data.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandLogo compact />
            </div>

            <header>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Welcome back
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("auth_login_title")}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{t("auth_login_subtitle")}</p>
            </header>

            <section className="mt-7 border border-slate-200 bg-white p-6 shadow-sm">
              <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-900">{t("auth_email")}</label>
              <input
                className="mt-2 w-full border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t("auth_email_placeholder")}
                disabled={submitting}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-900">{t("auth_password")}</label>
              <input
                className="mt-2 w-full border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t("auth_password_placeholder")}
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>

            {info ? (
              <div className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                {info}
              </div>
            ) : null}

            {error ? (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-slate-950 bg-slate-950 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t("auth_login_loading") : t("auth_login_button")}
            </button>

            <div className="flex flex-col gap-3">
              <Link
                href="/signup"
                className="w-full border border-slate-200 bg-white py-3 text-center text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                {t("auth_create_account")}
              </Link>
            </div>
          </form>
            </section>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">{t("auth_confirm_email_hint")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
