export type StatusAutorizacao =
  | "AUTORIZADO"
  | "PENDENTE DE AUTORIZAÇÃO"
  | "SEM AUTORIZAÇÃO INICIADA"
  | "VALIDAR CONVÊNIO";

export const STATUS_AUTORIZACAO_OPTIONS: StatusAutorizacao[] = [
  "AUTORIZADO",
  "PENDENTE DE AUTORIZAÇÃO",
  "SEM AUTORIZAÇÃO INICIADA",
  "VALIDAR CONVÊNIO",
];

export const STATUS_AGENDAMENTO_OPTIONS: string[] = [
  "EXAME REALIZADO",
  "AGENDADO",
  "AGENDAMENTO REALIZADO",
  "AGENDAMENTO NÃO REALIZADO",
  "SEM AGENDAMENTO",
  "VALIDAR AGENDAMENTO",
];

export interface ExameImagem {
  cd_setor_atendimento: number | string | null;
  setor: string | null;
  leito: string | null;
  nr_atendimento: number | string | null;
  cd_pessoa_fisica: number | string | null;
  paciente: string | null;
  cd_convenio: number | string | null;
  ds_convenio: string | null;
  nr_prescricao: number | string | null;
  cd_procedimento: number | string | null;
  ds_procedimento: string | null;
  ds_procedimento_interno: string | null;
  nr_seq_proc_interno: number | string | null;
  cd_agenda: number | string | null;
  ds_agenda: string | null;
  status_agendamento: string | null;
  dt_prescricao: string | null;
  dt_validade_prescr: string | null;
  ie_status_agenda: string | null;
  ds_status_agenda: string | null;
  hr_inicio: string | null;
  dt_evento_exame: string | null;
  rn: number | string | null;
  possui_autorizacao: "SIM" | "NÃO" | string | null;
  nr_seq_autorizacao: number | string | null;
  status_autorizacao: StatusAutorizacao;
}

interface ExamesImagemResponse {
  data?: ExameImagem[];
  message?: string;
}

export async function fetchExamesImagem(): Promise<ExameImagem[]> {
  const response = await fetch("/api/exames-imagem", {
    headers: { Accept: "application/json" },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as ExamesImagemResponse | ExameImagem[])
    : undefined;

  if (!response.ok) {
    const message =
      body && !Array.isArray(body) && body.message
        ? body.message
        : "Não foi possível carregar os exames de imagem.";

    throw new Error(message);
  }

  if (Array.isArray(body)) return body;
  return body?.data ?? [];
}
