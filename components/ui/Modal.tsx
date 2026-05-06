"use client";

import { useEffect } from "react";
import { useLanguage } from "@/app/providers/LanguageProvider";

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "md" | "xl";
}) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className={[
            "w-full rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(2,6,23,0.35)]",
            size === "xl" ? "max-w-6xl" : "max-w-lg",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-label={t("common_close")}
            >
              {t("common_close")}
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
