"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{t("auth_signup_title")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("auth_signup_subtitle")}</p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="text-sm font-medium text-gray-900">{t("auth_name")}</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder={t("auth_name_placeholder")}
              disabled={submitting}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">{t("auth_email")}</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t("auth_email_placeholder")}
              disabled={submitting}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">{t("auth_password")}</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={t("auth_password_placeholder")}
              disabled={submitting}
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              {info}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? t("auth_signup_loading") : t("auth_signup_button")}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-900"
            disabled={submitting}
          >
            {t("auth_back_to_login")}
          </button>
        </form>
      </div>
    </main>
  );
}
