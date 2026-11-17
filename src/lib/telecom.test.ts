import { describe, expect, it } from "vitest";
import { composeAddress, dueDateFor, invoiceState, waLink } from "./telecom";

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


describe("cadastro", () => {
  it("monta o endereço a partir dos campos", () => {
    expect(composeAddress({ street: "Rua A", number: "10", complement: "ap 2", neighborhood: "Centro", city: "São Paulo", uf: "SP" })).toBe("Rua A, 10 - ap 2 · Centro, São Paulo - SP");
  });
  it("gera link de WhatsApp com DDI", () => {
    expect(waLink("(11) 99999-1000")).toBe("https://wa.me/5511999991000");
    expect(waLink("123")).toBeNull();
  });
});
