import { carregarConfig } from '../config.js';
import { criarBancoSqlite } from '../infra/banco/sqlite.js';
import { migrar } from './migrar.js';

const config = carregarConfig();
const banco = criarBancoSqlite(config.caminhoBanco);
const novas = await migrar(banco);
console.log(novas.length ? `Migrações aplicadas: ${novas.join(', ')}` : 'Banco já está atualizado.');
await banco.fechar();
