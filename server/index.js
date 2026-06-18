import dotenv from "dotenv";
import express from "express";

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
    const data = await getExamesImagem();

    response.json({
      data,
      count: data.length,
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
