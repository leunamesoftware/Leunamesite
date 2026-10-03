import { useCallback, useEffect, useRef, useState } from 'react';
import { documentos } from '../dados/banco';
import { marcarAprovado, registrarPagamento, virarFatura } from '../dominio/acoes';
import { codigo, estaVencida, total } from '../dominio/calculos';
import type { Documento } from '../dominio/tipos';
import { useEstado } from '../estado';
import { data, dinheiro, t, unidade, useIdioma } from '../i18n';
import { gerarPdf, nomeArquivo } from '../pdf/gerarPdf';
import { abrirWhatsApp, compartilharArquivo, copiarTexto } from '../servicos/compartilhar';
import { atualizarLink, criarLink } from '../servicos/links';
import { acompanhar, aguardaCliente } from '../servicos/acompanhar';
import { Selo, Topo } from '../componentes/base';

export function Detalhe({ id, enviar = false }: { id: string; enviar?: boolean }) {
  useIdioma();
  const { negocio, ir, voltar, aviso, revisao } = useEstado();
  const [doc, setDoc] = useState<Documento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const jaEnviou = useRef(false);

  const recarregar = useCallback(async () => setDoc((await documentos.obter(id)) ?? null), [id]);
  useEffect(() => { void recarregar(); }, [recarregar, revisao]);

  // Ao abrir, confere em silêncio se o cliente já aprovou ou informou pagamento.
  useEffect(() => {
    if (doc && aguardaCliente(doc) && navigator.onLine) void conferirAprovacao(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  // Veio do editor com "Salvar e enviar": abre o envio uma vez.
  useEffect(() => {
    if (enviar && doc && !jaEnviou.current) {
      jaEnviou.current = true;
      void enviarWhatsApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enviar, doc?.id]);

  if (!doc || !negocio) return null;
  const d = doc;
  const valorTotal = dinheiro(total(d), d.moeda);

  async function comOcupado(fn: () => Promise<void>) {
    setOcupado(true);
    try { await fn(); } catch { aviso(t('comum.erro')); } finally { setOcupado(false); }
  }

  /** Cria (ou atualiza) o link do cliente. Sem internet, segue sem link. */
  async function garantirLink(atual: Documento): Promise<Documento> {
    if (atual.tipo === 'recibo' || !navigator.onLine) return atual;
    try {
      if (atual.link) {
        await atualizarLink(atual.link, atual, negocio!);
        return atual;
      }
      const link = await criarLink(atual, negocio!);
      return documentos.salvar({ ...atual, link });
    } catch {
      aviso(t('comum.semInternet'));
      return atual;
    }
  }

  async function enviarWhatsApp() {
    await comOcupado(async () => {
      let atual = await garantirLink(d);
      if (atual.status === 'rascunho') atual = await documentos.salvar({ ...atual, status: 'enviado' });
      setDoc(atual);
      const vars = { cliente: atual.cliente.nome.split(' ')[0] ?? '', codigo: codigo(atual), negocio: negocio!.nome, total: valorTotal, data: data(atual.venceEm) };
      let texto = t('whats.' + atual.tipo, vars);
      if (atual.link) texto += '\n\n' + t(atual.tipo === 'orcamento' ? 'whats.verAprovar' : 'whats.verPagar', { link: atual.link.url });
      if (atual.tipo === 'recibo' || !atual.link) {
        // Sem link: manda o PDF junto pelo menu de compartilhar.
        const pdf = await gerarPdf(atual, negocio!);
        await compartilharArquivo(pdf, nomeArquivo(atual), texto);
      } else {
        abrirWhatsApp(texto, atual.cliente.telefone, negocio!.pais);
      }
    });
  }

  async function compartilharPdf() {
    await comOcupado(async () => {
      const pdf = await gerarPdf(d, negocio!);
      await compartilharArquivo(pdf, nomeArquivo(d), `${t('tipo.' + d.tipo)} ${codigo(d)} — ${negocio!.nome}`);
    });
  }

  async function conferirAprovacao(silencioso = false) {
    try {
      const { doc: novo, evento } = await acompanhar(d);
      setDoc(novo);
      if (!silencioso) aviso(evento ? t('status.' + (evento.tipo === 'aprovou' ? 'aprovado' : evento.tipo === 'recusou' ? 'recusado' : 'pago')) : t('doc.aguardandoCliente'));
    } catch {
      if (!silencioso) aviso(t('comum.semInternet'));
    }
  }

  async function lembrar() {
    const vars = { cliente: d.cliente.nome.split(' ')[0] ?? '', codigo: codigo(d), total: valorTotal, data: data(d.venceEm) };
    let texto = t('whats.lembrete', vars);
    if (d.link) texto += '\n\n' + t('whats.verPagar', { link: d.link.url });
    abrirWhatsApp(texto, d.cliente.telefone, negocio!.pais);
  }

  async function excluir() {
    if (!window.confirm(t('doc.excluirConfirma'))) return;
    await documentos.excluir(d.id);
    voltar();
  }

  const vencida = estaVencida(d);
  return (
    <>
      <Topo titulo={t('tipo.' + d.tipo)} voltar />
      <main className="conteudo">
        <section className="cartao">
          <div className="cabecalho-doc">
            <div>
              <div className="codigo">{codigo(d)}</div>
              <div className="cliente">{d.cliente.nome}</div>
              <div style={{ color: 'var(--suave)', fontSize: 14 }}>
                {t('doc.emitidoEm')} {data(d.emitidoEm)}
                {d.validoAte && <> · {t('doc.validoAte')} {data(d.validoAte)}</>}
                {d.venceEm && d.tipo === 'fatura' && <> · {t('doc.venceEm')} {data(d.venceEm)}</>}
              </div>
            </div>
            <Selo doc={d} />
          </div>
          <div className="lista" style={{ marginTop: 10 }}>
            {d.linhas.map((l, i) => (
              <div key={i} className="item-lista" style={{ cursor: 'default' }}>
                <div className="principal">
                  <div className="titulo">{l.nome}</div>
                  <div className="sub">{String(l.quantidade).replace('.', ',')} {unidade(l.unidade)} × {dinheiro(l.precoUnitario, d.moeda)}</div>
                </div>
                <div className="valor">{dinheiro(Math.round(l.quantidade * l.precoUnitario), d.moeda)}</div>
              </div>
            ))}
          </div>
          <div className="totais" style={{ marginTop: 8 }}>
            {d.desconto > 0 && <div>{t('doc.desconto')}: − {dinheiro(d.desconto, d.moeda)}</div>}
            <div className="grande">{valorTotal}</div>
          </div>
          {d.aprovacao && (
            <div style={{ marginTop: 12 }}>
              {d.aprovacao.assinatura && <img className="assinatura" src={d.aprovacao.assinatura} alt="" />}
              <div style={{ color: 'var(--verde-forte)', fontWeight: 700 }}>{t('doc.aprovadoPor', { nome: d.aprovacao.nome, data: data(d.aprovacao.em) })}</div>
            </div>
          )}
          {d.pagoEm && <div style={{ color: 'var(--verde-forte)', fontWeight: 700, marginTop: 8 }}>{t('doc.pagoEm', { data: data(d.pagoEm) })}</div>}
        </section>

        {d.tipo === 'fatura' && d.pagamentoInformadoEm && d.status !== 'pago' && (
          <div className="faixa-aviso">{t('doc.clienteInformou', { cliente: d.cliente.nome.split(' ')[0] ?? '', data: data(d.pagamentoInformadoEm) })}</div>
        )}

        <div className="acoes">
          {d.status !== 'cancelado' && (
            <button className="botao whats" disabled={ocupado} onClick={enviarWhatsApp}>🟢 {t('doc.enviarWhatsapp')}</button>
          )}

          {aguardaCliente(d) && (
            <button className="botao secundario" disabled={ocupado} onClick={() => void comOcupado(() => conferirAprovacao())}>{t('doc.atualizarStatus')}</button>
          )}
          {d.tipo === 'orcamento' && (d.status === 'aprovado' || d.status === 'enviado' || d.status === 'rascunho') && (
            <button
              className="botao"
              disabled={ocupado}
              onClick={() => void comOcupado(async () => {
                const fat = await virarFatura(d);
                voltar();
                ir({ nome: 'documento', id: fat.id });
              })}
            >
              {t('doc.virarFatura')}
            </button>
          )}
          {d.tipo === 'orcamento' && (d.status === 'enviado' || d.status === 'rascunho') && (
            <button className="botao secundario" disabled={ocupado} onClick={() => void comOcupado(async () => setDoc(await marcarAprovado(d, d.cliente.nome)))}>{t('doc.marcarAprovado')}</button>
          )}

          {d.tipo === 'fatura' && d.status !== 'pago' && d.status !== 'cancelado' && (
            <>
              <button
                className="botao"
                disabled={ocupado}
                onClick={() => void comOcupado(async () => {
                  const { recibo } = await registrarPagamento(d);
                  voltar();
                  ir({ nome: 'documento', id: recibo.id });
                })}
              >
                ✓ {d.pagamentoInformadoEm ? t('doc.confirmarRecebimento') : t('doc.marcarPago')}
              </button>
              {(vencida || d.status === 'enviado') && (
                <button className="botao secundario" disabled={ocupado} onClick={lembrar}>{t('doc.lembrete')}</button>
              )}
            </>
          )}

          <button className="botao secundario" disabled={ocupado} onClick={compartilharPdf}>📄 {t('doc.compartilharPdf')}</button>
          {d.link && (
            <button className="botao secundario" onClick={async () => aviso((await copiarTexto(d.link!.url)) ? t('doc.linkCopiado') : d.link!.url)}>🔗 {t('doc.copiarLink')}</button>
          )}
          {d.tipo !== 'recibo' && d.status !== 'pago' && (
            <button className="botao secundario" onClick={() => ir({ nome: 'editor', id: d.id })}>✎ {t('comum.editar')}</button>
          )}
          <button className="botao perigo" onClick={excluir}>{t('comum.excluir')}</button>
        </div>
      </main>
    </>
  );
}
