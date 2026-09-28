/**
 * server/ocultas.js
 * Linhas que o coordenador apagou no HSJ Performance.
 *
 * POR QUE ISTO EXISTE
 * Este painel (porta 3050) é o operacional: só lê. Quem decide que uma
 * solicitação não é mais pendência é o coordenador, no portal Performance, onde
 * existe login, permissão e registro de quem fez. Aqui a linha apenas some
 * junto, para os dois painéis mostrarem a mesma fila.
 *
 * O Tasy não permite suspender uma solicitação de exame — por isso a "exclusão"
 * vive fora dele. Nada é escrito no Tasy nem aqui: o que muda é o que a API
 * devolve.
 *
 * ONDE ESTÁ A LISTA
 * Num arquivo JSON gravado pela hsj-performance-api, que roda no mesmo servidor.
 * O caminho vem de EXAMES_OCULTOS_FILE; o padrão é o caminho de produção.
 *
 * SE O ARQUIVO SUMIR OU ESTIVER ILEGÍVEL, o painel mostra TUDO. Falhar
 * mostrando a mais é melhor do que esconder a fila inteira por causa de um
 * arquivo — ninguém perde informação, no pior caso reaparece uma linha que o
 * coordenador já tinha apagado.
 */
import { readFile, stat } from "node:fs/promises";

const ARQUIVO =
  process.env.EXAMES_OCULTOS_FILE ||
  "C:\\hsj_dev\\apis\\hsj-performance-api\\dados\\exames-ocultos.json";

/** Chave da linha: a mesma do ROW_NUMBER de exames-imagem.sql. */
const chaveDaLinha = (prescricao, sequencia) => `${Number(prescricao)}|${Number(sequencia)}`;

// Relê só quando o arquivo muda (mtime), para não abrir arquivo a cada request.
let cache = { mtimeMs: -1, chaves: new Set() };

async function chavesOcultas() {
  let info;
  try {
    info = await stat(ARQUIVO);
  } catch {
    // Ainda não existe: nada foi apagado no Performance.
    cache = { mtimeMs: -1, chaves: new Set() };
    return cache.chaves;
  }

  if (info.mtimeMs === cache.mtimeMs) return cache.chaves;

  try {
    // O Performance grava com arquivo temporário + rename (atômico), então aqui
    // nunca se lê um JSON pela metade.
    const lista = JSON.parse(await readFile(ARQUIVO, "utf-8"));
    const chaves = new Set(
      (Array.isArray(lista) ? lista : [])
        // Linha devolvida ao painel volta a aparecer.
        .filter((registro) => registro && !registro.restauradoEm)
        .map((registro) => chaveDaLinha(registro.nrPrescricao, registro.nrSeqProcInterno)),
    );
    cache = { mtimeMs: info.mtimeMs, chaves };
    return chaves;
  } catch (error) {
    console.warn(`[ocultas] arquivo ilegivel (${error.message}); exibindo tudo.`);
    return new Set();
  }
}

/**
 * Tira da lista o que foi apagado no Performance.
 * Devolve { linhas, removidas } — `removidas` só serve para o log.
 */
export async function filtrarOcultas(linhas) {
  const chaves = await chavesOcultas();
  if (chaves.size === 0) return { linhas, removidas: 0 };

  const visiveis = linhas.filter(
    (linha) => !chaves.has(chaveDaLinha(linha.nr_prescricao, linha.nr_seq_proc_interno)),
  );
  return { linhas: visiveis, removidas: linhas.length - visiveis.length };
}
