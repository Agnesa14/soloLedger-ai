import { Suspense } from "react";
import { DashboardWorkspace } from "../page";

export default function DashboardAutomationPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[60vh] place-items-center text-slate-600">
          Loading recurring items...
        </main>
      }
    >
      <DashboardWorkspace view="automation" />
    </Suspense>
  );
}
