// Configuração PM2 para deploy do Painel de Autorização de Exames.
//
// Dois processos:
//   - painel-exames-api : API Express (Oracle) numa porta interna (API_PORT=3051)
//   - painel-exames-web : painel (Vite) exposto na porta 3050 para os usuários
//
// O painel encaminha /api para a API interna (ver vite.config.ts, que usa API_PORT).
//
// Uso no servidor (dentro da pasta do projeto):
//   npm install
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup   (uma vez, para subir no boot)
//
// Pré-requisitos no servidor:
//   - Node.js 20+ e PM2 instalados
//   - Arquivo .env preenchido (Oracle + ORACLE_CLIENT_DIR + API_PORT=3051)
//   - Oracle Instant Client 64-bit (modo Thick) acessível em ORACLE_CLIENT_DIR
//   - Porta 3050 liberada no firewall do servidor

const API_PORT = "3051";
const WEB_PORT = "3050";

// Node isolado para este app (não afeta o Node do sistema usado por outras aplicações).
// Defina via variável de ambiente NODE_BIN ou edite o caminho padrão abaixo.
// Se vazio/inexistente, o PM2 usa o Node padrão do sistema.
const NODE_BIN = process.env.NODE_BIN || "C:\\hsj_dev\\node22\\node.exe";

// Modo binário: o PM2 executa o node22.exe diretamente (interpreter: "none"),
// garantindo o Node isolado independente do `interpreter` do PM2.
module.exports = {
  apps: [
    {
      name: "painel-exames-api",
      script: NODE_BIN,
      args: "server/index.js",
      interpreter: "none",
      cwd: __dirname,
      env: { API_PORT },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "painel-exames-web",
      script: NODE_BIN,
      args: `node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${WEB_PORT}`,
      interpreter: "none",
      cwd: __dirname,
      env: { API_PORT },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
