import { criarDependencias } from '../../servidor.js';
import { executarRotina } from './servico.js';

/** Roda a rotina uma vez pelo terminal: npm run rotina */
const deps = await criarDependencias();
console.log(await executarRotina(deps));
await deps.banco.fechar();
