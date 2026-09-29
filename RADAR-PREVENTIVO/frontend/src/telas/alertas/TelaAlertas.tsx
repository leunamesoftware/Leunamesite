import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alerta, ItemResumo, Situacao } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { useAlertasNaoLidos } from '../../componentes/app/LayoutApp';
import { MarcaHorizontal } from '../../componentes/marca/MarcaHorizontal';
import { BotaoIcone } from '../../componentes/app/BotaoIcone';
import { RadarVivo } from '../../componentes/radar/RadarVivo';
import { CampoFormulario } from '../../componentes/formulario/CampoFormulario';
import { Carregando, FalhaAoCarregar, Vazio } from '../../componentes/estado-tela/EstadoTela';
import { AvisoErro } from '../../componentes/formulario/AvisoErro';
import {
  IconeCalendario,
  IconeChevron,
  IconeDocumento,
  IconeExclamacao,
  IconeFiltros,
  IconeLupa,
  IconeRelogio,
  IconeTriangulo,
} from '../../componentes/icones/Icones';
import { ErroApi } from '../../servicos/api';
import { dataBr, TOM_DA_SITUACAO } from '../../utilitarios/situacao';
import { rotaItem } from '../../rotas';
import './TelaAlertas.css';

// Interface 7 — Alertas. Recriada a partir da referência visual oficial, com o
// radar animado no topo. Alertas e itens vêm do backend.

type Filtro = 'todos' | 'vencidos' | 'urgentes' | 'atencao';

const FILTROS: { id: Filtro; nome: string; situacoes: Situacao[]; Icone?: typeof IconeExclamacao; tom?: string }[] = [
  { id: 'todos', nome: 'Todos', situacoes: [] },
  { id: 'vencidos', nome: 'Vencidos', situacoes: ['vencido'], Icone: IconeExclamacao, tom: 'vermelho' },
  { id: 'urgentes', nome: 'Urgentes', situacoes: ['vence_hoje', 'urgente'], Icone: IconeRelogio, tom: 'laranja' },
  { id: 'atencao', nome: 'Em atenção', situacoes: ['atencao'], Icone: IconeTriangulo, tom: 'amarelo' },
];

function tituloDoAlerta(a: Alerta): string {
  if (a.motivo === 'lembrete_vencido') return `Lembrete: ${a.itemTitulo} vencido`;
  switch (a.situacao) {
    case 'vencido':
      return `${a.itemTitulo} vencido`;
    case 'vence_hoje':
      return `${a.itemTitulo} vence hoje`;
    case 'urgente':
      return `${a.itemTitulo} está urgente`;
    case 'atencao':
      return `${a.itemTitulo} pede atenção`;
    default:
      return a.itemTitulo;
  }
}

function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return horas === 1 ? 'há 1 hora' : `há ${horas} horas`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

function diaLocal(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function grupoDe(iso: string, agora: number): 'Hoje' | 'Esta semana' | 'Mais antigos' {
  const hoje = diaLocal(new Date(agora));
  const dia = diaLocal(new Date(iso));
  if (dia === hoje) return 'Hoje';
  if (agora - new Date(iso).getTime() < 7 * 86_400_000) return 'Esta semana';
  return 'Mais antigos';
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function TelaAlertas() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const { atualizar: atualizarContagem } = useAlertasNaoLidos();
  const alertas = useCarregar(() => api<Alerta[]>('/alertas'), [api]);
  const itens = useCarregar(() => api<ItemResumo[]>('/itens?estado=ativo'), [api]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [soNaoLidos, setSoNaoLidos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const agora = Date.now();

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const situacoes = FILTROS.find((f) => f.id === filtro)!.situacoes;
    return (alertas.dados ?? []).filter((a) => {
      if (situacoes.length && !situacoes.includes(a.situacao)) return false;
      if (soNaoLidos && a.lidoEm) return false;
      if (termo && !normalizar(`${a.itemTitulo} ${a.mensagem}`).includes(termo)) return false;
      return true;
    });
  }, [alertas.dados, filtro, busca, soNaoLidos]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Alerta[]>();
    for (const a of visiveis) {
      const g = grupoDe(a.criadoEm, agora);
      mapa.set(g, [...(mapa.get(g) ?? []), a]);
    }
    return (['Hoje', 'Esta semana', 'Mais antigos'] as const).filter((g) => mapa.has(g)).map((g) => ({ nome: g, alertas: mapa.get(g)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis]);

  async function abrir(a: Alerta) {
    if (!a.lidoEm) {
      await api(`/alertas/${encodeURIComponent(a.id)}/lido`, { metodo: 'POST' }).catch(() => undefined);
      atualizarContagem();
    }
    navegar(rotaItem(a.itemId));
  }

  async function marcarTodos() {
    setAviso(null);
    try {
      await api('/alertas/lidos', { metodo: 'POST' });
      atualizarContagem();
      await alertas.recarregar();
    } catch (erro) {
      setAviso(erro instanceof ErroApi ? erro.message : 'Não foi possível marcar os alertas.');
    }
  }

  const naoLidos = (alertas.dados ?? []).filter((a) => !a.lidoEm).length;

  return (
    <div className="tela-alertas">
      <header className="tela-alertas__topo">
        <MarcaHorizontal className="tela-alertas__marca" />
        <div className="tela-alertas__acoes">
          <BotaoIcone
            rotulo="Buscar"
            aria-pressed={buscaAberta}
            onClick={() => {
              setBuscaAberta((a) => !a);
              if (buscaAberta) setBusca('');
            }}
          >
            <IconeLupa />
          </BotaoIcone>
          <BotaoIcone rotulo="Opções" aria-expanded={painelAberto} aria-controls="opcoes-alertas" onClick={() => setPainelAberto((a) => !a)}>
            <IconeFiltros />
          </BotaoIcone>
        </div>
      </header>

      <div>
        <h1 className="app-titulo">Alertas</h1>
        <p className="app-subtitulo">Aqui ficam todos os seus alertas e notificações.</p>
      </div>

      {itens.dados && <RadarVivo itens={itens.dados} />}

      {buscaAberta && (
        <CampoFormulario id="busca-alertas" rotulo="Buscar nos alertas" icone={<IconeLupa />} type="search" autoFocus valor={busca} aoMudar={setBusca} />
      )}

      {painelAberto && (
        <div id="opcoes-alertas" className="tela-alertas__painel">
          <div className="tela-alertas__alternar" role="group" aria-label="Mostrar">
            <button type="button" className={`opcao ${!soNaoLidos ? 'opcao--ativa' : ''}`} aria-pressed={!soNaoLidos} onClick={() => setSoNaoLidos(false)}>
              Todos
            </button>
            <button type="button" className={`opcao ${soNaoLidos ? 'opcao--ativa' : ''}`} aria-pressed={soNaoLidos} onClick={() => setSoNaoLidos(true)}>
              Não lidos ({naoLidos})
            </button>
          </div>
          <button type="button" className="tela-alertas__marcar" onClick={() => void marcarTodos()} disabled={naoLidos === 0}>
            Marcar todos como lidos
          </button>
        </div>
      )}

      <div className="tela-alertas__filtros" role="group" aria-label="Filtrar alertas">
        {FILTROS.map(({ id, nome, Icone, tom }) => (
          <button
            key={id}
            type="button"
            className={`opcao tela-alertas__filtro ${filtro === id ? 'opcao--ativa' : ''} ${tom ? `tom-${tom}` : ''}`}
            aria-pressed={filtro === id}
            onClick={() => setFiltro(id)}
          >
            {Icone && (
              <span className="tela-alertas__filtro-icone" aria-hidden="true">
                <Icone />
              </span>
            )}
            {nome}
          </button>
        ))}
      </div>

      <AvisoErro mensagem={aviso} />

      {alertas.carregando && !alertas.dados && <Carregando />}
      {alertas.erro && !alertas.dados && <FalhaAoCarregar mensagem={alertas.erro} aoTentarDeNovo={alertas.recarregar} />}

      {alertas.dados && visiveis.length === 0 && (
        <Vazio>
          {alertas.dados.length === 0
            ? 'Nenhum alerta por enquanto. Quando algo se aproximar do vencimento, ele aparece aqui.'
            : 'Nenhum alerta com esses filtros.'}
        </Vazio>
      )}

      {grupos.map((g) => (
        <section key={g.nome} className="tela-alertas__grupo">
          <h2 className="tela-alertas__grupo-titulo">{g.nome}</h2>
          <ul className="tela-alertas__lista">
            {g.alertas.map((a) => {
              const tom = a.resolvidoEm ? 'verde' : TOM_DA_SITUACAO[a.situacao];
              return (
                <li key={a.id}>
                  <button type="button" className={`cartao-alerta tom-${tom} ${a.lidoEm ? '' : 'cartao-alerta--novo'}`} onClick={() => void abrir(a)}>
                    <span className={`icone-item tom-${tom}`} aria-hidden="true">
                      {a.itemNatureza === 'prazo' ? <IconeCalendario /> : <IconeDocumento />}
                    </span>
                    <span className="cartao-alerta__textos">
                      <span className="cartao-alerta__titulo">{tituloDoAlerta(a)}</span>
                      <span className="cartao-alerta__mensagem">{a.mensagem}</span>
                      {a.resolvidoEm && <span className="cartao-alerta__resolvido">Pago</span>}
                    </span>
                    <span className="cartao-alerta__quando">
                      {a.itemDataVencimento && <span className="cartao-alerta__data">{dataBr(a.itemDataVencimento)}</span>}
                      <span className="cartao-alerta__ha">{haQuanto(a.criadoEm, agora)}</span>
                    </span>
                    <IconeChevron className="cartao-alerta__seta" />
                    {!a.lidoEm && <span className="cartao-alerta__ponto" aria-label="não lido" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
