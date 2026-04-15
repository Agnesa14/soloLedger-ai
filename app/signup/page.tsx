"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { getErrorMessage } from "@/lib/errors";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupPage() {
  const router = useRouter();
  const { user, loading, signUp } = useAuth();

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
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp({ email: normalizedEmail, password, name: trimmedName });

      setInfo("Account created. Please confirm your email before logging in.");
      setTimeout(() => router.push("/login?checkEmail=1"), 800);
    } catch (signUpError) {
      setError(getErrorMessage(signUpError, "Signup failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Sign Up</h1>
        <p className="mt-2 text-sm text-gray-600">Create an account to use the app.</p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="text-sm font-medium text-gray-900">Name</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="Your name"
              disabled={submitting}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">Email</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              disabled={submitting}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">Password</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-4 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="min 6 characters"
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
            {submitting ? "Creating..." : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-900"
            disabled={submitting}
          >
            Back to login
          </button>
        </form>
      </div>
    </main>
  );
}
