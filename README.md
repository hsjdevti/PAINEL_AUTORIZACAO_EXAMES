# Patient Exam Flow

Painel de exames de imagem para pacientes internados, com frontend React/TanStack Start e backend Node.js/Express conectado ao Oracle.

## Estrutura identificada

- Frontend: React 19 + TypeScript + Vite + TanStack Start/TanStack Router.
- UI: Tailwind CSS 4, componentes shadcn/Radix e lucide-react.
- Backend adicionado: Express em `server/index.js`.
- Driver Oracle: `oracledb`.

## Pré-requisitos

- Node.js 20 ou superior.
- Acesso de rede ao banco Oracle.
- Usuário Oracle com permissão para executar a consulta e acessar objetos/funções do schema `tasy`.

## Instalação

```bash
npm install
```

Se preferir Bun:

```bash
bun install
```

## Configuração do Oracle

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Preencha:

```env
ORACLE_USER=usuario_oracle
ORACLE_PASSWORD=senha_oracle
ORACLE_CONNECTION_STRING=host:1521/service_name
# Opcional: caminho do Oracle Instant Client / Client (modo Thick).
ORACLE_CLIENT_DIR=
API_PORT=3001
```

Também é possível usar o formato TNS no `ORACLE_CONNECTION_STRING`, conforme a configuração do ambiente Oracle.

### Modo Thick (Oracle Instant Client)

O banco TASY usa um verificador de senha antigo, **não suportado pelo modo Thin** (padrão do `node-oracledb`). Sem o cliente Oracle, a API falha com:

```
NJS-116: password verifier type 0x939 is not supported by node-oracledb in Thin mode
```

Para resolver, informe em `ORACLE_CLIENT_DIR` o caminho de uma instalação do Oracle Client/Instant Client 64-bit, habilitando o **modo Thick**. Exemplos de caminhos comuns nesta máquina:

```env
ORACLE_CLIENT_DIR=C:\Program Files\Oracle Client for Microsoft Tools
# ou um Instant Client baixado, por exemplo:
# ORACLE_CLIENT_DIR=C:\oracle\instantclient_23_0
```

Se `ORACLE_CLIENT_DIR` ficar vazio, o driver tenta localizar o cliente pelo `PATH`. Caso nenhum cliente seja encontrado, a API retorna `ORACLE_CLIENT_ERROR` (`DPI-1047`).

## Execução em desenvolvimento

Terminal 1, API:

```bash
npm run dev:api
```

Terminal 2, frontend:

```bash
npm run dev
```

O Vite encaminha chamadas de `/api` para `http://localhost:3001`.

No Windows, use os scripts prontos para rodar pelo PowerShell (um em cada terminal):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-api.ps1
powershell -ExecutionPolicy Bypass -File scripts/run-web.ps1
```

> **Importante (Windows):** suba o frontend **sempre** pelo `scripts/run-web.ps1`. Iniciar o `vite dev` manualmente (fora do script) faz o servidor responder `404 Cannot GET /`, pois o script configura o ambiente esperado pelo Vite/TanStack Start. Os scripts também localizam o Node automaticamente (PATH ou runtime embutido) e gravam logs em `logs/`.

## Endpoint

```http
GET /api/exames-imagem
```

Resposta de sucesso:

```json
{
  "data": [],
  "count": 0,
  "generatedAt": "2026-06-17T18:00:00.000Z"
}
```

Em falha de configuração, driver ou conexão Oracle, a API retorna HTTP 500 com JSON:

```json
{
  "error": "ORACLE_CONNECTION_FAILED",
  "message": "Falha ao conectar ou consultar o banco Oracle."
}
```

O frontend exibe essa falha no painel e permite tentar novamente.

## Funcionalidades do painel

- Consumo real da API `/api/exames-imagem`.
- Tabela com atendimento, paciente, setor, convênio, prescrição, agenda, data, procedimento e status.
- Filtros por setor, paciente, convênio e status de autorização.
- Filtro adicional por intervalo de data da agenda.
- Destaque visual para:
  - `AUTORIZADO`
  - `PENDENTE DE AUTORIZAÇÃO`
  - `SEM AUTORIZAÇÃO INICIADA`
  - `VALIDAR CONVÊNIO`
- Atualização automática a cada 5 minutos.
- Exportação para Excel dos dados filtrados.

## Build do frontend

```bash
npm run build
```

Para pré-visualizar o build:

```bash
npm run preview
```

Em produção, mantenha a API Node.js disponível e publique o frontend atrás de um proxy/reverse proxy que encaminhe `/api` para a porta configurada em `API_PORT`.
