import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Documento, Negocio } from '../dominio/tipos';
import { codigo, subtotal, total, totalLinha } from '../dominio/calculos';
import { data, dinheiro, t, unidade } from '../i18n';
import { gerarPixCopiaECola } from '../pix/brcode';

// As fontes padrão do PDF só têm caracteres latinos. Símbolos como ₹, ₦ e ₱ viram o código da moeda.
function textoSeguro(s: string): string {
  return s.replace(/[  ]/g, ' ').replace(/[^\u0000-ÿ€]/g, '');
}
function valor(centavos: number, moeda: string): string {
  const s = dinheiro(centavos, moeda).replace(/[  ]/g, ' ');
  if (/[^\u0000-ÿ€]/.test(s)) {
    return `${moeda} ${(centavos / 100).toFixed(2)}`;
  }
  return s;
}

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0x0f766e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function formatoImagem(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

export interface OpcoesPdf {
  marcaFacturo: boolean; // plano grátis mostra "Feito com Facturo"
}

export async function gerarPdf(doc: Documento, neg: Negocio, opcoes: OpcoesPdf = { marcaFacturo: true }): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 210, M = 16, larg = L - M * 2;
  const cor = rgb(neg.cor);
  const cinza: [number, number, number] = [100, 110, 120];
  const escuro: [number, number, number] = [20, 28, 36];
  const tx = (s: string, x: number, y: number, o?: Parameters<jsPDF['text']>[3]) => pdf.text(textoSeguro(s), x, y, o);

  // Faixa no topo com a cor do profissional
  pdf.setFillColor(...cor);
  pdf.rect(0, 0, L, 5, 'F');

  // Cabeçalho: logo e dados do negócio
  let y = 16;
  let xTexto = M;
  if (neg.logo) {
    try {
      pdf.addImage(neg.logo, formatoImagem(neg.logo), M, y - 4, 24, 24, undefined, 'FAST');
      xTexto = M + 28;
    } catch { /* logo inválida: segue sem */ }
  }
  pdf.setTextColor(...escuro).setFont('helvetica', 'bold').setFontSize(15);
  tx(neg.nome || '', xTexto, y + 2);
  pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...cinza);
  const contato = [neg.documento, neg.telefone, neg.email, neg.endereco].filter(Boolean);
  contato.forEach((linha, i) => tx(linha, xTexto, y + 7 + i * 4));

  // Tipo e número à direita
  pdf.setTextColor(...cor).setFont('helvetica', 'bold').setFontSize(18);
  tx(t('tipo.' + doc.tipo).toUpperCase(), L - M, y + 2, { align: 'right' });
  pdf.setTextColor(...escuro).setFontSize(10);
  tx(codigo(doc), L - M, y + 8, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...cinza);
  let yd = y + 13;
  tx(`${t('pdf.data')}: ${data(doc.emitidoEm)}`, L - M, yd, { align: 'right' });
  if (doc.tipo === 'orcamento' && doc.validoAte) tx(`${t('pdf.validade')}: ${data(doc.validoAte)}`, L - M, (yd += 4), { align: 'right' });
  if (doc.tipo === 'fatura' && doc.venceEm) tx(`${t('pdf.vencimento')}: ${data(doc.venceEm)}`, L - M, (yd += 4), { align: 'right' });

  y = Math.max(y + 9 + contato.length * 4, yd) + 8;

  // Cliente
  pdf.setDrawColor(225, 230, 235).line(M, y, L - M, y);
  y += 7;
  pdf.setFontSize(8).setTextColor(...cinza).setFont('helvetica', 'bold');
  tx(t('pdf.para').toUpperCase(), M, y);
  pdf.setFontSize(11).setTextColor(...escuro);
  tx(doc.cliente.nome, M, (y += 5.5));
  pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...cinza);
  for (const l of [doc.cliente.documento, doc.cliente.telefone, doc.cliente.email, doc.cliente.endereco].filter(Boolean)) tx(l, M, (y += 4));
  y += 9;

  const novaPaginaSePrecisar = (altura: number) => {
    if (y + altura > 297 - 22) {
      pdf.addPage();
      y = 20;
    }
  };

  if (doc.tipo === 'recibo') {
    pdf.setFontSize(10.5).setTextColor(...escuro);
    const frase = t('pdf.recebemosDe', { cliente: doc.cliente.nome, total: valor(total(doc), doc.moeda) });
    const linhas = pdf.splitTextToSize(textoSeguro(frase), larg) as string[];
    pdf.text(linhas, M, y);
    y += linhas.length * 5 + 3;
  }

  // Tabela de itens
  const colQtd = M + larg * 0.58, colUnit = M + larg * 0.78, colVal = L - M;
  pdf.setFillColor(...cor).rect(M, y - 5, larg, 8, 'F');
  pdf.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(8.5);
  tx(t('pdf.descricao'), M + 3, y);
  tx(t('pdf.qtd'), colQtd, y, { align: 'right' });
  tx(t('pdf.unitario'), colUnit, y, { align: 'right' });
  tx(t('pdf.valor'), colVal - 3, y, { align: 'right' });
  y += 8;
  pdf.setFont('helvetica', 'normal').setTextColor(...escuro).setFontSize(9);
  doc.linhas.forEach((l, i) => {
    const nome = pdf.splitTextToSize(textoSeguro(l.nome), larg * 0.5) as string[];
    const alt = Math.max(7, nome.length * 4.4 + 2.6);
    novaPaginaSePrecisar(alt);
    if (i % 2 === 1) pdf.setFillColor(246, 248, 250).rect(M, y - 4.6, larg, alt, 'F');
    pdf.text(nome, M + 3, y);
    const qtd = Number.isInteger(l.quantidade) ? String(l.quantidade) : l.quantidade.toLocaleString();
    tx(`${qtd} ${unidade(l.unidade)}`.trim(), colQtd, y, { align: 'right' });
    tx(valor(l.precoUnitario, doc.moeda), colUnit, y, { align: 'right' });
    tx(valor(totalLinha(l), doc.moeda), colVal - 3, y, { align: 'right' });
    y += alt;
  });

  // Totais
  novaPaginaSePrecisar(24);
  y += 2;
  const linhaTotal = (rotulo: string, v: string, forte = false) => {
    pdf.setFont('helvetica', forte ? 'bold' : 'normal').setFontSize(forte ? 12 : 9.5).setTextColor(...(forte ? escuro : cinza));
    tx(rotulo, colUnit, y, { align: 'right' });
    tx(v, colVal - 3, y, { align: 'right' });
    y += forte ? 8 : 5.5;
  };
  if (doc.desconto > 0) {
    linhaTotal(t('pdf.subtotal'), valor(subtotal(doc.linhas), doc.moeda));
    linhaTotal(t('pdf.desconto'), '- ' + valor(doc.desconto, doc.moeda));
  }
  pdf.setDrawColor(...cor).setLineWidth(0.6).line(colUnit - 30, y - 3.5, colVal, y - 3.5).setLineWidth(0.2);
  y += 2;
  linhaTotal(t('pdf.total'), valor(total(doc), doc.moeda), true);
  if (doc.tipo === 'recibo' && doc.pagoEm) {
    pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...cor);
    tx(t('pdf.pagoEm', { data: data(doc.pagoEm) }), colVal - 3, y, { align: 'right' });
    y += 7;
  }

  // Observações
  if (doc.observacoes.trim()) {
    const obs = pdf.splitTextToSize(textoSeguro(doc.observacoes), larg) as string[];
    novaPaginaSePrecisar(obs.length * 4.2 + 12);
    y += 4;
    pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...cinza);
    tx(t('pdf.observacoes').toUpperCase(), M, y);
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...escuro);
    pdf.text(obs, M, (y += 5));
    y += obs.length * 4.2 + 2;
  }

  // Como pagar (fatura)
  if (doc.tipo === 'fatura') {
    const p = neg.pagamento;
    const blocos: { titulo: string; qr?: string; texto: string }[] = [];
    if (p.pixChave.trim()) {
      const copia = gerarPixCopiaECola({ chave: p.pixChave, nome: neg.nome, cidade: p.pixCidade, valorCentavos: total(doc), identificador: codigo(doc).replace('-', '') });
      blocos.push({ titulo: t('pdf.pagueComPix'), qr: copia, texto: `${t('pdf.pixCopiaCola')}: ${copia}` });
    }
    if (p.link.trim()) blocos.push({ titulo: t('pdf.pagueNoLink'), qr: p.link.trim(), texto: p.link.trim() });
    if (p.banco.trim()) blocos.push({ titulo: t('pdf.dadosBancarios'), texto: p.banco.trim() });
    if (blocos.length) {
      novaPaginaSePrecisar(12);
      y += 5;
      pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...cinza);
      tx(t('pdf.pagamento').toUpperCase(), M, y);
      y += 4;
      for (const b of blocos) {
        const linhasTexto = pdf.splitTextToSize(textoSeguro(b.texto), b.qr ? larg - 40 : larg) as string[];
        const alt = Math.max(b.qr ? 34 : 0, linhasTexto.length * 3.8 + 10);
        novaPaginaSePrecisar(alt + 4);
        pdf.setDrawColor(225, 230, 235).roundedRect(M, y, larg, alt, 2, 2, 'S');
        let xt = M + 4;
        if (b.qr) {
          const img = await QRCode.toDataURL(b.qr, { margin: 0, width: 300, errorCorrectionLevel: 'M' });
          pdf.addImage(img, 'PNG', M + 3, y + 3, 28, 28);
          xt = M + 36;
        }
        pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...escuro);
        tx(b.titulo, xt, y + 7);
        pdf.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...cinza);
        pdf.text(linhasTexto, xt, y + 12);
        y += alt + 4;
      }
    }
  }

  // Aprovação do cliente (assinatura)
  if (doc.aprovacao) {
    novaPaginaSePrecisar(34);
    y += 6;
    if (doc.aprovacao.assinatura) {
      try { pdf.addImage(doc.aprovacao.assinatura, 'PNG', M, y, 50, 20); } catch { /* sem imagem */ }
    }
    pdf.setDrawColor(...cinza).line(M, y + 21, M + 70, y + 21);
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...cinza);
    tx(t('pdf.aprovadoEletronicamente', { nome: doc.aprovacao.nome, data: data(doc.aprovacao.em) }), M, y + 25);
  }

  // Rodapé em todas as páginas
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(160, 168, 176);
    if (opcoes.marcaFacturo) tx(t('pdf.feitoCom'), M, 297 - 9);
    tx(`${codigo(doc)} · ${i}/${paginas}`, L - M, 297 - 9, { align: 'right' });
  }

  return pdf.output('blob');
}

export function nomeArquivo(doc: Documento): string {
  const cliente = doc.cliente.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${codigo(doc)}${cliente ? '-' + cliente : ''}.pdf`;
}
