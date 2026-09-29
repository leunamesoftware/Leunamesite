import { Link } from 'react-router-dom';
import type { ResumoFinanceiro, TotalContas } from '@compartilhado/contratos';
import { Vazio } from '../estado-tela/EstadoTela';
import { reais } from '../../utilitarios/dinheiro';
import { dataBr, hojeLocal, somarDiasData } from '../../utilitarios/situacao';
import { rotaDocumentos, rotaPagos } from '../../rotas';
import './ResumoContas.css';

// Somas dos valores informados nas contas: quanto pagar em cada dia, o que está
// em atraso e o fechamento do mês (quanto já pagou e quanto ainda falta).

const contas = (n: number) => (n === 1 ? '1 conta' : `${n} contas`);

function nomeDoDia(data: string, hoje: string): string {
  if (data === hoje) return 'Hoje';
  if (data === somarDiasData(hoje, 1)) return 'Amanhã';
  const semana = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dataBr(data).slice(0, 5)} (${semana})`;
}

function nomeDoMes(referencia: string): string {
  const nome = new Date(`${referencia}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function Linha({ rotulo, total, tom, para }: { rotulo: string; total: TotalContas; tom?: string; para?: string }) {
  const conteudo = (
    <>
      <span className="resumo-contas__rotulo">
        {rotulo}
        <span className="resumo-contas__quantidade">{contas(total.quantidade)}</span>
      </span>
      <span className="resumo-contas__total">{reais(total.totalCentavos)}</span>
    </>
  );
  const classe = `resumo-contas__linha ${tom ? `resumo-contas__linha--${tom}` : ''}`;
  return para ? (
    <Link to={para} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

export function ResumoContas({ financeiro: f }: { financeiro: ResumoFinanceiro }) {
  const hoje = hojeLocal();
  const temAlgo = f.porData.length > 0 || f.emAtraso.quantidade > 0 || f.mes.pago.quantidade > 0 || f.mes.aPagar.quantidade > 0;
  if (!temAlgo) {
    return <Vazio>Informe o valor das contas para ver quanto pagar em cada dia e quanto você pagou no mês.</Vazio>;
  }
  return (
    <div className="resumo-contas">
      {f.emAtraso.quantidade > 0 && <Linha rotulo="Em atraso" total={f.emAtraso} tom="atraso" para={rotaDocumentos('vencidos')} />}
      {f.porData.map((d) => (
        <Linha key={d.data} rotulo={nomeDoDia(d.data, hoje)} total={d} tom={d.data === hoje ? 'hoje' : undefined} />
      ))}

      <div className="resumo-contas__mes">
        <p className="resumo-contas__mes-titulo">{nomeDoMes(f.mes.referencia)}</p>
        <Link to={rotaPagos} className="resumo-contas__mes-item resumo-contas__mes-item--pago">
          <span>Pago no mês</span>
          <strong>{reais(f.mes.pago.totalCentavos)}</strong>
          <span className="resumo-contas__quantidade">{contas(f.mes.pago.quantidade)}</span>
        </Link>
        <div className="resumo-contas__mes-item">
          <span>Falta pagar no mês</span>
          <strong>{reais(f.mes.aPagar.totalCentavos)}</strong>
          <span className="resumo-contas__quantidade">{contas(f.mes.aPagar.quantidade)}</span>
        </div>
      </div>

      {f.semValor > 0 && (
        <p className="resumo-contas__aviso">
          {f.semValor === 1 ? '1 conta está sem valor e fica fora das somas.' : `${f.semValor} contas estão sem valor e ficam fora das somas.`}
        </p>
      )}
    </div>
  );
}
