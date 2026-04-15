import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-gray-50 text-gray-600">
          Loading...
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
