"use client";

import { PageHead } from "@/components/ui";
import { TeamPanel } from "../panels";
import { useLive } from "../shell";

export default function TeamPage() {
  const { reload } = useLive();
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      <PageHead kicker="Acessos e situação" title="Equipe" />
      <TeamPanel reload={reload} />
    </div>
  );
}
