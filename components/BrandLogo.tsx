import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  textClassName?: string;
  compact?: boolean;
};

function LogoMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center border border-slate-950 bg-slate-950 text-white">
      <svg viewBox="0 0 36 36" aria-hidden="true" className="h-6 w-6">
        <path d="M9 25V11h3.5v14H9Z" fill="currentColor" opacity="0.72" />
        <path d="M16.25 25V7h3.5v18h-3.5Z" fill="currentColor" />
        <path d="M23.5 25V14h3.5v11h-3.5Z" fill="currentColor" opacity="0.72" />
        <path d="M7 28h22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
    </span>
  );
}

export function BrandLogo({ href = "/", className = "", textClassName = "", compact = false }: BrandLogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark />
      <span>
        <span className={`block text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 ${textClassName}`}>
          SoloLedger AI
        </span>
        {!compact ? <span className="mt-0.5 block text-xs text-slate-500">Personal finance workspace</span> : null}
      </span>
    </span>
  );

  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}
