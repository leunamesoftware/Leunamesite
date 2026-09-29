import type { Usuario } from '../../../compartilhado/contratos.js';
import type { Config } from '../config.js';
import type { Armazenamento } from '../infra/armazenamento/tipos.js';
import type { Banco } from '../infra/banco/tipos.js';
import type { CanalAlerta } from '../modulos/alertas/canais.js';
import type { Relogio } from './tempo.js';

/** Tudo o que os módulos precisam, entregue de fora (facilita testar e trocar a hospedagem). */
export interface Dependencias {
  banco: Banco;
  armazenamento: Armazenamento;
  config: Config;
  relogio: Relogio;
  canaisAlerta: CanalAlerta[];
}

/** Variáveis disponíveis dentro das rotas depois do login. */
export type Ambiente = { Variables: { usuario: Usuario } };
