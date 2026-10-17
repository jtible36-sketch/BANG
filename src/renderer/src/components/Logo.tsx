export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true" focusable="false" className="shrink-0" data-logo="naraflow">
      <rect width="88" height="88" rx="24" fill="#191d26" />
      <path
        d="M21 64 V27 Q21 14 32 26 L56 61 Q66 75 67 56 V22"
        fill="none"
        stroke="#f6af78"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-ink" data-brand="naraflow">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[21px] font-bold tracking-[-0.01em]">Naraflow</span>
        <span className="mt-[3px] text-[10.5px] font-medium text-muted">Narasi yang bergerak.</span>
      </span>
    </span>
  )
}
