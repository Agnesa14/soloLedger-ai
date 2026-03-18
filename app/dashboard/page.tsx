"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const displayName = useMemo(() => {
    const metaName = (user?.user_metadata as any)?.name;
    return metaName || user?.email || "User";
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-gray-600">
        Loading session…
      </main>
    );
  }

  if (!user) return null; // redirecting

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome, <span className="font-medium text-gray-900">{displayName}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Email: <span className="font-medium text-gray-900">{user.email}</span>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
            >
              Go to AI page
            </button>

            <button
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}