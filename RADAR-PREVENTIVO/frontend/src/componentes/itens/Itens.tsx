import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ItemResumo } from '@compartilhado/contratos';
import { IconeCalendario, IconeChevron, IconeDocumento } from '../icones/Icones';
import { dataBr, situacaoDe, textoPilula, textoPrazo, TOM_DA_SITUACAO, type Tom } from '../../utilitarios/situacao';
import { rotaItem } from '../../rotas';
import './Itens.css';

/** Bolinha colorida com o ícone do item: documento ou prazo. */
export function IconeItem({ natureza, tom }: { natureza: ItemResumo['natureza']; tom: Tom }) {
  return (
    <span className={`icone-item tom-${tom}`} aria-hidden="true">
      {natureza === 'prazo' ? <IconeCalendario /> : <IconeDocumento />}
    </span>
  );
}

/** Etiqueta arredondada com a situação. 'neutra' = contorno cinza-azulado. */
export function Pilula({ tom, neutra = false, children }: { tom?: Tom; neutra?: boolean; children: ReactNode }) {
  return <span className={`pilula ${neutra ? 'pilula--neutra' : `tom-${tom}`}`}>{children}</span>;
}

/** Linha usada nas seções do Radar. */
export function LinhaItem({ item, variante = 'situacao' }: { item: ItemResumo; variante?: 'situacao' | 'dias' }) {
  const situacao = situacaoDe(item);
  const tom = TOM_DA_SITUACAO[situacao];
  const dias = item.analise?.diasRestantes;
  return (
    <Link to={rotaItem(item.id)} className={`linha-item tom-${tom}`}>
      <IconeItem natureza={item.natureza} tom={tom} />
      <span className="linha-item__textos">
        <span className="linha-item__titulo">{item.titulo}</span>
        <span className={`linha-item__prazo ${variante === 'dias' ? 'linha-item__prazo--neutro' : ''}`}>{textoPrazo(item)}</span>
      </span>
      {variante === 'dias' && dias != null ? (
        <Pilula neutra>{dias === 1 ? 'Amanhã' : `Em ${dias} dias`}</Pilula>
      ) : (
        <Pilula tom={tom}>{situacao === 'vence_hoje' ? 'Vence hoje' : situacao === 'vencido' ? 'Vencido' : situacao === 'urgente' ? 'Urgente' : situacao === 'atencao' ? 'Atenção' : textoPilula(item)}</Pilula>
      )}
      <IconeChevron className="linha-item__seta" />
    </Link>
  );
}

/** Cartão usado na lista de Documentos e prazos. */
export function CartaoItem({ item }: { item: ItemResumo }) {
  const resolvido = item.estado === 'resolvido';
  const situacao = situacaoDe(item);
  const tom: Tom = resolvido ? 'verde' : TOM_DA_SITUACAO[situacao];
  const neutra = !resolvido && situacao === 'em_dia';
  const data = resolvido && item.resolvidoEm ? item.resolvidoEm.slice(0, 10) : item.dataVencimento;
  return (
    <Link to={rotaItem(item.id)} className={`cartao-item tom-${tom}`}>
      <IconeItem natureza={item.natureza} tom={tom} />
      <span className="cartao-item__textos">
        <span className="cartao-item__titulo">{item.titulo}</span>
        <span className="cartao-item__tipo">{item.tipo}</span>
      </span>
      <span className="cartao-item__prazo">
        <Pilula tom={tom} neutra={neutra}>
          {textoPilula(item)}
        </Pilula>
        {data && (
          <span className={`cartao-item__data ${neutra ? 'cartao-item__data--neutra' : ''}`}>
            {resolvido ? `pago ${dataBr(data)}` : dataBr(data)}
          </span>
        )}
      </span>
      <IconeChevron className="cartao-item__seta" />
    </Link>
  );
}
