import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AGENDA_SETOR_OPTIONS,
  fetchExamesImagem,
  getSetorAgenda,
  STATUS_AGENDAMENTO_OPTIONS,
  STATUS_AUTORIZACAO_OPTIONS,
  type ExameImagem,
  type StatusAutorizacao,
} from "@/lib/exames-imagem";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Situação dos Agendamentos de Exames - Pacientes Internados" },
      {
        name: "description",
        content:
          "Painel operacional para acompanhamento em tempo real dos agendamentos de exames de pacientes internados.",
      },
    ],
  }),
  component: Painel,
});

type SortDir = "asc" | "desc";
type SortKey =
  | "nr_atendimento"
  | "paciente"
  | "setor"
  | "ds_convenio"
  | "nr_prescricao"
  | "dt_evento_exame"
  | "ds_procedimento_interno"
  | "status_agendamento"
  | "status_autorizacao";

const PAGE_SIZE = 15;

// Link do vídeo tutorial — atualizar quando o vídeo estiver publicado.
const VIDEO_TUTORIAL_URL = "#";

const COLUMNS: { key: SortKey; label: string; width?: string }[] = [
  { key: "nr_atendimento", label: "Atendimento", width: "w-[140px]" },
  { key: "paciente", label: "Paciente", width: "min-w-[240px]" },
  { key: "setor", label: "Setor", width: "w-[190px]" },
  { key: "ds_convenio", label: "Convênio", width: "w-[190px]" },
  { key: "nr_prescricao", label: "Prescrição", width: "w-[140px]" },
  { key: "dt_evento_exame", label: "Dt. Agenda", width: "w-[165px]" },
  { key: "ds_procedimento_interno", label: "Procedimento", width: "min-w-[260px]" },
  { key: "status_agendamento", label: "Status Agendamento", width: "w-[210px]" },
  { key: "status_autorizacao", label: "Autorização", width: "w-[230px]" },
];

function statusClasses(status: StatusAutorizacao) {
  switch (status) {
    case "AUTORIZADO":
      return {
        row: "hover:bg-status-authorized-bg/30",
        bar: "bg-status-authorized",
        badge: "bg-status-authorized-bg text-status-authorized ring-1 ring-status-authorized/40",
      };
    case "PENDENTE DE AUTORIZAÇÃO":
      return {
        row: "bg-status-pending-bg/25 hover:bg-status-pending-bg/45",
        bar: "bg-status-pending",
        badge: "bg-status-pending-bg text-status-pending ring-1 ring-status-pending/50",
      };
    case "SEM AUTORIZAÇÃO INICIADA":
      return {
        row: "bg-status-empty-bg/20 hover:bg-status-empty-bg/35",
        bar: "bg-status-empty",
        badge: "bg-status-empty-bg text-status-empty ring-1 ring-status-empty/45",
      };
    case "VALIDAR CONVÊNIO":
      return {
        row: "bg-status-validate-bg/25 hover:bg-status-validate-bg/45",
        bar: "bg-status-validate",
        badge: "bg-status-validate-bg text-status-validate ring-1 ring-status-validate/50",
      };
  }
}

function agendaStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "EXAME REALIZADO":
      return "bg-primary/15 text-primary ring-1 ring-primary/30";
    case "AGENDAMENTO REALIZADO":
      return "bg-status-authorized-bg text-status-authorized ring-1 ring-status-authorized/40";
    case "AGENDADO":
      return "bg-status-validate-bg text-status-validate ring-1 ring-status-validate/40";
    case "AGENDAMENTO NÃO REALIZADO":
      return "bg-status-pending-bg text-status-pending ring-1 ring-status-pending/45";
    case "SEM AGENDAMENTO":
      return "bg-status-empty-bg text-status-empty ring-1 ring-status-empty/40";
    default:
      return "bg-secondary text-secondary-foreground ring-1 ring-border";
  }
}

function valueText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function displayValue(value: string | number | null | undefined) {
  return valueText(value) || "-";
}

function normalize(value: string | number | null | undefined) {
  return valueText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseDateTime(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatDateTime(value: string | null | undefined) {
  const timestamp = parseDateTime(value);
  if (timestamp === null) return "-";

  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function Painel() {
  const [now, setNow] = useState<Date>(new Date());
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [prescrFrom, setPrescrFrom] = useState<Date | undefined>(undefined);
  const [prescrTo, setPrescrTo] = useState<Date | undefined>(undefined);
  const [fSetor, setFSetor] = useState("");
  const [fPaciente, setFPaciente] = useState("");
  const [fConvenio, setFConvenio] = useState("");
  const [fStatus, setFStatus] = useState<StatusAutorizacao | "">("");
  const [fStatusAgenda, setFStatusAgenda] = useState("");
  const [fSetorAgenda, setFSetorAgenda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dt_evento_exame");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const {
    data = [],
    dataUpdatedAt,
    error,
    isFetching,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["exames-imagem"],
    queryFn: fetchExamesImagem,
    enabled: typeof window !== "undefined",
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const setorOptions = useMemo(() => {
    return Array.from(new Set(data.map((row) => valueText(row.setor)).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
  }, [data]);

  const filtered = useMemo(() => {
    const qLower = normalize(q.trim());
    const pacienteLower = normalize(fPaciente.trim());
    const convenioLower = normalize(fConvenio.trim());
    const dayStart = dateFrom
      ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 0, 0, 0).getTime()
      : null;
    const dayEnd = dateFrom
      ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 23, 59, 59, 999).getTime()
      : null;
    const prescrStart = prescrFrom
      ? new Date(prescrFrom.getFullYear(), prescrFrom.getMonth(), prescrFrom.getDate(), 0, 0, 0).getTime()
      : null;
    const prescrEnd = prescrTo
      ? new Date(prescrTo.getFullYear(), prescrTo.getMonth(), prescrTo.getDate(), 23, 59, 59, 999).getTime()
      : null;

    return data.filter((row) => {
      if (qLower) {
        const blob = normalize(
          [
            row.nr_atendimento,
            row.paciente,
            row.setor,
            row.cd_convenio,
            row.ds_convenio,
            row.nr_prescricao,
            row.ds_procedimento_interno,
            row.status_agendamento,
            row.status_autorizacao,
          ].join(" "),
        );

        if (!blob.includes(qLower)) return false;
      }

      if (fSetor && valueText(row.setor) !== fSetor) return false;
      if (pacienteLower && !normalize(row.paciente).includes(pacienteLower)) return false;

      if (convenioLower) {
        const convenio = normalize(`${valueText(row.cd_convenio)} ${valueText(row.ds_convenio)}`);
        if (!convenio.includes(convenioLower)) return false;
      }

      if (fStatus && row.status_autorizacao !== fStatus) return false;
      if (fStatusAgenda && valueText(row.status_agendamento) !== fStatusAgenda) return false;
      if (fSetorAgenda && getSetorAgenda(row.cd_tipo_procedimento, row.nr_seq_proc_interno) !== fSetorAgenda) return false;

      if (dayStart !== null && dayEnd !== null) {
        const agendaTs = parseDateTime(row.dt_evento_exame);
        if (agendaTs === null) return false;
        if (agendaTs < dayStart || agendaTs > dayEnd) return false;
      }

      if (prescrStart !== null || prescrEnd !== null) {
        const prescrTs = parseDateTime(row.dt_prescricao);
        if (prescrTs === null) return false;
        if (prescrStart !== null && prescrTs < prescrStart) return false;
        if (prescrEnd !== null && prescrTs > prescrEnd) return false;
      }

      return true;
    });
  }, [data, q, fSetor, fPaciente, fConvenio, fStatus, fStatusAgenda, fSetorAgenda, dateFrom, prescrFrom, prescrTo]);

  const sorted = useMemo(() => {
    const rows = [...filtered];

    rows.sort((a, b) => {
      if (sortKey === "dt_evento_exame") {
        const av = parseDateTime(a.dt_evento_exame) ?? Number.POSITIVE_INFINITY;
        const bv = parseDateTime(b.dt_evento_exame) ?? Number.POSITIVE_INFINITY;
        return sortDir === "asc" ? av - bv : bv - av;
      }

      const av = valueText(a[sortKey]);
      const bv = valueText(b[sortKey]);
      const cmp = av.localeCompare(bv, "pt-BR", { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const errorMessage = error instanceof Error ? error.message : "";
  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 1000)) : null;

  useEffect(() => {
    setPage(1);
  }, [q, fSetor, fPaciente, fConvenio, fStatus, fStatusAgenda, fSetorAgenda, dateFrom, prescrFrom, prescrTo]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setQ("");
    setFSetor("");
    setFPaciente("");
    setFConvenio("");
    setFStatus("");
    setFStatusAgenda("");
    setFSetorAgenda("");
    setDateFrom(undefined);
    setPrescrFrom(undefined);
    setPrescrTo(undefined);
  }

  function exportExcel() {
    const rows = sorted.map((row) => ({
      Atendimento: displayValue(row.nr_atendimento),
      Paciente: displayValue(row.paciente),
      Setor: displayValue(row.setor),
      Leito: displayValue(row.leito),
      Convênio: displayValue(row.ds_convenio),
      "Código Convênio": displayValue(row.cd_convenio),
      Prescrição: displayValue(row.nr_prescricao),
      "Dt. Agenda": formatDateTime(row.dt_evento_exame),
      Procedimento: displayValue(row.ds_procedimento_interno || row.ds_procedimento),
      "Status Agendamento": displayValue(row.status_agendamento),
      "Possui Autorização": displayValue(row.possui_autorizacao),
      "Estágio Autorização": displayValue(row.nr_seq_autorizacao),
      "Status Autorização": row.status_autorizacao,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 34 },
      { wch: 24 },
      { wch: 12 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 42 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exames de Imagem");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    XLSX.writeFile(workbook, `exames-imagem_${stamp}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Pesquisar paciente, atendimento, convênio..."
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                href="https://docs.google.com/document/d/1rdJDkGwYpJ0jYhU3-KfcR_iOnt7azT8gay-e0X00oOs/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <FileText className="h-4 w-4" />
                Documentação
              </a>
              <a
                href={VIDEO_TUTORIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <Video className="h-4 w-4" />
                Vídeo Tutorial
              </a>
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                Atualizar
              </button>
              <button
                onClick={clearFilters}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <RotateCcw className="h-4 w-4" />
                Limpar
              </button>
              <button
                onClick={exportExcel}
                disabled={sorted.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-3 flex flex-col gap-3 rounded-md border border-status-validate/40 bg-status-validate-bg/25 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-validate" />
                <span className="min-w-0">{errorMessage}</span>
              </div>
              <button
                onClick={() => void refetch()}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-status-validate/40 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Setor
              <select
                value={fSetor}
                onChange={(event) => setFSetor(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Todos</option>
                {setorOptions.map((setor) => (
                  <option key={setor} value={setor}>
                    {setor}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Paciente
              <input
                type="text"
                value={fPaciente}
                onChange={(event) => setFPaciente(event.target.value)}
                placeholder="Nome do paciente"
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Convênio
              <input
                type="text"
                value={fConvenio}
                onChange={(event) => setFConvenio(event.target.value)}
                placeholder="Código ou descrição"
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Autorização
              <select
                value={fStatus}
                onChange={(event) => setFStatus(event.target.value as StatusAutorizacao | "")}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Todos</option>
                {STATUS_AUTORIZACAO_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dt. Agenda
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dt. Prescrição Inicial
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal",
                      !prescrFrom && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {prescrFrom ? format(prescrFrom, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={prescrFrom}
                    onSelect={setPrescrFrom}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dt. Prescrição Final
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal",
                      !prescrTo && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {prescrTo ? format(prescrTo, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={prescrTo}
                    onSelect={setPrescrTo}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Setor Agenda
              <select
                value={fSetorAgenda}
                onChange={(event) => setFSetorAgenda(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Todos</option>
                {AGENDA_SETOR_OPTIONS.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status Agendamento
              <select
                value={fStatusAgenda}
                onChange={(event) => setFStatusAgenda(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Todos</option>
                {STATUS_AGENDAMENTO_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
              {isFetching && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando
                </span>
              )}
              <span>Registros</span>
              <span className="font-mono font-semibold text-foreground">
                {filtered.length.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  {COLUMNS.map((column) => {
                    const active = sortKey === column.key;
                    const SortIcon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

                    return (
                      <th
                        key={column.key}
                        className={cn(
                          "select-none border-b border-border px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider",
                          column.width,
                        )}
                      >
                        <button
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 transition hover:text-primary"
                        >
                          {column.label}
                          <SortIcon
                            className={cn(
                              "h-3.5 w-3.5",
                              active ? "text-primary" : "text-muted-foreground/50",
                            )}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isPending && paged.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando exames de imagem
                      </span>
                    </td>
                  </tr>
                )}

                {!isPending && paged.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      Nenhum exame encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}

                {paged.map((row, index) => {
                  const cls = statusClasses(row.status_autorizacao);
                  const procedure = row.ds_procedimento_interno || row.ds_procedimento;

                  return (
                    <tr
                      key={`${displayValue(row.nr_atendimento)}-${displayValue(row.nr_prescricao)}-${displayValue(row.nr_seq_proc_interno)}-${index}`}
                      className={cn("border-b border-border/60 transition-colors", cls.row)}
                    >
                      <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-block h-6 w-1 rounded-r", cls.bar)} />
                          {displayValue(row.nr_atendimento)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{displayValue(row.paciente)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        <div>{displayValue(row.setor)}</div>
                        {row.leito && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/75">Leito {row.leito}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        <div>{displayValue(row.ds_convenio)}</div>
                        {row.cd_convenio && (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/75">
                            {row.cd_convenio}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[13px] text-muted-foreground">
                        {row.dt_prescricao && (
                          <div className="text-[11px] text-muted-foreground/75">
                            {formatDateTime(row.dt_prescricao)}
                          </div>
                        )}
                        <div className="text-foreground">{displayValue(row.nr_prescricao)}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[13px] text-foreground">
                        {formatDateTime(row.dt_evento_exame)}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">
                        <div>{displayValue(procedure)}</div>
                        {row.nr_seq_proc_interno && (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/75">
                            {row.nr_seq_proc_interno}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide",
                            agendaStatusBadge(row.status_agendamento),
                          )}
                        >
                          {displayValue(row.status_agendamento)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide",
                            cls.badge,
                          )}
                        >
                          {row.status_autorizacao}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border bg-secondary/40 px-4 py-3 text-xs">
            <div className="min-w-0 text-muted-foreground">
              Exibindo{" "}
              <span className="font-mono font-semibold text-foreground">
                {paged.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
              </span>
              {" - "}
              <span className="font-mono font-semibold text-foreground">
                {(currentPage - 1) * PAGE_SIZE + paged.length}
              </span>{" "}
              de <span className="font-mono font-semibold text-foreground">{sorted.length}</span> registros
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <PagerBtn onClick={() => setPage(1)} disabled={currentPage === 1} label="Primeira página">
                <ChevronsLeft className="h-4 w-4" />
              </PagerBtn>
              <PagerBtn
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </PagerBtn>
              <span className="px-2 font-mono font-semibold text-foreground">
                {currentPage} / {totalPages}
              </span>
              <PagerBtn
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </PagerBtn>
              <PagerBtn onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} label="Última página">
                <ChevronsRight className="h-4 w-4" />
              </PagerBtn>
            </div>
          </div>
        </section>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span>
            Atualização automática a cada 5 minutos · Data: {formatDateOnly(now)}
            {secondsAgo !== null && ` · Última carga há ${secondsAgo}s`}
          </span>
          <span className="font-mono">{now.toLocaleTimeString("pt-BR")}</span>
        </footer>
      </main>
    </div>
  );
}

function PagerBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
