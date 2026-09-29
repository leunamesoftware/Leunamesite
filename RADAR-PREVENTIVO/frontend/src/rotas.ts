import type { GrupoSituacao } from './utilitarios/situacao';

// Endereços das telas da V1.
export const rotas = {
  abertura: '/',
  entrar: '/entrar',
  criarConta: '/criar-conta',
  radar: '/radar',
  documentos: '/documentos',
  novoItem: '/itens/novo',
  alertas: '/alertas',
  conta: '/conta',
} as const;

export const rotaItem = (id: string) => `/itens/${encodeURIComponent(id)}`;

/** Lista de documentos já filtrada por um grupo de situação (ex.: vencidos). */
export const rotaDocumentos = (grupo?: GrupoSituacao) => (grupo ? `${rotas.documentos}?situacao=${grupo}` : rotas.documentos);
