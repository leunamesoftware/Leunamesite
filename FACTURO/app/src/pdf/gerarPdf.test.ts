import { describe, expect, it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { gerarPdf } from './gerarPdf';
import { iniciais } from '../dominio/marca';
import type { Documento, Negocio } from '../dominio/tipos';

const agora = '2026-10-01T12:00:00.000Z';
const negocio = (logo: string | null): Negocio => ({
  id: 'n', criadoEm: agora, atualizadoEm: agora, nome: 'Pinta Cell Pinturas', documento: 'CNPJ 12.345.678/0001-90',
  telefone: '(11) 98765-4321', email: 'contato@pintacell.com.br', endereco: 'Rua das Flores, 120 - São Paulo/SP',
  logo, cor: '#0B4F6C', pais: 'BR', moeda: 'BRL', idioma: 'pt-BR', profissao: 'pintor',
  pagamento: { pixChave: 'contato@pintacell.com.br', pixCidade: 'Sao Paulo', link: '', banco: 'Banco Inter · Ag 0001 · CC 1234567-8' },
  validadePadraoDias: 15, observacaoPadrao: '',
});
const documento = (tipo: Documento['tipo']): Documento => ({
  id: 'd', criadoEm: agora, atualizadoEm: agora, tipo, numero: 12, clienteId: null,
  cliente: { nome: 'Maria Souza', telefone: '(11) 91234-5678', email: 'maria@email.com', documento: 'CPF 123.456.789-00', endereco: 'Av. Paulista, 1000 - ap 52' },
  linhas: [
    { itemId: null, nome: 'Pintura de parede (sala e cozinha, duas demãos)', unidade: 'm2', quantidade: 48, precoUnitario: 1600 },
    { itemId: null, nome: 'Massa corrida e lixamento', unidade: 'm2', quantidade: 20, precoUnitario: 1200 },
    { itemId: null, nome: 'Pintura de porta', unidade: 'un', quantidade: 3, precoUnitario: 10000 },
    { itemId: null, nome: 'Material (tinta acrílica premium, rolos e fita)', unidade: 'servico', quantidade: 1, precoUnitario: 48000 },
  ],
  desconto: 5000, observacoes: 'Prazo de execução: 5 dias úteis.\nGarantia de 1 ano na mão de obra.\nPagamento: 50% na aprovação e 50% na entrega.',
  emitidoEm: '2026-10-01', validoAte: tipo === 'orcamento' ? '2026-10-16' : null, venceEm: tipo === 'fatura' ? '2026-10-08' : null,
  status: 'enviado', moeda: 'BRL', origemId: null, link: null, aprovacao: null, pagoEm: tipo === 'recibo' ? '2026-10-05' : null,
});

describe('PDF', () => {
  it('gera orçamento, fatura e recibo sem erro', async () => {
    const logo = process.env.AMOSTRA_LOGO ? 'data:image/png;base64,' + readFileSync(process.env.AMOSTRA_LOGO).toString('base64') : null;
    for (const tipo of ['orcamento', 'fatura', 'recibo'] as const) {
      for (const comLogo of [false, true]) {
        const blob = await gerarPdf(documento(tipo), negocio(comLogo ? logo : null));
        expect(blob.size).toBeGreaterThan(3000);
        if (process.env.AMOSTRA_DIR) writeFileSync(`${process.env.AMOSTRA_DIR}/${tipo}${comLogo ? '-logo' : ''}.pdf`, Buffer.from(await blob.arrayBuffer()));
      }
    }
  });
  it('iniciais do logo automático', () => {
    expect(iniciais('Pinta Cell')).toBe('PC');
    expect(iniciais('Pinta Cell Pinturas')).toBe('PC');
    expect(iniciais('Pintura de Silva')).toBe('PS');
    expect(iniciais('João')).toBe('JO');
    expect(iniciais('')).toBe('F');
  });
});
