import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Banco } from '../infra/banco/tipos.js';

const PASTA_MIGRACOES = join(dirname(fileURLToPath(import.meta.url)), 'migracoes');

/**
 * Aplica, em ordem, as migrações que ainda não rodaram neste banco.
 * Migração já aplicada nunca roda de novo — mudança nova = arquivo novo numerado.
 */
export async function migrar(banco: Banco): Promise<string[]> {
  await banco.executarScript(
    'CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL);'
  );
  const aplicadas = new Set((await banco.todos<{ nome: string }>('SELECT nome FROM migracoes')).map((m) => m.nome));
  const arquivos = (await readdir(PASTA_MIGRACOES)).filter((a) => a.endsWith('.sql')).sort();
  const novas: string[] = [];
  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const sql = await readFile(join(PASTA_MIGRACOES, arquivo), 'utf8');
    await banco.transacao(async (b) => {
      await b.executarScript(sql);
      await b.executar('INSERT INTO migracoes (nome, aplicada_em) VALUES (?, ?)', [arquivo, new Date().toISOString()]);
    });
    novas.push(arquivo);
  }
  return novas;
}
