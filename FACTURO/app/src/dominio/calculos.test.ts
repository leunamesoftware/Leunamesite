import { describe, expect, it } from 'vitest';
import { codigo, paraCentavos, total } from './calculos';

describe('cálculos', () => {
  it('entende valores digitados em vários formatos', () => {
    expect(paraCentavos('150')).toBe(15000);
    expect(paraCentavos('1.234,56')).toBe(123456);
    expect(paraCentavos('1,234.56')).toBe(123456);
    expect(paraCentavos('1,5')).toBe(150);
    expect(paraCentavos('R$ 2.000')).toBe(200000);
    expect(paraCentavos('')).toBe(0);
  });

  it('soma linhas e aplica desconto sem ficar negativo', () => {
    const linhas = [
      { itemId: null, nome: 'A', unidade: 'un', quantidade: 2, precoUnitario: 5000 },
      { itemId: null, nome: 'B', unidade: 'h', quantidade: 1.5, precoUnitario: 8000 },
    ];
    expect(total({ linhas, desconto: 2000 })).toBe(20000);
    expect(total({ linhas, desconto: 999999 })).toBe(0);
  });

  it('monta o código do documento', () => {
    expect(codigo({ tipo: 'orcamento', numero: 7 })).toBe('ORC-0007');
    expect(codigo({ tipo: 'fatura', numero: 42 })).toBe('FAT-0042');
  });
});
