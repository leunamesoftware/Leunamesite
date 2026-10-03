import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Documento, Negocio } from '../dominio/tipos';
import { codigo, subtotal, total, totalLinha } from '../dominio/calculos';
import { iniciais } from '../dominio/marca';
import { data, dinheiro, t, unidade } from '../i18n';
import { gerarPixCopiaECola } from '../pix/brcode';

type Cor = [number, number, number];

// As fontes padrão do PDF só têm caracteres latinos. Símbolos como ₹, ₦ e ₱ viram o código da moeda.
function textoSeguro(s: string): string {
  return s.replace(/[  ]/g, ' ').replace(/[^\u0000-ÿ€]/g, '');
}
function valor(centavos: number, moeda: string): string {
  const s = dinheiro(centavos, moeda).replace(/[  ]/g, ' ');
  return /[^\u0000-ÿ€]/.test(s) ? `${moeda} ${(centavos / 100).toFixed(2)}` : s;
}
function rgb(hex: string): Cor {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0x0e9f6e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mistura a cor com branco (0 = cor pura, 1 = branco): fundos suaves na cor do negócio. */
const clarear = (c: Cor, k: number): Cor => c.map((v) => Math.round(v + (255 - v) * k)) as Cor;
const formatoImagem = (u: string): 'PNG' | 'JPEG' => (u.startsWith('data:image/png') ? 'PNG' : 'JPEG');

export interface OpcoesPdf {
  marcaFacturo: boolean; // plano grátis mostra "Feito com Facturo"
}

export async function gerarPdf(doc: Documento, neg: Negocio, opcoes: OpcoesPdf = { marcaFacturo: true }): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 210, A = 297, M = 15, larg = L - M * 2;
  const cor = rgb(neg.cor);
  const suave = clarear(cor, 0.9);
  const escuro: Cor = [22, 32, 40];
  const cinza: Cor = [96, 108, 118];
  const linha: Cor = [226, 231, 235];
  const tx = (s: string, x: number, y: number, o?: Parameters<jsPDF['text']>[3]) => pdf.text(textoSeguro(s), x, y, o);
  const fonte = (estilo: 'normal' | 'bold', tam: number, c: Cor) => pdf.setFont('helvetica', estilo).setFontSize(tam).setTextColor(...c);

  // ── Cabeçalho na cor do negócio ─────────────────────────────────────────
  const altCab = 44;
  pdf.setFillColor(...cor).rect(0, 0, L, altCab, 'F');
  // Logo num quadro branco; sem logo, monograma com as iniciais (fica profissional mesmo sem arte).
  const lx = M, ly = 9, lt = 26;
  pdf.setFillColor(255, 255, 255).roundedRect(lx, ly, lt, lt, 4, 4, 'F');
  let temLogo = false;
  if (neg.logo) {
    try { pdf.addImage(neg.logo, formatoImagem(neg.logo), lx + 2, ly + 2, lt - 4, lt - 4, undefined, 'FAST'); temLogo = true; } catch { /* logo inválida */ }
  }
  if (!temLogo) {
    fonte('bold', 20, cor);
    tx(iniciais(neg.nome), lx + lt / 2, ly + lt / 2 + 3.5, { align: 'center' });
  }
  const xn = lx + lt + 6;
  fonte('bold', 16, [255, 255, 255]);
  const nomeNeg = pdf.splitTextToSize(textoSeguro(neg.nome || ''), 95) as string[];
  pdf.text(nomeNeg.slice(0, 2), xn, 17);
  fonte('normal', 8.3, clarear(cor, 0.82));
  let yc = 17 + Math.min(nomeNeg.length, 2) * 6;
  for (const l of [neg.documento, [neg.telefone, neg.email].filter(Boolean).join('  ·  '), neg.endereco].filter(Boolean)) {
    tx(l, xn, yc); yc += 4;
  }
  // Tipo e número à direita
  fonte('bold', 20, [255, 255, 255]);
  tx(t('tipo.' + doc.tipo).toUpperCase(), L - M, 19, { align: 'right' });
  fonte('normal', 10, clarear(cor, 0.82));
  tx(`${t('pdf.numero')} ${codigo(doc)}`, L - M, 26, { align: 'right' });

  // ── Quadros: cliente | detalhes ─────────────────────────────────────────
  let y = altCab + 9;
  const gap = 6, wCli = larg * 0.6 - gap / 2, wDet = larg - wCli - gap;
  const linhasCli = [doc.cliente.documento && `${t('pdf.documento')} ${doc.cliente.documento}`, doc.cliente.telefone && `${t('pdf.telefone')} ${doc.cliente.telefone}`, doc.cliente.email, doc.cliente.endereco].filter(Boolean) as string[];
  const detalhes: [string, string][] = [[t('pdf.emissao'), data(doc.emitidoEm)]];
  if (doc.tipo === 'orcamento' && doc.validoAte) detalhes.push([t('pdf.validade'), data(doc.validoAte)]);
  if (doc.tipo === 'fatura' && doc.venceEm) detalhes.push([t('pdf.vencimento'), data(doc.venceEm)]);
  if (doc.tipo === 'recibo' && doc.pagoEm) detalhes.push([t('pdf.pagoEm', { data: '' }).replace(/\s+$/, ''), data(doc.pagoEm)]);
  const altQ = Math.max(28, 21 + linhasCli.length * 4.4, 14 + detalhes.length * 5.5);

  pdf.setFillColor(...suave).roundedRect(M, y, wCli, altQ, 3, 3, 'F');
  fonte('bold', 7.5, cor); tx(t('pdf.cliente').toUpperCase(), M + 5, y + 7);
  fonte('bold', 11.5, escuro); tx(doc.cliente.nome || '—', M + 5, y + 13.5);
  fonte('normal', 8.5, cinza);
  linhasCli.forEach((l, i) => tx(l, M + 5, y + 19 + i * 4.4));

  const xd = M + wCli + gap;
  pdf.setDrawColor(...linha).setLineWidth(0.3).roundedRect(xd, y, wDet, altQ, 3, 3, 'S');
  fonte('bold', 7.5, cor); tx(t('pdf.detalhes').toUpperCase(), xd + 5, y + 7);
  detalhes.forEach(([r, v], i) => {
    fonte('normal', 8.5, cinza); tx(r, xd + 5, y + 13.5 + i * 5.5);
    fonte('bold', 8.5, escuro); tx(v, xd + wDet - 5, y + 13.5 + i * 5.5, { align: 'right' });
  });
  y += altQ + 9;

  const novaPagina = (altura: number) => {
    if (y + altura > A - 24) { pdf.addPage(); y = 20; return true; }
    return false;
  };

  if (doc.tipo === 'recibo') {
    fonte('normal', 10.5, escuro);
    const frase = pdf.splitTextToSize(textoSeguro(t('pdf.recebemosDe', { cliente: doc.cliente.nome, total: valor(total(doc), doc.moeda) })), larg) as string[];
    pdf.text(frase, M, y);
    y += frase.length * 5 + 4;
  }

  // ── Tabela de itens ─────────────────────────────────────────────────────
  const cN = M + 4, cDesc = M + 12, cQtd = M + larg * 0.62, cUnit = M + larg * 0.8, cVal = L - M - 4;
  const cabecalhoTabela = () => {
    pdf.setFillColor(...cor).roundedRect(M, y - 5.5, larg, 9, 2, 2, 'F');
    fonte('bold', 8, [255, 255, 255]);
    tx('#', cN, y); tx(t('pdf.descricao').toUpperCase(), cDesc, y);
    tx(t('pdf.qtd').toUpperCase(), cQtd, y, { align: 'right' });
    tx(t('pdf.unitario').toUpperCase(), cUnit, y, { align: 'right' });
    tx(t('pdf.valor').toUpperCase(), cVal, y, { align: 'right' });
    y += 9;
  };
  cabecalhoTabela();
  doc.linhas.forEach((l, i) => {
    const nome = pdf.splitTextToSize(textoSeguro(l.nome), cQtd - cDesc - 24) as string[];
    const alt = Math.max(8, nome.length * 4.4 + 3.6);
    if (novaPagina(alt)) cabecalhoTabela();
    if (i % 2 === 1) pdf.setFillColor(248, 250, 251).rect(M, y - 5, larg, alt, 'F');
    fonte('normal', 8.5, cinza); tx(String(i + 1), cN, y);
    fonte('bold', 9.2, escuro); pdf.text(nome, cDesc, y);
    const qtd = Number.isInteger(l.quantidade) ? String(l.quantidade) : l.quantidade.toLocaleString();
    fonte('normal', 9, escuro);
    tx(`${qtd} ${unidade(l.unidade)}`.trim(), cQtd, y, { align: 'right' });
    tx(valor(l.precoUnitario, doc.moeda), cUnit, y, { align: 'right' });
    fonte('bold', 9, escuro); tx(valor(totalLinha(l), doc.moeda), cVal, y, { align: 'right' });
    y += alt;
    pdf.setDrawColor(...linha).setLineWidth(0.2).line(M, y - 5, L - M, y - 5);
  });

  // ── Totais (caixa à direita) ────────────────────────────────────────────
  const temDesconto = doc.desconto > 0;
  novaPagina(temDesconto ? 34 : 22);
  y += 3;
  const wT = 78, xT = L - M - wT;
  if (temDesconto) {
    const linhaT = (r: string, v: string) => { fonte('normal', 9.2, cinza); tx(r, xT + 4, y); fonte('normal', 9.2, escuro); tx(v, L - M - 4, y, { align: 'right' }); y += 6; };
    linhaT(t('pdf.subtotal'), valor(subtotal(doc.linhas), doc.moeda));
    linhaT(t('pdf.desconto'), '- ' + valor(doc.desconto, doc.moeda));
  }
  pdf.setFillColor(...cor).roundedRect(xT, y - 4, wT, 13, 2.5, 2.5, 'F');
  fonte('bold', 10, [255, 255, 255]); tx(t('pdf.total').toUpperCase(), xT + 5, y + 4.2);
  fonte('bold', 14, [255, 255, 255]); tx(valor(total(doc), doc.moeda), L - M - 5, y + 4.6, { align: 'right' });
  y += 18;
  if (doc.tipo === 'recibo' && doc.pagoEm) {
    fonte('bold', 10, cor); tx(t('pdf.pagoEm', { data: data(doc.pagoEm) }).toUpperCase(), L - M, y, { align: 'right' });
    y += 8;
  }

  // ── Observações / condições ─────────────────────────────────────────────
  if (doc.observacoes.trim()) {
    const obs = pdf.splitTextToSize(textoSeguro(doc.observacoes), larg - 10) as string[];
    const alt = obs.length * 4.3 + 13;
    novaPagina(alt + 4);
    pdf.setFillColor(...suave).roundedRect(M, y, larg, alt, 3, 3, 'F');
    pdf.setFillColor(...cor).rect(M, y, 1.4, alt, 'F');
    fonte('bold', 7.5, cor); tx(t('pdf.observacoes').toUpperCase(), M + 5, y + 6.5);
    fonte('normal', 9, escuro); pdf.text(obs, M + 5, y + 12);
    y += alt + 7;
  }

  // ── Como pagar (fatura) ─────────────────────────────────────────────────
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
      novaPagina(14);
      fonte('bold', 7.5, cor); tx(t('pdf.pagamento').toUpperCase(), M, y + 2);
      y += 6;
      for (const b of blocos) {
        const lt2 = pdf.splitTextToSize(textoSeguro(b.texto), b.qr ? larg - 44 : larg - 10) as string[];
        const alt = Math.max(b.qr ? 36 : 0, lt2.length * 3.8 + 12);
        novaPagina(alt + 4);
        pdf.setDrawColor(...linha).setLineWidth(0.3).roundedRect(M, y, larg, alt, 3, 3, 'S');
        let xt = M + 5;
        if (b.qr) {
          const img = await QRCode.toDataURL(b.qr, { margin: 0, width: 300, errorCorrectionLevel: 'M' });
          pdf.addImage(img, 'PNG', M + 4, y + 4, 28, 28);
          xt = M + 38;
        }
        fonte('bold', 9.5, escuro); tx(b.titulo, xt, y + 8);
        fonte('normal', 7.8, cinza); pdf.text(lt2, xt, y + 13);
        y += alt + 4;
      }
    }
  }

  // ── Aceite / assinatura ─────────────────────────────────────────────────
  if (doc.aprovacao) {
    novaPagina(36);
    y += 4;
    if (doc.aprovacao.assinatura) {
      try { pdf.addImage(doc.aprovacao.assinatura, 'PNG', M, y, 55, 22); } catch { /* sem imagem */ }
    }
    pdf.setDrawColor(...cinza).setLineWidth(0.3).line(M, y + 23, M + 75, y + 23);
    fonte('normal', 8, cinza);
    tx(t('pdf.aprovadoEletronicamente', { nome: doc.aprovacao.nome, data: data(doc.aprovacao.em) }), M, y + 27.5);
  } else if (doc.tipo === 'orcamento') {
    // Para imprimir: o cliente assina no papel.
    novaPagina(40);
    y += 4;
    fonte('bold', 7.5, cor); tx(t('pdf.aceite').toUpperCase(), M, y);
    fonte('normal', 8.5, cinza); tx(t('pdf.aceiteTexto'), M, y + 5.5);
    const yl = y + 24, wl = (larg - 14) / 2;
    pdf.setDrawColor(...cinza).setLineWidth(0.3);
    pdf.line(M, yl, M + wl, yl);
    pdf.line(M + wl + 14, yl, L - M, yl);
    fonte('normal', 8, cinza);
    tx(t('pdf.assinaturaCliente'), M, yl + 4.5);
    tx(`${t('pdf.responsavel')} · ${neg.nome}`, M + wl + 14, yl + 4.5);
    tx(t('pdf.dataAceite'), M, yl + 10);
    y = yl + 14;
  }

  // ── Agradecimento + rodapé em todas as páginas ──────────────────────────
  if (y < A - 34) { fonte('bold', 9.5, cor); tx(t('pdf.obrigado'), L / 2, A - 26, { align: 'center' }); }
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFillColor(...cor).rect(0, A - 4, L, 4, 'F');
    pdf.setDrawColor(...linha).setLineWidth(0.2).line(M, A - 16, L - M, A - 16);
    fonte('normal', 7.5, [140, 150, 158]);
    tx([neg.nome, neg.telefone, neg.email].filter(Boolean).join('  ·  '), M, A - 10.5);
    tx(t('pdf.pagina', { a: i, b: paginas }), L - M, A - 10.5, { align: 'right' });
    if (opcoes.marcaFacturo) tx(t('pdf.feitoCom'), L / 2, A - 7, { align: 'center' });
  }

  return pdf.output('blob');
}

export function nomeArquivo(doc: Documento): string {
  const cliente = doc.cliente.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${codigo(doc)}${cliente ? '-' + cliente : ''}.pdf`;
}
