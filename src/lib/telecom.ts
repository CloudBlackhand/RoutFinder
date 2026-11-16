export type ContractStatus = "aguardando_instalacao" | "ativo" | "suspenso" | "cancelado";
export type OrderType = "nova_assinatura" | "mudanca_plano" | "cancelamento";
export type OrderStatus = "novo" | "agendado" | "concluido" | "cancelado";
export type InvoiceState = "aberta" | "vencida" | "paga" | "cancelada";
export type TicketCategory = "sem_conexao" | "lentidao" | "financeiro" | "equipamento" | "outro";
export type TicketPriority = "baixa" | "media" | "alta";
export type TicketStatus = "aberto" | "em_atendimento" | "resolvido";
export type Tech = "fibra" | "radio" | "cabo";

type Meta = { label: string; color: string };
const GRAY = "#71717a";

export const CONTRACT: Record<ContractStatus, Meta> = {
  aguardando_instalacao: { label: "Aguard. instalação", color: "#eab308" },
  ativo: { label: "Ativo", color: "#22c55e" },
  suspenso: { label: "Suspenso", color: "#f97316" },
  cancelado: { label: "Cancelado", color: GRAY },
};
export const ORDER_TYPE: Record<OrderType, string> = { nova_assinatura: "Nova assinatura", mudanca_plano: "Mudança de plano", cancelamento: "Cancelamento" };
export const ORDER: Record<OrderStatus, Meta> = {
  novo: { label: "Novo", color: "#38bdf8" },
  agendado: { label: "Agendado", color: "#eab308" },
  concluido: { label: "Concluído", color: "#22c55e" },
  cancelado: { label: "Cancelado", color: GRAY },
};
export const INVOICE: Record<InvoiceState, Meta> = {
  aberta: { label: "Em aberto", color: "#38bdf8" },
  vencida: { label: "Vencida", color: "#ef4444" },
  paga: { label: "Paga", color: "#22c55e" },
  cancelada: { label: "Cancelada", color: GRAY },
};
export const TICKET_CATEGORY: Record<TicketCategory, string> = {
  sem_conexao: "Sem conexão",
  lentidao: "Lentidão",
  financeiro: "Financeiro",
  equipamento: "Equipamento",
  outro: "Outro",
};
export const PRIORITY: Record<TicketPriority, Meta> = {
  baixa: { label: "Baixa", color: GRAY },
  media: { label: "Média", color: "#eab308" },
  alta: { label: "Alta", color: "#ef4444" },
};
export const TICKET: Record<TicketStatus, Meta> = {
  aberto: { label: "Aberto", color: "#38bdf8" },
  em_atendimento: { label: "Em atendimento", color: "#f97316" },
  resolvido: { label: "Resolvido", color: "#22c55e" },
};
export const TECH: Record<Tech, string> = { fibra: "Fibra", radio: "Rádio", cabo: "Cabo" };

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? (typeof d === "string" && d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d)).toLocaleDateString("pt-BR") : "—";
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => today().slice(0, 7);

export const invoiceState = (i: { status: "aberta" | "paga" | "cancelada"; dueDate: string }, ref = today()): InvoiceState =>
  i.status === "aberta" && i.dueDate < ref ? "vencida" : i.status;

export function dueDateFor(competence: string, dueDay: number) {
  const [y, m] = competence.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${competence}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
}
export const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const nowMs = () => Date.now();
