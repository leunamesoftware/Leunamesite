/**
 * Porta de acesso ao banco. O resto do sistema só conversa com esta interface,
 * então trocar o banco (quando a hospedagem for escolhida) é trocar só o adaptador.
 */
export type Parametro = string | number | null;

export interface Banco {
  todos<T>(sql: string, parametros?: Parametro[]): Promise<T[]>;
  um<T>(sql: string, parametros?: Parametro[]): Promise<T | null>;
  executar(sql: string, parametros?: Parametro[]): Promise<{ alteradas: number }>;
  /** Roda várias operações de uma vez: ou todas acontecem, ou nenhuma. */
  transacao<T>(operacoes: (banco: Banco) => Promise<T>): Promise<T>;
  /** Executa um script SQL inteiro (usado pelas migrações). */
  executarScript(sql: string): Promise<void>;
  fechar(): Promise<void>;
}
