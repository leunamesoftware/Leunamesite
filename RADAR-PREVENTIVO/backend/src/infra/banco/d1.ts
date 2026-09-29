import type { Banco, Parametro } from './tipos.js';

/** O mínimo da API do Cloudflare D1 que o Radar usa. */
export interface D1Database {
  prepare(sql: string): D1Consulta;
  batch(consultas: D1Consulta[]): Promise<unknown[]>;
}
interface D1Consulta {
  bind(...valores: Parametro[]): D1Consulta;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number } }>;
}

/**
 * Banco na Cloudflare D1 (SQLite gerenciado). Mesmo SQL do SQLite local.
 * O D1 não tem transação interativa (ler e decidir no meio); por isso `transacao`
 * roda as operações em sequência. As regras que evitam duplicidade continuam no
 * próprio banco (chaves únicas), então repetir uma operação não gera dado repetido.
 */
export function criarBancoD1(d1: D1Database): Banco {
  const preparar = (sql: string, parametros: Parametro[] = []) => d1.prepare(sql).bind(...parametros);
  const banco: Banco = {
    async todos<T>(sql: string, parametros?: Parametro[]) {
      return (await preparar(sql, parametros).all<T>()).results;
    },
    async um<T>(sql: string, parametros?: Parametro[]) {
      return (await preparar(sql, parametros).first<T>()) ?? null;
    },
    async executar(sql, parametros) {
      const r = await preparar(sql, parametros).run();
      return { alteradas: r.meta.changes ?? 0 };
    },
    async transacao(operacoes) {
      return operacoes(banco);
    },
    async executarScript(sql) {
      const comandos = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((c) => c.replace(/--.*$/gm, '').trim())
        .filter(Boolean);
      if (comandos.length) await d1.batch(comandos.map((c) => d1.prepare(c)));
    },
    async fechar() {},
  };
  return banco;
}
