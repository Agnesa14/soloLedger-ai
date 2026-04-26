"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-md px-4 py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t("auth_login_title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("auth_login_subtitle")}</p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-900">{t("auth_email")}</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(15,23,42,0.08)]"
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
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(15,23,42,0.08)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t("auth_password_placeholder")}
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>

            {info ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                {info}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t("auth_login_loading") : t("auth_login_button")}
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                {t("auth_create_account")}
              </Link>

              <Link
                href="/"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                {t("auth_back_to_app")}
              </Link>
            </div>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          {t("auth_confirm_email_hint")}
        </p>
      </div>
    </main>
  );
}
