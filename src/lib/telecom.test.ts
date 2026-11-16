import { describe, expect, it } from "vitest";
import { dueDateFor, invoiceState } from "./telecom";

describe("faturas", () => {
  it("limita o vencimento ao último dia do mês", () => {
    expect(dueDateFor("2026-02", 30)).toBe("2026-02-28");
    expect(dueDateFor("2026-03", 5)).toBe("2026-03-05");
  });
  it("marca como vencida a fatura aberta após o vencimento", () => {
    expect(invoiceState({ status: "aberta", dueDate: "2026-01-10" }, "2026-01-11")).toBe("vencida");
    expect(invoiceState({ status: "aberta", dueDate: "2026-01-10" }, "2026-01-10")).toBe("aberta");
    expect(invoiceState({ status: "paga", dueDate: "2026-01-10" }, "2026-02-01")).toBe("paga");
  });
});
