import { describe, expect, it } from 'vitest';
import { crc16, gerarPixCopiaECola } from './brcode';

describe('Pix copia e cola', () => {
  it('bate com o exemplo oficial do manual do Banco Central', () => {
    const codigo = gerarPixCopiaECola({
      chave: '123e4567-e12b-12d1-a456-426655440000',
      nome: 'Fulano de Tal',
      cidade: 'BRASILIA',
    });
    expect(codigo).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  it('inclui o valor e confere o CRC', () => {
    const codigo = gerarPixCopiaECola({ chave: 'contato@exemplo.com', nome: 'José Ávila', cidade: 'São Paulo', valorCentavos: 15050 });
    expect(codigo).toContain('5406150.50');
    expect(codigo).toContain('5910Jose Avila');
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)));
  });
});
