import Link from "next/link";
import { Submit } from "./forms";

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

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">{children}</div>;
}

export function Panel({ title, meta, children, className = "" }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <span className="label">{title}</span>
        {meta && <span className="text-[11px] text-mute">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Kpi({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="p-4">
      <div className="label">{label}</div>
      <div className="num mt-2 text-[26px] font-medium leading-none tracking-tight">{value}</div>
      {hint && <div className={`mt-2 text-xs ${warn ? "text-amber-400" : "text-dim"}`}>{hint}</div>}
    </div>
  );
}

export function KpiStrip({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  const c = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[cols];
  return <section className={`panel grid grid-cols-2 divide-line max-lg:divide-y lg:divide-x ${c}`}>{children}</section>;
}

export function Act({ action, fields, children, className = "btn btn-sm" }: { action: (fd: FormData) => Promise<void>; fields: Record<string, string | number>; children: React.ReactNode; className?: string }) {
  return (
    <form action={action} className="inline-flex">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Submit className={className}>{children}</Submit>
    </form>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <div className="flex border-b border-line">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-[13px] ${t.href === active ? "border-fg text-fg" : "border-transparent text-mute hover:text-fg"}`}>
          {t.label}
          {t.count != null && <span className="num text-[11px] text-dim">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <tr>
    <td colSpan={cols} className="py-8 text-center text-mute">
      {text}
    </td>
  </tr>
);
