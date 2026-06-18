import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examesImagemSql = readFileSync(join(__dirname, "exames-imagem.sql"), "utf8");

export class ApiError extends Error {
  constructor(code, publicMessage, statusCode = 500, cause) {
    super(publicMessage);
    this.name = "ApiError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

function getOracleConfig() {
  const required = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECTION_STRING"];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new ApiError(
      "ORACLE_CONFIGURATION_ERROR",
      `Variáveis de ambiente ausentes: ${missing.join(", ")}.`,
      500,
    );
  }

  return {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONNECTION_STRING,
  };
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  return value;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), normalizeValue(value)]),
  );
}

let thickModeInitialized = false;

function enableThickMode(oracledb) {
  if (thickModeInitialized) return;

  const libDir = process.env.ORACLE_CLIENT_DIR?.trim();

  try {
    // O banco TASY usa um verificador de senha antigo (ex.: 0x939), não
    // suportado pelo modo Thin do node-oracledb. O modo Thick resolve isso,
    // mas exige o Oracle Instant Client instalado localmente.
    oracledb.initOracleClient(libDir ? { libDir } : undefined);
    thickModeInitialized = true;
  } catch (cause) {
    // Se já foi inicializado em outra chamada, apenas seguimos em frente.
    if (cause?.code === "NJS-077" || /already been initialized/i.test(cause?.message ?? "")) {
      thickModeInitialized = true;
      return;
    }

    throw new ApiError(
      "ORACLE_CLIENT_ERROR",
      "Não foi possível inicializar o Oracle Instant Client (modo Thick). " +
        "Verifique se o Instant Client está instalado e se ORACLE_CLIENT_DIR aponta para a pasta correta.",
      500,
      cause,
    );
  }
}

async function loadOracleDriver() {
  let oracledb;

  try {
    const module = await import("oracledb");
    oracledb = module.default ?? module;
  } catch (cause) {
    throw new ApiError(
      "ORACLE_DRIVER_ERROR",
      "Driver Oracle não encontrado. Execute a instalação das dependências do projeto.",
      500,
      cause,
    );
  }

  enableThickMode(oracledb);
  return oracledb;
}

export async function getExamesImagem() {
  const config = getOracleConfig();
  const oracledb = await loadOracleDriver();
  let connection;

  try {
    connection = await oracledb.getConnection(config);
    const result = await connection.execute(
      examesImagemSql,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return (result.rows ?? []).map(normalizeRow);
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;

    throw new ApiError(
      "ORACLE_CONNECTION_FAILED",
      "Falha ao conectar ou consultar o banco Oracle.",
      500,
      cause,
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error("Falha ao fechar conexão Oracle.", closeError);
      }
    }
  }
}
