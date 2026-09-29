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
import './TelaDocumentos.css';

// Interface 4 — Documentos e Prazos. Recriada a partir da referência visual oficial.
// As abas de tipo vêm dos tipos que a própria pessoa usou (tipo é texto livre na V1).

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function TelaDocumentos() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const grupo = ehGrupo(parametros.get('situacao')) ? (parametros.get('situacao') as GrupoSituacao) : null;
  const estado = parametros.get('estado') === 'resolvido' ? 'resolvido' : 'ativo';

  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const lista = useCarregar(() => api<ItemResumo[]>(`/itens?estado=${estado}`), [api, estado]);
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
      if (grupo && !GRUPOS[grupo].situacoes.includes(situacaoDe(item))) return false;
      if (tipo && item.tipo !== tipo) return false;
      if (termo && !normalizar(`${item.titulo} ${item.tipo}`).includes(termo)) return false;
      return true;
    });
  }, [lista.dados, grupo, tipo, busca]);

  const filtrando = !!(grupo || tipo || busca.trim());

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
              <Opcao ativa={estado === 'ativo'} aoEscolher={() => mudarParametro('estado', null)}>
                Ativos
              </Opcao>
              <Opcao ativa={estado === 'resolvido'} aoEscolher={() => mudarParametro('estado', 'resolvido')}>
                Resolvidos
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

      {(grupo || estado === 'resolvido') && (
        <div className="tela-documentos__ativos">
          {estado === 'resolvido' && (
            <button type="button" className="tela-documentos__etiqueta" onClick={() => mudarParametro('estado', null)}>
              Resolvidos
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

      {lista.dados && (
        <ul className="tela-documentos__lista">
          {visiveis.map((item) => (
            <li key={item.id}>
              <CartaoItem item={item} />
            </li>
          ))}
        </ul>
      )}

      {lista.dados && visiveis.length === 0 && (
        <Vazio>
          {filtrando
            ? 'Nenhum item encontrado com esses filtros.'
            : estado === 'resolvido'
              ? 'Nenhum item resolvido ainda.'
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
