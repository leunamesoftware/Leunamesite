import { useNavigate } from 'react-router-dom';
import type { ItemDetalhe, ItemEntrada } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { CabecalhoVoltar } from '../../componentes/app/CabecalhoVoltar';
import { FormularioItem } from '../../componentes/itens/FormularioItem';
import { ErroApi } from '../../servicos/api';
import { rotaItem } from '../../rotas';
import './TelaItem.css';

// Interface 5 — Cadastrar documento ou prazo. Recriada a partir da referência visual oficial.
export function TelaCadastrarItem() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const tipos = useCarregar(() => api<string[]>('/itens/tipos'), [api]);

  async function salvar(dados: ItemEntrada, arquivo: File | null, pagoEm: string | null) {
    const item = await api<ItemDetalhe>('/itens', { metodo: 'POST', corpo: dados });
    let aviso: string | null = null;
    if (arquivo) {
      const corpo = new FormData();
      corpo.append('arquivo', arquivo);
      try {
        await api(`/itens/${item.id}/anexos`, { metodo: 'POST', corpo });
      } catch (erro) {
        aviso = `O item foi salvo, mas o arquivo não foi anexado: ${erro instanceof ErroApi ? erro.message : 'tente de novo no detalhe do item.'}`;
      }
    }
    if (pagoEm) {
      try {
        await api(`/itens/${item.id}/resolver`, { metodo: 'POST', corpo: { pagoEm } });
      } catch (erro) {
        aviso = `O item foi salvo, mas não foi marcado como pago: ${erro instanceof ErroApi ? erro.message : 'use "Marcar como pago" no item.'}`;
      }
    }
    navegar(rotaItem(item.id), { replace: true, state: { aviso, novo: true } });
  }

  return (
    <div className="tela-item">
      <CabecalhoVoltar />
      <div>
        <h1 className="app-titulo">Cadastrar Documento ou Prazo</h1>
        <p className="app-subtitulo">Adicione um novo documento, obrigação ou prazo para acompanhar no seu Radar.</p>
      </div>
      <FormularioItem tiposSugeridos={tipos.dados ?? []} comAnexo comSituacaoPagamento textoSalvar="Salvar documento ou prazo" aoSalvar={salvar} />
    </div>
  );
}
