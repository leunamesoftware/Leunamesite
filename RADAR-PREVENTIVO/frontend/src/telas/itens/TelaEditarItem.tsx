import { useNavigate, useParams } from 'react-router-dom';
import type { ItemDetalhe, ItemEntrada } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { CabecalhoVoltar } from '../../componentes/app/CabecalhoVoltar';
import { FormularioItem } from '../../componentes/itens/FormularioItem';
import { Carregando, FalhaAoCarregar } from '../../componentes/estado-tela/EstadoTela';
import { rotaItem } from '../../rotas';
import './TelaItem.css';

// Editar documento ou prazo: mesmo formulário do cadastro, já preenchido.
export function TelaEditarItem() {
  const { id = '' } = useParams();
  const { api } = useSessao();
  const navegar = useNavigate();
  const item = useCarregar(() => api<ItemDetalhe>(`/itens/${encodeURIComponent(id)}`), [api, id]);
  const tipos = useCarregar(() => api<string[]>('/itens/tipos'), [api]);

  async function salvar(dados: ItemEntrada) {
    await api<ItemDetalhe>(`/itens/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: dados });
    navegar(rotaItem(id), { replace: true });
  }

  const d = item.dados;
  return (
    <div className="tela-item">
      <CabecalhoVoltar />
      <div>
        <h1 className="app-titulo">Editar Documento ou Prazo</h1>
        <p className="app-subtitulo">Altere os dados; o Radar analisa de novo na hora.</p>
      </div>
      {item.carregando && !d && <Carregando />}
      {item.erro && !d && <FalhaAoCarregar mensagem={item.erro} aoTentarDeNovo={item.recarregar} />}
      {d && (
        <FormularioItem
          inicial={{
            natureza: d.natureza,
            titulo: d.titulo,
            tipo: d.tipo,
            descricao: d.descricao,
            dataEmissao: d.dataEmissao,
            dataVencimento: d.dataVencimento,
            antecedenciaDias: d.antecedenciaDias,
            valorCentavos: d.valorCentavos,
          }}
          tiposSugeridos={tipos.dados ?? []}
          textoSalvar="Salvar alterações"
          aoSalvar={salvar}
        />
      )}
    </div>
  );
}
