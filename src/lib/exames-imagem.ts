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
];

// Classificação do "Setor Agenda".
// Regras (Centro Médico tem precedência sobre Cardiológico para os tipos 30/94):
//   - Centro Médico: cd_tipo_procedimento em 30, 94
//   - Centro Cardiológico: cd_tipo_procedimento em 86, 87, 12 OU nr_seq_proc_interno em 19571, 13544
//   - CDI: qualquer outro
// Para ajustar, basta editar as listas abaixo.
const TIPO_PROC_CENTRO_MEDICO = [30, 94];
const TIPO_PROC_CENTRO_CARDIOLOGICO = [86, 87, 12];
const SEQ_PROC_CENTRO_CARDIOLOGICO = [19571, 13544];

export const AGENDA_SETOR_OPTIONS: string[] = ["CDI", "Centro Cardiológico", "Centro Médico"];

export function getSetorAgenda(
  cdTipoProcedimento: number | string | null | undefined,
  nrSeqProcInterno: number | string | null | undefined,
): string {
  const tipo = Number(cdTipoProcedimento);
  const seq = Number(nrSeqProcInterno);

  if (TIPO_PROC_CENTRO_MEDICO.includes(tipo)) return "Centro Médico";
  if (TIPO_PROC_CENTRO_CARDIOLOGICO.includes(tipo) || SEQ_PROC_CENTRO_CARDIOLOGICO.includes(seq)) {
    return "Centro Cardiológico";
  }
  return "CDI";
}

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
  cd_tipo_procedimento: number | string | null;
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
