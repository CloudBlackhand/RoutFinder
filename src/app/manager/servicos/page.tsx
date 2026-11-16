"use client";

import { PageHead } from "@/components/ui";
import { JobsPanel } from "../panels";
import { useLive } from "../shell";

export default function ServicesPage() {
  const { data, reload } = useLive();
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      <PageHead kicker="Cadastro e atribuição" title="Serviços" />
      <JobsPanel data={data} reload={reload} />
    </div>
  );
}
