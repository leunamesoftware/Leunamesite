import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ItemResumo } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { MarcaHorizontal } from '../../componentes/marca/MarcaHorizontal';
import { BotaoIcone } from '../../componentes/app/BotaoIcone';
import { CartaoItem } from '../../componentes/itens/Itens';
import { Carregando, FalhaAoCarregar, Vazio } from '../../componentes/estado-tela/EstadoTela';
import { CampoFormulario } from '../../componentes/formulario/CampoFormulario';
import { IconeFechar, IconeFiltros, IconeLupa, IconeMais } from '../../componentes/icones/Icones';
import { ehGrupo, GRUPOS, situacaoDe, type GrupoSituacao } from '../../utilitarios/situacao';
import { rotas } from '../../rotas';
import { reais } from '../../utilitarios/dinheiro';
import './TelaDocumentos.css';

// Interface 4 — Documentos e Prazos. Recriada a partir da referência visual oficial.
// As abas de tipo vêm dos tipos que a própria pessoa usou (tipo é texto livre na V1).

type Mostrar = 'todos' | 'ativo' | 'resolvido';

/** Pagos agrupados pelo mês do pagamento (mais recente primeiro), com o total pago. */
function agruparPagosPorMes(pagos: ItemResumo[]) {
  const grupos = new Map<string, ItemResumo[]>();
  for (const item of pagos) {
    const referencia = item.resolvidoEm ? new Date(item.resolvidoEm).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7) : 'sem-data';
    grupos.set(referencia, [...(grupos.get(referencia) ?? []), item]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([referencia, itens]) => ({
      referencia,
      nome:
        referencia === 'sem-data'
          ? 'data não informada'
          : new Date(`${referencia}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      itens,
      totalCentavos: itens.reduce((soma, i) => soma + (i.valorPagoCentavos ?? i.valorCentavos ?? 0), 0),
    }));
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function TelaDocumentos() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const grupo = ehGrupo(parametros.get('situacao')) ? (parametros.get('situacao') as GrupoSituacao) : null;
  // Sem filtro, mostra tudo: o que falta pagar e, embaixo, o que já foi pago (em verde, como comprovante).
  const estadoParam = parametros.get('estado');
  const estado: Mostrar = estadoParam === 'resolvido' || estadoParam === 'ativo' ? estadoParam : 'todos';

  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const lista = useCarregar(async () => {
    const [ativos, pagos] = await Promise.all([
      estado === 'resolvido' ? [] : api<ItemResumo[]>('/itens?estado=ativo'),
      estado === 'ativo' ? [] : api<ItemResumo[]>('/itens?estado=resolvido'),
    ]);
    return [...ativos, ...pagos];
  }, [api, estado]);
  const tipos = useCarregar(() => api<string[]>('/itens/tipos'), [api]);

  function mudarParametro(nome: 'situacao' | 'estado', valor: string | null) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    setParametros(novos, { replace: true });
  }

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (lista.dados ?? []).filter((item) => {
      if (grupo && (item.estado !== 'ativo' || !GRUPOS[grupo].situacoes.includes(situacaoDe(item)))) return false;
      if (tipo && item.tipo !== tipo) return false;
      if (termo && !normalizar(`${item.titulo} ${item.tipo}`).includes(termo)) return false;
      return true;
    });
  }, [lista.dados, grupo, tipo, busca]);

  const filtrando = !!(grupo || tipo || busca.trim());
  const aPagar = visiveis.filter((i) => i.estado === 'ativo');
  const meses = agruparPagosPorMes(visiveis.filter((i) => i.estado === 'resolvido'));

  return (
    <div className="tela-documentos">
      <header className="tela-documentos__topo">
        <MarcaHorizontal className="tela-documentos__marca" />
        <div className="tela-documentos__acoes">
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
          <BotaoIcone
            rotulo="Filtros"
            aria-expanded={filtrosAbertos}
            aria-controls="filtros-documentos"
            onClick={() => setFiltrosAbertos((a) => !a)}
          >
            <IconeFiltros />
          </BotaoIcone>
        </div>
      </header>

      <div className="tela-documentos__cabecalho">
        <h1 className="app-titulo">Documentos e Prazos</h1>
        <button type="button" className="tela-documentos__cadastrar" onClick={() => navegar(rotas.novoItem)}>
          <IconeMais />
          Cadastrar
        </button>
      </div>
      <p className="app-subtitulo tela-documentos__subtitulo">Aqui estão todos os seus documentos e prazos.</p>

      {buscaAberta && (
        <CampoFormulario
          id="busca-documentos"
          rotulo="Buscar por nome ou tipo"
          icone={<IconeLupa />}
          type="search"
          autoFocus
          valor={busca}
          aoMudar={setBusca}
        />
      )}

      {filtrosAbertos && (
        <div id="filtros-documentos" className="tela-documentos__filtros">
          <fieldset className="tela-documentos__grupo">
            <legend>Situação</legend>
            <div className="tela-documentos__opcoes">
              <Opcao ativa={!grupo} aoEscolher={() => mudarParametro('situacao', null)}>
                Todas
              </Opcao>
              {(Object.keys(GRUPOS) as GrupoSituacao[]).map((g) => (
                <Opcao key={g} ativa={grupo === g} aoEscolher={() => mudarParametro('situacao', g)}>
                  {GRUPOS[g].nome}
                </Opcao>
              ))}
            </div>
          </fieldset>
          <fieldset className="tela-documentos__grupo">
            <legend>Mostrar</legend>
            <div className="tela-documentos__opcoes">
              <Opcao ativa={estado === 'todos'} aoEscolher={() => mudarParametro('estado', null)}>
                Tudo
              </Opcao>
              <Opcao ativa={estado === 'ativo'} aoEscolher={() => mudarParametro('estado', 'ativo')}>
                A pagar / a vencer
              </Opcao>
              <Opcao ativa={estado === 'resolvido'} aoEscolher={() => mudarParametro('estado', 'resolvido')}>
                Em dia (pagos)
              </Opcao>
            </div>
          </fieldset>
        </div>
      )}

      {(tipos.dados?.length ?? 0) > 0 && (
        <div className="tela-documentos__abas" role="group" aria-label="Filtrar por tipo">
          <Opcao ativa={!tipo} aoEscolher={() => setTipo(null)}>
            Todos
          </Opcao>
          {tipos.dados!.map((t) => (
            <Opcao key={t} ativa={tipo === t} aoEscolher={() => setTipo(tipo === t ? null : t)}>
              {t}
            </Opcao>
          ))}
        </div>
      )}

      {(grupo || estado !== 'todos') && (
        <div className="tela-documentos__ativos">
          {estado !== 'todos' && (
            <button type="button" className="tela-documentos__etiqueta" onClick={() => mudarParametro('estado', null)}>
              {estado === 'resolvido' ? 'Em dia (pagos)' : 'A pagar / a vencer'}
              <IconeFechar />
              <span className="somente-leitor">(remover filtro)</span>
            </button>
          )}
          {grupo && (
            <button type="button" className="tela-documentos__etiqueta" onClick={() => mudarParametro('situacao', null)}>
              {GRUPOS[grupo].nome}
              <IconeFechar />
              <span className="somente-leitor">(remover filtro)</span>
            </button>
          )}
        </div>
      )}

      {lista.carregando && !lista.dados && <Carregando />}
      {lista.erro && !lista.dados && <FalhaAoCarregar mensagem={lista.erro} aoTentarDeNovo={lista.recarregar} />}

      {lista.dados && aPagar.length > 0 && (
        <ul className="tela-documentos__lista">
          {aPagar.map((item) => (
            <li key={item.id}>
              <CartaoItem item={item} />
            </li>
          ))}
        </ul>
      )}

      {lista.dados &&
        meses.map((m) => (
          <section key={m.referencia} className="tela-documentos__mes" aria-label={`Pagos em ${m.nome}`}>
            <header className="tela-documentos__mes-topo">
              <h2 className="tela-documentos__mes-titulo">Pagos em {m.nome}</h2>
              <p className="tela-documentos__mes-total">
                {m.itens.length === 1 ? '1 conta' : `${m.itens.length} contas`}
                {m.totalCentavos > 0 && <strong>{reais(m.totalCentavos)}</strong>}
              </p>
            </header>
            <ul className="tela-documentos__lista">
              {m.itens.map((item) => (
                <li key={item.id}>
                  <CartaoItem item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {lista.dados && visiveis.length === 0 && (
        <Vazio>
          {filtrando
            ? 'Nenhum item encontrado com esses filtros.'
            : estado === 'resolvido'
              ? 'Nenhum item pago ainda. Quando pagar algo, toque em "Marcar como pago" no item.'
              : 'Você ainda não cadastrou documentos ou prazos. Toque em Cadastrar para começar.'}
        </Vazio>
      )}
    </div>
  );
}

function Opcao({ ativa, aoEscolher, children }: { ativa: boolean; aoEscolher: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`opcao ${ativa ? 'opcao--ativa' : ''}`} aria-pressed={ativa} onClick={aoEscolher}>
      {children}
    </button>
  );
}
