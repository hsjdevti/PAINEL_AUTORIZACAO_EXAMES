import dotenv from "dotenv";
import express from "express";

import { filtrarOcultas } from "./ocultas.js";
import { ApiError, getExamesImagem } from "./oracle.js";

dotenv.config();

const app = express();
const configuredPort = Number.parseInt(process.env.API_PORT || process.env.PORT || "3001", 10);
const port = Number.isFinite(configuredPort) ? configuredPort : 3001;

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "patient-exam-flow-api" });
});

app.get("/api/exames-imagem", async (_request, response) => {
  try {
    // Este painel e o operacional: so le. O que o coordenador apagou no HSJ
    // Performance some daqui tambem, para os dois mostrarem a mesma fila.
    const { linhas: data, removidas } = await filtrarOcultas(await getExamesImagem());
    if (removidas > 0) {
      console.log(`[ocultas] ${removidas} linha(s) apagadas no Performance nao foram exibidas`);
    }

    response.json({
      data,
      count: data.length,
      ocultas: removidas,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(
            "ORACLE_CONNECTION_FAILED",
            "Falha inesperada ao consultar o banco Oracle.",
            500,
            error,
          );

    console.error(apiError.code, apiError.cause ?? apiError);

    response.status(apiError.statusCode).json({
      error: apiError.code,
      message: apiError.publicMessage,
    });
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "NOT_FOUND", message: "Endpoint não encontrado." });
});

app.listen(port, () => {
  console.log(`API de exames de imagem disponível em http://localhost:${port}`);
});
