import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Anexo, ItemDetalhe } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { CabecalhoVoltar } from '../../componentes/app/CabecalhoVoltar';
import { ConfirmarDialogo, MenuAcoes } from '../../componentes/app/Dialogos';
import { AvisoErro } from '../../componentes/formulario/AvisoErro';
import { Carregando, FalhaAoCarregar } from '../../componentes/estado-tela/EstadoTela';
import { IconeItem, Pilula } from '../../componentes/itens/Itens';
import { formatarTamanho, TAMANHO_MAXIMO_ANEXO } from '../../componentes/itens/FormularioItem';
import {
  IconeCalendario,
  IconeCheck,
  IconeClipe,
  IconeComentario,
  IconeDocumento,
  IconeExclamacao,
  IconeLapis,
  IconeLixeira,
  IconeMais,
  IconeOlho,
  IconeRelogio,
  IconeSino,
} from '../../componentes/icones/Icones';
import { baixarArquivo, ErroApi } from '../../servicos/api';
import {
  dataBr,
  fraseSituacao,
  NOME_DA_SITUACAO,
  situacaoDe,
  pagoComAtraso,
  somarDiasData,
  TOM_DA_SITUACAO,
  type Tom,
  classePiscar,
  pilulaPago,
  venceLogo,
  hojeLocal,
} from '../../utilitarios/situacao';
import { rotaEditarItem, rotas } from '../../rotas';
import { reais } from '../../utilitarios/dinheiro';
import { CampoValor } from '../../componentes/formulario/CampoValor';
import './TelaDetalheItem.css';

// Interface 6 — Detalhe do item. Recriada a partir da referência visual oficial.
// Situação, orientação, anexos e histórico vêm de GET /api/itens/:id.

const ANTECEDENCIA_PADRAO = 30;

function dataHoraBr(iso: string): string {
  return dataBr(new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }));
}

export function TelaDetalheItem() {
  const { id = '' } = useParams();
  const { api, sessao } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const avisoInicial = (local.state as { aviso?: string | null } | null)?.aviso ?? null;
  const detalhe = useCarregar(() => api<ItemDetalhe>(`/itens/${encodeURIComponent(id)}`), [api, id]);
  const [aviso, setAviso] = useState<string | null>(avisoInicial);
  const [confirmar, setConfirmar] = useState<null | 'excluir' | 'resolver' | 'corrigir' | { anexo: Anexo }>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pagoEm, setPagoEm] = useState('');
  const [valorPago, setValorPago] = useState<number | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const entradaArquivo = useRef<HTMLInputElement>(null);

  const item = detalhe.dados;

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setAviso(null);
    try {
      await acao();
    } catch (erro) {
      setAviso(erro instanceof ErroApi ? erro.message : 'Não foi possível concluir. Tente de novo.');
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  const resolver = () =>
    executar(async () => {
      await api(`/itens/${encodeURIComponent(id)}/resolver`, { metodo: 'POST', corpo: { ...(pagoEm ? { pagoEm } : {}), ...(valorPago !== null ? { valorPagoCentavos: valorPago } : {}) } });
      await detalhe.recarregar();
    });

  function abrirPagamento() {
    setPagoEm(hojeLocal());
    setValorPago(detalhe.dados?.valorCentavos ?? null);
    setConfirmar('resolver');
  }

  function abrirCorrecao() {
    const d = detalhe.dados;
    setPagoEm(d?.resolvidoEm ? d.resolvidoEm.slice(0, 10) : hojeLocal());
    setValorPago(d?.valorPagoCentavos ?? d?.valorCentavos ?? null);
    setConfirmar('corrigir');
  }

  const corrigir = () =>
    executar(async () => {
      await api(`/itens/${encodeURIComponent(id)}/pagamento`, {
        metodo: 'POST',
        corpo: { ...(pagoEm ? { pagoEm } : {}), ...(valorPago !== null ? { valorPagoCentavos: valorPago } : {}) },
      });
      await detalhe.recarregar();
    });

  const excluir = () =>
    executar(async () => {
      await api(`/itens/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      navegar(rotas.documentos, { replace: true });
    });

  const excluirAnexo = (anexo: Anexo) =>
    executar(async () => {
      await api(`/anexos/${encodeURIComponent(anexo.id)}`, { metodo: 'DELETE' });
      await detalhe.recarregar();
    });

  async function visualizar(anexo: Anexo) {
    // Abre a aba já no clique (senão o navegador bloqueia) e preenche quando o arquivo chegar.
    const aba = window.open('', '_blank');
    try {
      const blob = await baixarArquivo(`/anexos/${encodeURIComponent(anexo.id)}/arquivo`, sessao?.token);
      const url = URL.createObjectURL(blob);
      if (aba) aba.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (erro) {
      aba?.close();
      setAviso(erro instanceof ErroApi ? erro.message : 'Não foi possível abrir o arquivo.');
    }
  }

  async function anexar(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
      setAviso('O arquivo passa de 10 MB.');
      return;
    }
    setEnviandoArquivo(true);
    setAviso(null);
    try {
      const corpo = new FormData();
      corpo.append('arquivo', arquivo);
      await api(`/itens/${encodeURIComponent(id)}/anexos`, { metodo: 'POST', corpo });
      await detalhe.recarregar();
    } catch (erro) {
      setAviso(erro instanceof ErroApi ? erro.message : 'Não foi possível anexar o arquivo.');
    } finally {
      setEnviandoArquivo(false);
    }
  }

  if (!item) {
    return (
      <div className="detalhe">
        <CabecalhoVoltar texto="Voltar" />
        {detalhe.carregando && <Carregando />}
        {detalhe.erro && <FalhaAoCarregar mensagem={detalhe.erro} aoTentarDeNovo={detalhe.recarregar} />}
      </div>
    );
  }

  const resolvido = item.estado === 'resolvido';
  const situacao = situacaoDe(item);
  const tom: Tom = resolvido ? 'verde' : TOM_DA_SITUACAO[situacao];
  const antecedencia = item.antecedenciaDias ?? ANTECEDENCIA_PADRAO;
  const inicioAviso = item.dataVencimento ? somarDiasData(item.dataVencimento, -antecedencia) : null;

  // Mais recente primeiro; no mesmo instante, o cadastro vem antes do alerta que ele gerou.
  const historico = [
    { data: item.criadoEm, ordem: 0, texto: `${item.natureza === 'prazo' ? 'Prazo' : 'Documento'} cadastrado.`, tom: 'azul' as Tom },
    ...item.alertas.map((a) => ({ data: a.criadoEm, ordem: 1, texto: `Alerta: ${a.mensagem}`, tom: TOM_DA_SITUACAO[a.situacao] })),
    ...(item.resolvidoEm ? [{ data: item.resolvidoEm, ordem: 2, texto: pagoComAtraso(item) ? 'Pago com atraso.' : 'Pago.', tom: 'verde' as Tom }] : []),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.ordem - a.ordem);

  const acoesMenu = [
    ...(!resolvido ? [{ nome: 'Editar', aoEscolher: () => navegar(rotaEditarItem(item.id)) }] : []),
    ...(!resolvido ? [{ nome: 'Marcar como pago', aoEscolher: abrirPagamento }] : []),
    ...(resolvido ? [{ nome: 'Corrigir pagamento', aoEscolher: abrirCorrecao }] : []),
    { nome: 'Excluir', aoEscolher: () => setConfirmar('excluir'), perigo: true },
  ];

  // Campos do pagamento, usados em "Marcar como pago" e em "Corrigir pagamento".
  const camposPagamento = (
    <>
      <label className="detalhe__pago-rotulo" htmlFor="detalhe-pago-em">
        Pago em
      </label>
      <input
        id="detalhe-pago-em"
        className="detalhe__pago-data"
        type="date"
        max={hojeLocal()}
        value={pagoEm}
        onChange={(e) => setPagoEm(e.target.value)}
      />
      <label className="detalhe__pago-rotulo" htmlFor="detalhe-valor-pago">
        Valor pago <span className="detalhe__pago-opcional">(com juros, se teve)</span>
      </label>
      <span className="detalhe__pago-valor">
        <CampoValor id="detalhe-valor-pago" valor={valorPago} aoMudar={setValorPago} />
      </span>
    </>
  );

  return (
    <div className="detalhe">
      <CabecalhoVoltar texto="Voltar" direita={<MenuAcoes rotulo="Mais ações" acoes={acoesMenu} />} />

      <section className={`detalhe__principal tom-${tom} ${classePiscar(item)}`}>
        <IconeItem natureza={item.natureza} tom={tom} />
        <div className="detalhe__identificacao">
          <h1 className="detalhe__titulo">{item.titulo}</h1>
          <p className="detalhe__tipo">{item.tipo}</p>
          {(item.valorCentavos !== null || item.valorPagoCentavos !== null) && (
            <p className="detalhe__valor">
              {item.valorCentavos !== null && <span>{reais(item.valorCentavos)}</span>}
              {resolvido && item.valorPagoCentavos !== null && <span className="detalhe__valor-pago">Pago {reais(item.valorPagoCentavos)}</span>}
            </p>
          )}
          {resolvido ? (
            <Pilula tom={pilulaPago(item).tom}>{pilulaPago(item).texto}</Pilula>
          ) : (
            <Pilula tom={tom}>{venceLogo(item) === 'amanha' ? 'Vence amanhã' : NOME_DA_SITUACAO[situacao]}</Pilula>
          )}
        </div>
        {!resolvido && (
          <button type="button" className="detalhe__editar" onClick={() => navegar(rotaEditarItem(item.id))}>
            <IconeLapis />
            Editar
          </button>
        )}
      </section>

      <AvisoErro mensagem={aviso} />

      <div className="detalhe__fichas">
        <div className={`detalhe__ficha tom-${tom}`}>
          <IconeCalendario className="detalhe__ficha-icone" />
          <div>
            <p className="detalhe__ficha-rotulo">Data de vencimento</p>
            <p className="detalhe__ficha-valor detalhe__ficha-valor--data">{item.dataVencimento ? dataBr(item.dataVencimento) : 'Sem data'}</p>
          </div>
        </div>
        <div className="detalhe__ficha">
          <IconeSino className="detalhe__ficha-icone" />
          <div>
            <p className="detalhe__ficha-rotulo">Lembrete</p>
            <p className="detalhe__ficha-valor">{antecedencia} dias antes</p>
            {inicioAviso && <p className="detalhe__ficha-extra">{dataBr(inicioAviso)}</p>}
          </div>
        </div>
        <div className="detalhe__ficha">
          <IconeDocumento className="detalhe__ficha-icone" />
          <div>
            <p className="detalhe__ficha-rotulo">Tipo</p>
            <p className="detalhe__ficha-valor">{item.natureza === 'prazo' ? 'Prazo' : 'Documento'}</p>
          </div>
        </div>
      </div>

      <section className={`detalhe__situacao tom-${tom}`}>
        <span className="detalhe__situacao-icone" aria-hidden="true">
          {resolvido ? <IconeCheck /> : situacao === 'em_dia' ? <IconeCheck /> : <IconeExclamacao />}
        </span>
        <div className="detalhe__situacao-textos">
          <h2 className="detalhe__cartao-titulo">Situação atual</h2>
          <p className="detalhe__situacao-frase">{fraseSituacao(item)}</p>
          <p className="detalhe__situacao-resumo">{item.orientacao.resumo}</p>
          {item.orientacao.passos.length > 0 && (
            <ol className="detalhe__passos">
              {item.orientacao.passos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
          <p className="detalhe__aviso">{item.orientacao.aviso}</p>
        </div>
      </section>

      {item.descricao && (
        <section className="detalhe__cartao">
          <IconeComentario className="detalhe__cartao-icone" />
          <div className="detalhe__cartao-corpo">
            <h2 className="detalhe__cartao-titulo">Observações</h2>
            <p className="detalhe__texto">{item.descricao}</p>
          </div>
        </section>
      )}

      <section className="detalhe__cartao">
        <IconeClipe className="detalhe__cartao-icone" />
        <div className="detalhe__cartao-corpo">
          <h2 className="detalhe__cartao-titulo">{item.anexos.length > 1 ? 'Arquivos anexados' : 'Arquivo anexado'}</h2>
          {item.anexos.length === 0 && <p className="detalhe__texto detalhe__texto--suave">Nenhum arquivo anexado.</p>}
          <ul className="detalhe__anexos">
            {item.anexos.map((a) => (
              <li key={a.id} className="detalhe__anexo">
                <span className={`detalhe__anexo-miniatura ${a.formato === 'application/pdf' ? 'detalhe__anexo-miniatura--pdf' : ''}`} aria-hidden="true">
                  {a.formato === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
                <span className="detalhe__anexo-textos">
                  <span className="detalhe__anexo-nome">{a.nome}</span>
                  <span className="detalhe__anexo-tamanho">{formatarTamanho(a.tamanhoBytes)}</span>
                </span>
                <button type="button" className="detalhe__visualizar" onClick={() => void visualizar(a)}>
                  <IconeOlho />
                  <span>Visualizar</span>
                </button>
                <MenuAcoes rotulo={`Ações do arquivo ${a.nome}`} className="detalhe__anexo-menu" acoes={[{ nome: 'Excluir arquivo', perigo: true, aoEscolher: () => setConfirmar({ anexo: a }) }]} />
              </li>
            ))}
          </ul>
          <input
            ref={entradaArquivo}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="somente-leitor"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void anexar(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="detalhe__anexar" onClick={() => entradaArquivo.current?.click()} disabled={enviandoArquivo}>
            <IconeMais />
            {enviandoArquivo ? 'Enviando…' : 'Anexar arquivo'}
          </button>
        </div>
      </section>

      <section className="detalhe__cartao">
        <IconeRelogio className="detalhe__cartao-icone" />
        <div className="detalhe__cartao-corpo">
          <h2 className="detalhe__cartao-titulo">Histórico</h2>
          <ol className="detalhe__historico">
            {historico.map((h, i) => (
              <li key={`${h.data}-${i}`} className={`detalhe__evento tom-${h.tom}`}>
                <span className="detalhe__evento-data">{dataHoraBr(h.data)}</span>
                <span className="detalhe__evento-texto">{h.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {!resolvido && (
        <div className="detalhe__acoes">
          <button type="button" className="detalhe__acao detalhe__acao--resolver" onClick={abrirPagamento}>
            <IconeCheck />
            Marcar como pago
          </button>
          <button type="button" className="detalhe__acao detalhe__acao--reagendar" onClick={() => navegar(rotaEditarItem(item.id))}>
            <IconeCalendario />
            Reagendar
          </button>
        </div>
      )}
      {resolvido && (
        <button type="button" className="detalhe__acao detalhe__acao--corrigir" onClick={abrirCorrecao}>
          <IconeCheck />
          {item.valorPagoCentavos === null ? 'Informar valor pago' : 'Corrigir pagamento'}
        </button>
      )}
      <button type="button" className="detalhe__acao detalhe__acao--excluir" onClick={() => setConfirmar('excluir')}>
        <IconeLixeira />
        Excluir
      </button>

      <ConfirmarDialogo
        aberto={confirmar === 'resolver'}
        titulo="Marcar como pago?"
        texto={
          <>
            <p>O item passa para Em dia e o Radar para de alertar. Ele fica guardado com todo o histórico em Documentos → Em dia (pagos).</p>
            {camposPagamento}
          </>
        }
        textoConfirmar="Marcar como pago"
        ocupado={ocupado}
        aoConfirmar={() => void resolver()}
        aoCancelar={() => setConfirmar(null)}
      />
      <ConfirmarDialogo
        aberto={confirmar === 'corrigir'}
        titulo="Corrigir pagamento"
        texto={
          <>
            <p>Informe quando pagou e quanto pagou. O valor entra nas somas do mês no Radar.</p>
            {camposPagamento}
          </>
        }
        textoConfirmar="Salvar"
        ocupado={ocupado}
        aoConfirmar={() => void corrigir()}
        aoCancelar={() => setConfirmar(null)}
      />
      <ConfirmarDialogo
        aberto={confirmar === 'excluir'}
        titulo="Excluir este item?"
        texto="O item, os alertas e os arquivos anexados serão apagados de vez. Se ele só foi pago, prefira “Marcar como pago”."
        textoConfirmar="Excluir"
        perigoso
        ocupado={ocupado}
        aoConfirmar={() => void excluir()}
        aoCancelar={() => setConfirmar(null)}
      />
      <ConfirmarDialogo
        aberto={typeof confirmar === 'object' && confirmar !== null}
        titulo="Excluir arquivo?"
        texto={typeof confirmar === 'object' && confirmar ? `“${confirmar.anexo.nome}” será apagado de vez.` : ''}
        textoConfirmar="Excluir arquivo"
        perigoso
        ocupado={ocupado}
        aoConfirmar={() => typeof confirmar === 'object' && confirmar && void excluirAnexo(confirmar.anexo)}
        aoCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
