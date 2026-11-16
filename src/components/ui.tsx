export function Status({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-wide" style={{ color }}>
      <span className="h-2 w-2 shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2 font-mono text-[13px] font-semibold tracking-[0.2em]">
      <span className="grid h-4 w-4 grid-cols-2 gap-px">
        <span className="bg-fg" />
        <span className="bg-fg/40" />
        <span className="bg-fg/40" />
        <span className="bg-fg" />
      </span>
      FINDER
    </span>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div>
        <div className="label">{kicker}</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
