"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/manager/actions";

const Pending = createContext(false);

export function ActionForm({ action, children, className, keep }: { action: (s: FormState, fd: FormData) => Promise<FormState>; children: React.ReactNode; className?: string; keep?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !keep) ref.current?.reset();
  }, [state, keep]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      <Pending value={pending}>{children}</Pending>
      {state && !pending && (
        <p role="status" className={`border px-3 py-2 text-[12px] ${state.error ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className = "btn btn-primary", busy = "Salvando..." }: { children: React.ReactNode; className?: string; busy?: string }) {
  const status = useFormStatus();
  const pending = useContext(Pending) || status.pending;
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : children}
    </button>
  );
}
