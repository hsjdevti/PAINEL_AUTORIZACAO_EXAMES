# Deploy no servidor (PM2)

Topologia: **painel na porta 3050** (acesso dos usuários) + **API interna na 3051**.
O painel encaminha `/api` para a API interna (definido por `API_PORT` em [vite.config.ts](vite.config.ts)).
Os dois processos rodam sob **PM2** (ver [ecosystem.config.cjs](ecosystem.config.cjs)).

## Pré-requisitos no servidor

- Node.js 20+ e PM2 (`npm install -g pm2`)
- Git
- **Oracle Instant Client 64-bit** instalado (modo Thick) — anote o caminho para `ORACLE_CLIENT_DIR`
- Conectividade de rede do servidor até o banco Oracle (`host:1521/service`)
- Porta **3050** liberada no firewall (entrada TCP)

## Passos

```powershell
# 1. Obter o código
git clone https://github.com/hsjdevti/PAINEL_AUTORIZACAO_EXAMES.git
cd PAINEL_AUTORIZACAO_EXAMES

# 2. Criar o .env (NÃO vai no Git) — ver modelo abaixo
#    Preencha credenciais Oracle, ORACLE_CLIENT_DIR e API_PORT=3051

# 3. Instalar dependências
npm install

# 4. Subir com PM2
pm2 start ecosystem.config.cjs
pm2 save

# 5. Liberar a porta no firewall (uma vez)
New-NetFirewallRule -DisplayName "Painel Exames 3050" -Direction Inbound -Protocol TCP -LocalPort 3050 -Action Allow -Profile Any
```

### Modelo do `.env`

```env
ORACLE_USER=usuario_oracle
ORACLE_PASSWORD=senha_oracle
ORACLE_CONNECTION_STRING=host:1521/service_name
ORACLE_CLIENT_DIR=C:\caminho\para\instantclient
API_PORT=3051
```

> `API_PORT=3051` é a porta **interna** da API. O painel (3050) encaminha `/api` para ela.
> Não altere para 3050.

## Subir no boot (Windows)

`pm2 startup` nativo é para Linux. No Windows, use a convenção do servidor (ex.: `pm2-windows-service`
ou `pm2-windows-startup`) e, após configurar, rode `pm2 save` para persistir a lista de processos.

## Acesso

```
http://10.10.0.56:3050
```

## Comandos úteis

```powershell
pm2 status                 # estado dos processos
pm2 logs painel-exames-api # logs da API
pm2 logs painel-exames-web # logs do painel
pm2 restart ecosystem.config.cjs
pm2 stop ecosystem.config.cjs
```

## Atualizações futuras

```powershell
git pull
npm install
pm2 restart ecosystem.config.cjs
```
