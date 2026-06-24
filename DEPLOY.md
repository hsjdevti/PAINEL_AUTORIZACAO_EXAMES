# Deploy e Manutenção — Painel de Autorização de Exames

Runbook do ambiente de produção no servidor do hospital. **Leia antes de qualquer atualização** —
seguir estes passos evita os erros conhecidos (Node, binding do Rolldown, Oracle Client).

---

## 1. Visão geral

- **Painel (frontend)**: porta **3050** — é o que os usuários acessam.
- **API (backend Oracle)**: porta **3051** — interna; o painel encaminha `/api` para ela.
- Ambos rodam sob **PM2** (compartilhado com os demais apps do servidor), como dois processos:
  `painel-exames-api` e `painel-exames-web`.
- O frontend (Vite 8) exige **Node 20.19+**. O servidor usa Node 20.18.1 nos outros apps, então
  este painel roda num **Node 22 isolado numa pasta** — **sem alterar o Node do sistema**.

## 2. Referência rápida (caminhos e portas)

| Item | Valor |
|------|-------|
| Pasta do projeto | `C:\hsj_dev\sistemas\PAINEL_AUTORIZACAO_EXAMES` |
| Node isolado (deste app) | `C:\hsj_dev\node22\node.exe` |
| npm isolado | `C:\hsj_dev\node22\node_modules\npm\bin\npm-cli.js` |
| PM2 (home compartilhado) | `C:\ProgramData\pm2\home` |
| Oracle Instant Client | `C:\oracle\instantclient_23_0` |
| Porta do painel (usuários) | **3050** → http://10.10.0.56:3050 |
| Porta da API (interna) | **3051** |
| Processos PM2 | `painel-exames-api`, `painel-exames-web` |
| Repositório | https://github.com/hsjdevti/PAINEL_AUTORIZACAO_EXAMES |

## 3. Bloco de variáveis (rode SEMPRE primeiro)

Abra o PowerShell e cole este bloco **no início de qualquer sessão de manutenção**. Ele define os
atalhos `$NODE`, `$NPM` e `$PM2` usados nos passos seguintes:

```powershell
cd C:\hsj_dev\sistemas\PAINEL_AUTORIZACAO_EXAMES
$NODE = "C:\hsj_dev\node22\node.exe"
$NPM  = "C:\hsj_dev\node22\node_modules\npm\bin\npm-cli.js"
$prefix = (& $NODE $NPM prefix -g).Trim()
$PM2  = Join-Path $prefix "node_modules\pm2\bin\pm2"
"NODE: $NODE  |  PM2: $PM2 (existe? $(Test-Path $PM2))"
```

---

## 4. Procedimento de ATUALIZAÇÃO (passo a passo)

> Use isto sempre que houver mudanças no GitHub. Faça em horário de baixo uso, se possível.

### Passo 1 — Rodar o "Bloco de variáveis" (seção 3)

### Passo 2 — Baixar as alterações
```powershell
git pull
```

### Passo 3 — Reinstalar dependências **SOMENTE se o `package.json`/`package-lock.json` mudou**
> ⚠️ **Use sempre o Node 22 isolado.** Nunca rode `npm install` "puro" (Node do sistema) — ver Regra 1.
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
& $NODE $NPM install
# confirma o binding nativo do Vite/Rolldown:
"binding rolldown OK? " + (Test-Path "node_modules\@rolldown\binding-win32-x64-msvc")
```
Se mudou **só o SQL** (`server/exames-imagem.sql`) ou código sem novas dependências, **pule o Passo 3**.

### Passo 4 — Reiniciar os processos
```powershell
& $NODE $PM2 restart painel-exames-web painel-exames-api
& $NODE $PM2 save
```
Se você alterou o **`ecosystem.config.cjs`**, em vez do `restart` faça recriar:
```powershell
& $NODE $PM2 delete painel-exames-web painel-exames-api
& $NODE $PM2 start ecosystem.config.cjs
& $NODE $PM2 save
```

### Passo 5 — Validar
```powershell
Start-Sleep -Seconds 35   # o Vite leva ~20-30s para subir
& $NODE $PM2 list | Select-String "painel-exames"
"painel 3050: " + (try { (Invoke-WebRequest 'http://localhost:3050/' -UseBasicParsing -TimeoutSec 60).StatusCode } catch { $_.Exception.Message })
"api 3051:    " + (try { (Invoke-WebRequest 'http://localhost:3051/api/exames-imagem' -UseBasicParsing -TimeoutSec 120).StatusCode } catch { $_.Exception.Message })
```
Esperado: ambos os processos `online` e os dois testes retornando **200**.

---

## 5. ⚠️ Regras de ouro (o que NUNCA fazer)

1. **Nunca rode `npm install` com o Node do sistema (20.18.1)** neste projeto.
   Ele remove o binding `@rolldown/binding-win32-x64-msvc` e o painel para de subir.
   **Sempre** use `& $NODE $NPM install` (Node 22 isolado).

2. **Nunca use `pm2 delete all`, `pm2 kill` ou `pm2 save` logo após um delete em massa.**
   O PM2 é **compartilhado** com ~28 outros apps do hospital. Mexa **apenas** nos nossos processos
   **pelo nome** (`painel-exames-web`, `painel-exames-api`).

3. **Não troque o Node do sistema** para resolver problemas deste app. Tudo aqui usa o Node 22 da
   pasta isolada `C:\hsj_dev\node22` — os outros apps continuam no Node 20.18.1.

4. **Não chame `pm2` direto** (o `pm2` do PATH neste servidor está quebrado e responde vazio).
   Sempre invoque via `& $NODE $PM2 ...`.

5. **Não comite o `.env`** (contém a senha do Oracle). Ele já está no `.gitignore`.

---

## 6. Solução de problemas (erros conhecidos → correção)

| Sintoma / erro no log | Causa | Correção |
|------------------------|-------|----------|
| `Vite requires Node.js version 20.19+` | PM2 rodando o painel com o Node do sistema | Garantir `ecosystem.config.cjs` em modo binário (`script = node22.exe`, `interpreter: "none"`) e recriar o processo (delete + start) |
| `Cannot find module '@rolldown/binding-win32-x64-msvc'` | `npm install` rodado com o Node errado | Passo 3 (reinstalar limpo com `$NODE $NPM install`) |
| `DPI-1047: Cannot locate a 64-bit Oracle Client` | `ORACLE_CLIENT_DIR` errado/vazio no `.env` | Apontar para `C:\oracle\instantclient_23_0` (ver seção 7) |
| Comandos `pm2 ...` retornam vazio | O `pm2` do PATH está quebrado | Usar `& $NODE $PM2 ...` (caminho completo) |
| Painel responde `502` na 1ª requisição | API ainda aquecendo a 1ª consulta | Aguardar ~10s e repetir |
| Painel não sobe na 3050 / porta não escuta | Processo `painel-exames-web` em erro | `& $NODE $PM2 logs painel-exames-web --lines 30 --nostream` e tratar conforme as linhas acima |

### Diagnóstico rápido (cole para investigar)
```powershell
# (rode antes o Bloco de variáveis da seção 3)
"=== status ==="
& $NODE $PM2 list | Select-String "painel-exames"
"=== logs WEB ==="
& $NODE $PM2 logs painel-exames-web --lines 25 --nostream
"=== logs API ==="
& $NODE $PM2 logs painel-exames-api --lines 15 --nostream
```

## 7. Arquivo `.env` (no servidor, não vai pelo Git)

Caminho: `C:\hsj_dev\sistemas\PAINEL_AUTORIZACAO_EXAMES\.env`

```env
ORACLE_USER=usuario_oracle
ORACLE_PASSWORD=senha_oracle
ORACLE_CONNECTION_STRING=hsj-oda-db.hospital.local:1521/TASY.hospital.local
ORACLE_CLIENT_DIR=C:\oracle\instantclient_23_0
API_PORT=3051
```

Para corrigir só o `ORACLE_CLIENT_DIR` sem reabrir o arquivo:
```powershell
$envPath = ".\.env"
$lines = Get-Content $envPath | Where-Object { $_ -notmatch '^ORACLE_CLIENT_DIR=' }
$lines += 'ORACLE_CLIENT_DIR=C:\oracle\instantclient_23_0'
$lines | Set-Content $envPath -Encoding UTF8
```

## 8. Comandos PM2 úteis (sempre via `$PM2`)

```powershell
& $NODE $PM2 list                                   # estado de todos os processos
& $NODE $PM2 list | Select-String "painel-exames"   # só os nossos
& $NODE $PM2 logs painel-exames-web --lines 30 --nostream
& $NODE $PM2 logs painel-exames-api --lines 30 --nostream
& $NODE $PM2 restart painel-exames-web painel-exames-api
& $NODE $PM2 stop painel-exames-web                 # parar só o painel
& $NODE $PM2 describe painel-exames-web             # ver script/args/interpreter
& $NODE $PM2 save                                   # persistir a lista (para o boot)
```

## 9. Boot (subir após reinício do servidor)

O `pm2 save` grava a lista (incluindo nossos 2 processos, já com o Node 22 e o Oracle Client) em
`C:\ProgramData\pm2\home\dump.pm2`. Como os demais apps do hospital sobem sozinhos no boot, o
mecanismo de `pm2 resurrect` existente **também restaura este painel** — desde que o `pm2 save`
tenha sido executado após a última alteração. **Sempre rode `& $NODE $PM2 save` ao final de uma
atualização.**

## 10. Primeira instalação (referência)

Caso precise instalar do zero em outro servidor:
1. Instalar o Node 22 **portátil** numa pasta isolada (ex.: `C:\hsj_dev\node22`).
2. Garantir o Oracle Instant Client 64-bit e anotar o caminho para `ORACLE_CLIENT_DIR`.
3. `git clone` do repositório; criar o `.env` (seção 7).
4. Instalar deps com o Node isolado: `& $NODE $NPM install`.
5. Subir no PM2: `& $NODE $PM2 start ecosystem.config.cjs` e `& $NODE $PM2 save`.
6. Liberar a porta 3050 no firewall:
   `New-NetFirewallRule -DisplayName "Painel Exames 3050" -Direction Inbound -Protocol TCP -LocalPort 3050 -Action Allow -Profile Any`
