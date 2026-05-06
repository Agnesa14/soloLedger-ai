"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";
import { useLanguage } from "../providers/LanguageProvider";
import { getErrorMessage } from "@/lib/errors";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupPage() {
  const router = useRouter();
  const { user, loading, signUp } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError(t("auth_name_short"));
      return;
    }
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
      await signUp({ email: normalizedEmail, password, name: trimmedName });

      setInfo(t("auth_account_created"));
      setTimeout(() => router.push("/login?checkEmail=1"), 800);
    } catch (signUpError) {
      setError(getErrorMessage(signUpError, t("auth_signup_failed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] text-slate-950">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="hidden border-r border-slate-200 bg-white px-8 py-10 lg:block">
          <BrandLogo />

          <div className="mt-16 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Create your finance workspace
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
              Start with the basics, then let the workspace turn records into decisions.
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-600">
              Add a first income, a few expenses, one budget, and one savings goal. SoloLedger AI uses that structure
              to surface useful financial signals from day one.
            </p>
          </div>

          <div className="mt-12 grid max-w-3xl gap-4">
            {[
              ["1", "Track", "Record income and expenses in EUR with category-level clarity."],
              ["2", "Plan", "Set spending guardrails and goal targets for the current month."],
              ["3", "Ask", "Use the AI assistant to turn financial context into practical next steps."],
            ].map(([step, title, detail]) => (
              <div key={step} className="flex gap-4 border border-slate-200 bg-slate-50 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center bg-slate-950 text-sm font-semibold text-white">
                  {step}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandLogo compact />
            </div>

            <header>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                New workspace
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("auth_signup_title")}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{t("auth_signup_subtitle")}</p>
            </header>

            <form onSubmit={onSubmit} className="mt-7 space-y-4 border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium text-slate-900">{t("auth_name")}</label>
            <input
              className="mt-2 w-full border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder={t("auth_name_placeholder")}
              disabled={submitting}
              autoComplete="name"
            />
          </div>

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
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              {info}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-slate-950 bg-slate-950 py-3 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
          >
            {submitting ? t("auth_signup_loading") : t("auth_signup_button")}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full border border-slate-200 bg-white py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            disabled={submitting}
          >
            {t("auth_back_to_login")}
          </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Your workspace becomes useful after the first income, expense, budget, and goal.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
