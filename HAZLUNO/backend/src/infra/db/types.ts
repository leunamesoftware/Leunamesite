/** Database port. Modules only talk to this interface, so swapping SQLite/D1 touches only the adapter. */
export type Param = string | number | null;

export interface Db {
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
  one<T>(sql: string, params?: Param[]): Promise<T | null>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  /** Runs several writes as one unit: all happen or none. */
  batch(statements: { sql: string; params?: Param[] }[]): Promise<void>;
  exec(script: string): Promise<void>;
  close(): Promise<void>;
}
