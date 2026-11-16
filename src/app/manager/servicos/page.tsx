"use client";

import { JobsPanel } from "../panels";
import { useLive } from "../shell";

export default function ServicesPage() {
  const { data, reload } = useLive();
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <h1 className="mb-4 text-2xl font-semibold">Serviços</h1>
      <JobsPanel data={data} reload={reload} />
    </div>
  );
}
