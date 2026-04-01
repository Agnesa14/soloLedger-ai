import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center bg-gray-50 text-gray-600">
          Loading…
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}