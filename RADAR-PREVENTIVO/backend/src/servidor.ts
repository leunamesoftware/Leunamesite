import { serve } from '@hono/node-server';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { criarApp } from './app.js';
import type { Dependencias } from './comum/ambiente.js';
import { relogioDoSistema } from './comum/tempo.js';
import { carregarConfig } from './config.js';
import { migrar } from './banco/migrar.js';
import { criarArmazenamentoDiscoLocal } from './infra/armazenamento/disco-local.js';
import { criarBancoSqlite } from './infra/banco/sqlite.js';
import { canalApp } from './modulos/alertas/canais.js';
import { iniciarAgendador } from './modulos/rotina/agendador.js';

/** Monta as dependências para rodar em um servidor Node (desenvolvimento ou servidor próprio). */
export async function criarDependencias(): Promise<Dependencias> {
  const config = carregarConfig();
  await mkdir(dirname(config.caminhoBanco), { recursive: true });
  const banco = criarBancoSqlite(config.caminhoBanco);
  await migrar(banco);
  return {
    banco,
    armazenamento: criarArmazenamentoDiscoLocal(config.pastaAnexos),
    config,
    relogio: relogioDoSistema,
    canaisAlerta: [canalApp],
  };
}

const executadoDireto = import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  const deps = await criarDependencias();
  serve({ fetch: criarApp(deps).fetch, port: deps.config.porta }, (info) => {
    console.log(`Radar Preventivo API rodando em http://localhost:${info.port}`);
  });
  iniciarAgendador(deps);
}
