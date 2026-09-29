import { describe, expect, it } from 'vitest';
import type { Analise } from '../../compartilhado/contratos.js';
import { AVISO_ORIENTACAO, gerarOrientacao } from '../src/modulos/orientacao/gerador.js';

const analise = (situacao: Analise['situacao'], diasRestantes: number | null): Analise =>
  ({ situacao, diasRestantes, pendencias: [], analisadoEm: '2026-10-01T09:00:00Z', versaoRegras: 'v1.0' });
const base = { natureza: 'documento' as const, titulo: 'CNH', dataVencimento: '2026-10-06', antecedenciaDias: null, estado: 'ativo' as const, resolvidoEm: null };

describe('orientação gerada pelo sistema', () => {
  it('documento urgente: resumo com dias e data, prioridade alta, passos de renovação', () => {
    const o = gerarOrientacao(base, analise('urgente', 5));
    expect(o.resumo).toBe('"CNH" vence em 5 dias (06/10/2026). É urgente.');
    expect(o.prioridade).toBe('alta');
    expect(o.passos.join(' ')).toMatch(/renovação/);
    expect(o.aviso).toBe(AVISO_ORIENTACAO);
  });
  it('prazo vencido fala em regularizar e marcar como resolvido', () => {
    const o = gerarOrientacao({ ...base, natureza: 'prazo', titulo: 'IPTU', dataVencimento: '2026-09-21' }, analise('vencido', -10));
    expect(o.resumo).toBe('"IPTU" venceu há 10 dias (21/09/2026).');
    expect(o.prioridade).toBe('critica');
    expect(o.passos.at(-1)).toMatch(/marque o item como resolvido/);
  });
  it('sem data orienta a informar a data', () => {
    const o = gerarOrientacao({ ...base, dataVencimento: null }, { ...analise('sem_prazo', null), pendencias: ['sem_data_vencimento'] });
    expect(o.prioridade).toBe('pendente');
    expect(o.passos.join(' ')).toMatch(/informe a data de vencimento/);
  });
  it('singular: 1 dia', () => {
    expect(gerarOrientacao(base, analise('urgente', 1)).resumo).toContain('1 dia (');
  });
  it('item resolvido: nenhuma ação e histórico guardado', () => {
    const o = gerarOrientacao({ ...base, estado: 'resolvido', resolvidoEm: '2026-10-02T12:00:00Z' }, analise('urgente', 4));
    expect(o.resumo).toBe('"CNH" foi resolvido em 02/10/2026.');
    expect(o.passos[0]).toMatch(/histórico/);
  });
});
