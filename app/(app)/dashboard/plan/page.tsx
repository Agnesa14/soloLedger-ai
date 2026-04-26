import { Suspense } from "react";
import { DashboardWorkspace } from "../page";

export default function DashboardPlanPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[60vh] place-items-center text-slate-600">
          Loading plan...
        </main>
      }
    >
      <DashboardWorkspace view="plan" />
    </Suspense>
  );
}
