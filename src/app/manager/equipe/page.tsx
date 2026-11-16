"use client";

import { TeamPanel } from "../panels";
import { useLive } from "../shell";

export default function TeamPage() {
  const { reload } = useLive();
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <h1 className="mb-4 text-2xl font-semibold">Equipe</h1>
      <TeamPanel reload={reload} />
    </div>
  );
}
