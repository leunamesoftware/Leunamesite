import { describe, expect, it } from 'vitest';
import { analisar } from '../src/modulos/analise/motor.js';

const hoje = '2026-10-01';
const venc = (dataVencimento: string | null, antecedenciaDias: number | null = null) => analisar({ dataVencimento, antecedenciaDias }, hoje);

describe('motor de análise (faixas aprovadas: atenção 30 dias, urgente 7 dias)', () => {
  it('sem data de vencimento é "sem prazo" com pendência', () => {
    expect(venc(null)).toEqual({ situacao: 'sem_prazo', diasRestantes: null, pendencias: ['sem_data_vencimento'] });
  });
  it('limites exatos', () => {
    expect(venc('2026-11-01').situacao).toBe('em_dia');      // 31 dias
    expect(venc('2026-10-31').situacao).toBe('atencao');     // 30 dias
    expect(venc('2026-10-09').situacao).toBe('atencao');     // 8 dias
    expect(venc('2026-10-08').situacao).toBe('urgente');     // 7 dias
    expect(venc('2026-10-02').situacao).toBe('urgente');     // 1 dia
    expect(venc('2026-10-01').situacao).toBe('vence_hoje');  // hoje
    expect(venc('2026-09-30')).toMatchObject({ situacao: 'vencido', diasRestantes: -1 });
  });
  it('antecedência do item substitui os 30 dias só naquele item', () => {
    expect(venc('2026-11-20', 60).situacao).toBe('atencao'); // 50 dias, antecedência 60
    expect(venc('2026-10-20', 10).situacao).toBe('em_dia');  // 19 dias, antecedência 10
    expect(venc('2026-10-06', 3).situacao).toBe('urgente');  // urgente continua valendo com 7 dias
  });
});
