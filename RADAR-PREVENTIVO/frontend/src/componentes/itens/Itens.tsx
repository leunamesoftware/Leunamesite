import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ItemResumo } from '@compartilhado/contratos';
import { IconeCalendario, IconeChevron, IconeDocumento } from '../icones/Icones';
import { classePiscar, dataBr, pagoComAtraso, situacaoDe, textoPilula, textoPrazo, TOM_DA_SITUACAO, type Tom } from '../../utilitarios/situacao';
import { rotaItem } from '../../rotas';
import { reais } from '../../utilitarios/dinheiro';
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
  if (item.estado === 'resolvido') return <LinhaPago item={item} />;
  const situacao = situacaoDe(item);
  const tom = TOM_DA_SITUACAO[situacao];
  const dias = item.analise?.diasRestantes;
  return (
    <Link to={rotaItem(item.id)} className={`linha-item tom-${tom} ${classePiscar(item)}`}>
      <IconeItem natureza={item.natureza} tom={tom} />
      <span className="linha-item__textos">
        <span className="linha-item__titulo">{item.titulo}</span>
        <span className={`linha-item__prazo ${variante === 'dias' ? 'linha-item__prazo--neutro' : ''}`}>{textoPrazo(item)}</span>
        {item.valorCentavos !== null && <span className="item-valor">{reais(item.valorCentavos)}</span>}
      </span>
      {variante === 'dias' && dias != null ? (
        <Pilula neutra>{dias === 1 ? 'Amanhã' : `Em ${dias} dias`}</Pilula>
      ) : (
        <Pilula tom={tom}>{situacao === 'vence_hoje' ? 'Vence hoje' : situacao === 'vencido' ? 'Vencido' : situacao === 'urgente' ? (dias === 1 ? 'Vence amanhã' : 'Urgente') : situacao === 'atencao' ? 'Atenção' : textoPilula(item)}</Pilula>
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
    <Link to={rotaItem(item.id)} className={`cartao-item tom-${tom} ${classePiscar(item)}`}>
      <IconeItem natureza={item.natureza} tom={tom} />
      <span className="cartao-item__textos">
        <span className="cartao-item__titulo">{item.titulo}</span>
        <span className="cartao-item__tipo">{item.tipo}</span>
        <ValorDoItem item={item} />
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

/** Valor da conta; se já foi paga, o valor pago (com juros, se houve). */
function ValorDoItem({ item }: { item: ItemResumo }) {
  if (item.estado === 'resolvido' && item.valorPagoCentavos !== null) {
    return <span className="item-valor item-valor--pago">Pago {reais(item.valorPagoCentavos)}</span>;
  }
  if (item.valorCentavos === null) return null;
  return <span className="item-valor">{reais(item.valorCentavos)}</span>;
}

/** Linha de um item já pago (verde). Se venceu antes de ser pago, mostra "Pago com atraso". */
function LinhaPago({ item }: { item: ItemResumo }) {
  const atraso = pagoComAtraso(item);
  const pago = item.resolvidoEm ? dataBr(item.resolvidoEm.slice(0, 10)) : null;
  const valor = item.valorPagoCentavos ?? item.valorCentavos;
  return (
    <Link to={rotaItem(item.id)} className="linha-item tom-verde">
      <IconeItem natureza={item.natureza} tom="verde" />
      <span className="linha-item__textos">
        <span className="linha-item__titulo">{item.titulo}</span>
        <span className="linha-item__prazo">
          {atraso && item.dataVencimento ? `Venceu ${dataBr(item.dataVencimento)} · pago ${pago}` : pago ? `Pago em ${pago}` : 'Pago'}
        </span>
        {valor !== null && <span className="item-valor item-valor--pago">{reais(valor)}</span>}
      </span>
      <Pilula tom="verde">{atraso ? 'Pago com atraso' : 'Pago em dia'}</Pilula>
      <IconeChevron className="linha-item__seta" />
    </Link>
  );
}
