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

export type Source = "indicacao" | "site" | "redes_sociais" | "porta_a_porta" | "loja" | "telefone" | "outro";
export type ContactChannel = "telefone" | "whatsapp" | "email" | "presencial" | "visita";
export type ContactReason = "venda" | "suporte" | "cobranca" | "retencao" | "cadastro" | "outro";

export const SOURCE: Record<Source, string> = {
  indicacao: "Indicação",
  site: "Site",
  redes_sociais: "Redes sociais",
  porta_a_porta: "Porta a porta",
  loja: "Loja",
  telefone: "Telefone",
  outro: "Outro",
};
export const CONTACT_CHANNEL: Record<ContactChannel, string> = { telefone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", presencial: "Presencial", visita: "Visita" };
export const CONTACT_REASON: Record<ContactReason, Meta> = {
  venda: { label: "Venda", color: "#22c55e" },
  suporte: { label: "Suporte", color: "#38bdf8" },
  cobranca: { label: "Cobrança", color: "#ef4444" },
  retencao: { label: "Retenção", color: "#f97316" },
  cadastro: { label: "Cadastro", color: "#a1a1aa" },
  outro: { label: "Outro", color: GRAY },
};
export const PERSON = { pf: "Pessoa física", pj: "Pessoa jurídica" } as const;

export const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
export const waLink = (phone: string | null | undefined) => {
  const d = digits(phone);
  return d.length >= 10 ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : null;
};

type Addr = { street?: string | null; number?: string | null; complement?: string | null; neighborhood?: string | null; city?: string | null; uf?: string | null };
export function composeAddress(a: Addr) {
  const line = [a.street, a.number].filter(Boolean).join(", ") + (a.complement ? ` - ${a.complement}` : "");
  const place = [a.neighborhood, [a.city, a.uf].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  return [line, place].filter(Boolean).join(" · ");
}

export function tenure(since: Date | string, now = nowMs()) {
  const months = Math.floor((now - +new Date(since)) / (30.44 * 86_400_000));
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const y = Math.floor(months / 12);
  return `${y} ${y === 1 ? "ano" : "anos"}${months % 12 ? ` e ${months % 12} m` : ""}`;
}
