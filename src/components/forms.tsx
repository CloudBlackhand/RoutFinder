"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/manager/actions";

export function ActionForm({ action, children, className }: { action: (s: FormState, fd: FormData) => Promise<FormState>; children: React.ReactNode; className?: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      {children}
      {state && <p className={`text-[12px] ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = "btn btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "..." : children}
    </button>
  );
}
