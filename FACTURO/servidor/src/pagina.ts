import QRCode from 'qrcode';
import { esc, type CopiaPublica } from './util';
import { preencher, textos } from './textos';

export interface Aprovacao { nome: string; assinatura: string | null; em: string }

function dinheiro(c: number, moeda: string, locale: string): string {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: moeda }).format(c / 100); } catch { return `${moeda} ${(c / 100).toFixed(2)}`; }
}
function data(v: string | null, locale: string): string {
  if (!v) return '';
  const d = v.length === 10 ? new Date(v + 'T12:00:00Z') : new Date(v);
  try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d); } catch { return v.slice(0, 10); }
}

/** Iniciais para o logo automático (igual ao app). */
function iniciais(nome: string): string {
  const limpas = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const fortes = limpas.filter((p) => p.length > 2 || /\d/.test(p));
  const w = fortes.length ? fortes : limpas;
  if (!w.length) return 'F';
  return (w.length === 1 ? w[0]!.slice(0, 2) : w[0]![0]! + w[1]![0]!).toUpperCase();
}

const CSS = `
:root{--cor:#0E9F6E;--fundo:#F3F6F6;--sup:#fff;--txt:#10262C;--suave:#5B6E74;--linha:#E1E8E8}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--txt);font:16px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.w{max-width:620px;margin:0 auto;padding:0 16px 40px}.faixa{height:6px;background:var(--cor)}
.cab{display:flex;gap:12px;align-items:center;padding:18px 0}.cab .ini{width:56px;height:56px;border-radius:12px;display:grid;place-items:center;background:#fff;color:var(--cor);font-weight:800;font-size:22px;border:1px solid var(--linha)}.cab img{width:56px;height:56px;object-fit:contain;border-radius:12px;background:#fff;border:1px solid var(--linha)}
.cab h1{font-size:19px;margin:0}.cab small{color:var(--suave)}
.c{background:var(--sup);border-radius:16px;padding:16px;margin-top:12px;box-shadow:0 1px 2px rgba(16,38,44,.06),0 6px 18px rgba(16,38,44,.06)}
.tipo{color:var(--cor);font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:13px}.cod{font-weight:700}
.meta{color:var(--suave);font-size:14px}.cli{font-size:20px;font-weight:800;margin:6px 0 2px}
.l{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--linha)}.l:last-child{border:0}
.l .n{font-weight:600}.l .s{color:var(--suave);font-size:13px}.l .v{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.tot{display:flex;flex-direction:column;align-items:flex-end;margin-top:8px;font-variant-numeric:tabular-nums}.tot .g{font-size:28px;font-weight:800}
h2{font-size:17px;margin:0 0 10px}label{font-weight:600;color:var(--suave);font-size:14px;display:block;margin-bottom:6px}
input{width:100%;min-height:50px;border-radius:12px;border:1.5px solid var(--linha);padding:12px 14px;font:inherit}
canvas{width:100%;height:180px;border:1.5px dashed var(--linha);border-radius:12px;background:#fff;touch-action:none;display:block}
.b{display:flex;align-items:center;justify-content:center;width:100%;min-height:54px;border:0;border-radius:16px;font:inherit;font-weight:800;font-size:17px;background:var(--cor);color:#fff;margin-top:12px;text-decoration:none;cursor:pointer}
.b.sec{background:transparent;color:var(--suave);font-weight:600;min-height:44px}.b.out{background:#fff;color:var(--txt);box-shadow:inset 0 0 0 1.5px var(--linha)}
.ok{background:#DDF5EA;color:#0B8A5F;border-radius:14px;padding:14px;font-weight:700}.err{color:#C2410C;font-weight:600;min-height:20px;margin-top:8px}
.qr{display:flex;justify-content:center;margin:8px 0}.qr svg{width:220px;height:220px}
.pix{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;background:var(--fundo);border-radius:10px;padding:10px;color:var(--suave)}
.ass{max-width:240px;background:#fff;border:1px solid var(--linha);border-radius:8px}
footer{text-align:center;color:var(--suave);font-size:13px;margin-top:22px}pre{white-space:pre-wrap;font:inherit;margin:0}
`;

export async function paginaDocumento(id: string, d: CopiaPublica, aprovacao: Aprovacao | null, recusado: boolean, nonce: string, pagoInformadoEm: string | null = null): Promise<string> {
  const T = textos(d.idioma);
  const $ = (c: number) => dinheiro(c, d.moeda, d.locale);
  const cor = d.negocio.cor;
  const linhas = d.linhas.map((l) => `<div class="l"><div><div class="n">${esc(l.nome)}</div><div class="s">${esc(String(l.quantidade).replace('.', ','))} ${esc(l.unidade)} × ${esc($(l.precoUnitario))}</div></div><div class="v">${esc($(Math.round(l.quantidade * l.precoUnitario)))}</div></div>`).join('');

  let acao = '';
  if (d.pedeAprovacao) {
    if (aprovacao) {
      acao = `<div class="c"><div class="ok">✓ ${esc(T.aprovado)}</div>${aprovacao.assinatura ? `<p><img class="ass" src="${esc(aprovacao.assinatura)}" alt=""></p>` : ''}<div class="meta">${esc(preencher(T.aprovadoPor, { nome: aprovacao.nome, data: data(aprovacao.em, d.locale) }))}</div></div>`;
    } else if (recusado) {
      acao = `<div class="c"><div class="meta">${esc(T.recusado)}</div></div>`;
    } else {
      acao = `<div class="c" id="aprovar"><h2>${esc(T.aprovarTitulo)}</h2>
<label for="nome">${esc(T.seuNome)}</label><input id="nome" autocomplete="name" value="${esc(d.cliente.nome)}">
<label style="margin-top:12px">${esc(T.assine)}</label><canvas id="tela"></canvas>
<button class="b sec" id="limpar" type="button">${esc(T.limpar)}</button>
<div class="err" id="erro" role="alert"></div>
<button class="b" id="ok" type="button">✓ ${esc(T.aprovar)}</button>
<button class="b sec" id="nao" type="button">${esc(T.recusar)}</button></div>`;
    }
  }

  let pagamento = '';
  if (d.tipo === 'fatura') {
    const p = d.pagamento ?? { pix: '', link: '', banco: '' };
    const blocos: string[] = [];
    if (p.pix) {
      const svg = await QRCode.toString(p.pix, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      blocos.push(`<h2>${esc(T.pix)}</h2><div class="meta">${esc(T.pixAjuda)}</div><div class="qr">${svg}</div><div class="pix" id="pix">${esc(p.pix)}</div><button class="b out" id="copiar" type="button">${esc(T.copiar)}</button>`);
    }
    if (p.link) blocos.push(`<a class="b" href="${esc(p.link)}" rel="noopener noreferrer" target="_blank">${esc(T.pagarLink)}</a>`);
    if (p.banco) blocos.push(`<h2 style="margin-top:14px">${esc(T.banco)}</h2><pre class="meta">${esc(p.banco)}</pre>`);
    const paguei = pagoInformadoEm
      ? `<div class="ok" style="margin-top:14px">✓ ${esc(preencher(T.pagamentoInformado, { data: data(pagoInformadoEm, d.locale), negocio: d.negocio.nome }))}</div>`
      : `<div class="err" id="erro" role="alert"></div><button class="b" id="paguei" type="button" style="margin-top:14px">✓ ${esc(T.jaPaguei)}</button>`;
    pagamento = `<div class="c" id="pagar">${blocos.length ? `<h2>${esc(T.pagar)}</h2>${blocos.join('')}` : ''}${paguei}</div>`;
  }

  const telefone = d.negocio.telefone.replace(/\D/g, '');
  const contato = telefone ? `<a class="b out" href="https://wa.me/${esc(telefone)}" rel="noopener noreferrer">${esc(preencher(T.contato, { negocio: d.negocio.nome }))}</a>` : '';

  const script = `
const T=${JSON.stringify({ faltaNome: T.faltaNome, faltaAssinatura: T.faltaAssinatura, erro: T.erro, obrigado: preencher(T.obrigado, { negocio: d.negocio.nome }), confirmarRecusa: T.confirmarRecusa, copiado: T.copiado, confirmarPaguei: T.confirmarPaguei })};
const id=${JSON.stringify(id)};
const c=document.getElementById('tela');
if(c){const r=window.devicePixelRatio||1;const ajustar=()=>{const b=c.getBoundingClientRect();c.width=b.width*r;c.height=b.height*r;const x=c.getContext('2d');x.scale(r,r);x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#10262C';};ajustar();
let des=false,usou=false;const pos=e=>{const b=c.getBoundingClientRect();return[e.clientX-b.left,e.clientY-b.top]};const x=()=>c.getContext('2d');
c.addEventListener('pointerdown',e=>{des=true;usou=true;c.setPointerCapture(e.pointerId);const[a,b]=pos(e);x().beginPath();x().moveTo(a,b)});
c.addEventListener('pointermove',e=>{if(!des)return;const[a,b]=pos(e);x().lineTo(a,b);x().stroke()});
['pointerup','pointercancel'].forEach(t=>c.addEventListener(t,()=>des=false));
document.getElementById('limpar').onclick=()=>{x().clearRect(0,0,c.width,c.height);usou=false};
const erro=m=>document.getElementById('erro').textContent=m;
const enviar=async(rota,corpo)=>{const r=await fetch('/o/'+id+'/'+rota,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});if(!r.ok)throw new Error();};
document.getElementById('ok').onclick=async e=>{const nome=document.getElementById('nome').value.trim();if(!nome)return erro(T.faltaNome);if(!usou)return erro(T.faltaAssinatura);e.target.disabled=true;
const m=document.createElement('canvas');m.width=480;m.height=Math.round(480*c.height/c.width);m.getContext('2d').drawImage(c,0,0,m.width,m.height);
try{await enviar('aprovar',{nome,assinatura:m.toDataURL('image/png')});document.getElementById('aprovar').innerHTML='<div class="ok">✓ '+T.obrigado+'</div>';setTimeout(()=>location.reload(),1800)}catch{e.target.disabled=false;erro(T.erro)}};
document.getElementById('nao').onclick=async()=>{if(!confirm(T.confirmarRecusa))return;try{await enviar('recusar',{});location.reload()}catch{erro(T.erro)}};}
const pg=document.getElementById('paguei');if(pg)pg.onclick=async()=>{if(!confirm(T.confirmarPaguei))return;pg.disabled=true;try{const r=await fetch('/o/'+id+'/paguei',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw 0;location.reload()}catch{pg.disabled=false;document.getElementById('erro').textContent=T.erro}};
const cp=document.getElementById('copiar');if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('pix').textContent);cp.textContent=T.copiado}catch{}};`;

  return `<!doctype html><html lang="${esc(d.idioma)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>${esc(d.tipo === 'fatura' ? T.fatura : T.orcamento)} ${esc(d.codigo)} — ${esc(d.negocio.nome)}</title>
<style nonce="${nonce}">${CSS}:root{--cor:${esc(cor)}}</style></head><body><div class="faixa"></div><div class="w">
<div class="cab">${d.negocio.logo ? `<img src="${esc(d.negocio.logo)}" alt="">` : `<div class="ini">${esc(iniciais(d.negocio.nome))}</div>`}<div><h1>${esc(d.negocio.nome)}</h1><small>${esc([d.negocio.telefone, d.negocio.email].filter(Boolean).join(' · '))}</small></div></div>
<div class="c"><div class="tipo">${esc(d.tipo === 'fatura' ? T.fatura : T.orcamento)} · <span class="cod">${esc(d.codigo)}</span></div>
<div class="meta">${esc(T.para)}</div><div class="cli">${esc(d.cliente.nome)}</div>
<div class="meta">${esc(T.emitido)} ${esc(data(d.emitidoEm, d.locale))}${d.validoAte && d.tipo === 'orcamento' ? ` · ${esc(T.valido)} ${esc(data(d.validoAte, d.locale))}` : ''}${d.venceEm && d.tipo === 'fatura' ? ` · ${esc(T.vence)} ${esc(data(d.venceEm, d.locale))}` : ''}</div>
<div style="margin-top:8px">${linhas}</div>
<div class="tot">${d.desconto > 0 ? `<div class="meta">${esc(T.subtotal)} ${esc($(d.subtotal))}</div><div class="meta">${esc(T.desconto)} − ${esc($(d.desconto))}</div>` : ''}<div class="g">${esc($(d.total))}</div></div>
${d.observacoes ? `<div style="margin-top:12px"><div class="meta"><b>${esc(T.observacoes)}</b></div><pre>${esc(d.observacoes)}</pre></div>` : ''}</div>
${acao}${pagamento}${contato}
<footer>${esc(T.feito)}</footer></div><script nonce="${nonce}">${script}</script></body></html>`;
}

export function paginaSimples(texto: string, idioma = 'en'): string {
  return `<!doctype html><html lang="${esc(idioma)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Facturo</title></head>
<body style="font:17px system-ui;display:flex;min-height:90vh;align-items:center;justify-content:center;color:#10262C;background:#F3F6F6;padding:16px;text-align:center"><p>${esc(texto)}</p></body></html>`;
}
