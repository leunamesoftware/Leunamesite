import { FAIXAS, type Analise, type Natureza, type Orientacao, type Prioridade, type Situacao } from '../../../../compartilhado/contratos.js';

/**
 * ORIENTAR: monta o "o que fazer" automaticamente, a partir do resultado da análise
 * e dos dados do item. Não depende de texto escrito à mão por ninguém.
 */

export const AVISO_ORIENTACAO =
  'Orientação preventiva gerada automaticamente a partir das datas informadas. Não substitui o profissional responsável (contador, advogado ou órgão emissor).';

export interface DadosParaOrientacao {
  natureza: Natureza;
  titulo: string;
  dataVencimento: string | null;
  antecedenciaDias: number | null;
  estado: 'ativo' | 'resolvido' | 'arquivado';
  resolvidoEm: string | null;
}

const PRIORIDADE: Record<Situacao, Prioridade> = {
  sem_prazo: 'pendente',
  em_dia: 'baixa',
  atencao: 'media',
  urgente: 'alta',
  vence_hoje: 'critica',
  vencido: 'critica',
};

export const dataBr = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
export const dias = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

export function gerarOrientacao(item: DadosParaOrientacao, analise: Analise): Orientacao {
  const t = `"${item.titulo}"`;
  const doc = item.natureza === 'documento';
  const data = item.dataVencimento ? dataBr(item.dataVencimento) : '';
  const n = analise.diasRestantes ?? 0;

  if (item.estado === 'resolvido') {
    return {
      resumo: `${t} foi resolvido${item.resolvidoEm ? ` em ${dataBr(item.resolvidoEm.slice(0, 10))}` : ''}.`,
      prioridade: 'baixa',
      passos: ['Nenhuma ação necessária. O registro e os alertas ficam guardados no histórico.'],
      aviso: AVISO_ORIENTACAO,
    };
  }

  const regras: Record<Situacao, () => { resumo: string; passos: string[] }> = {
    sem_prazo: () => ({
      resumo: `${t} está sem data de vencimento.`,
      passos: [
        doc
          ? 'Confira no próprio documento qual é a data de validade.'
          : 'Confira qual é a data-limite deste prazo (no contrato, boleto, notificação ou comunicado).',
        'Edite este item e informe a data de vencimento.',
        'Com a data informada, o Radar passa a acompanhar e a avisar você.',
      ],
    }),
    em_dia: () => ({
      resumo: `${t} está em dia. Vence em ${dias(n)} (${data}).`,
      passos: [
        'Nenhuma ação necessária agora.',
        `O Radar vai avisar quando faltarem ${dias(item.antecedenciaDias ?? FAIXAS.atencaoDias)} para o vencimento.`,
      ],
    }),
    atencao: () => ({
      resumo: `${t} vence em ${dias(n)} (${data}).`,
      passos: doc
        ? [
            'Comece a se organizar: verifique o que é exigido para renovar este documento junto ao órgão ou à empresa responsável.',
            'Separe com antecedência os documentos e valores que forem necessários.',
            'Depois de renovar, atualize aqui a nova data de vencimento.',
          ]
        : [
            'Planeje quando e como vai cumprir este prazo.',
            'Separe com antecedência os documentos e valores que forem necessários.',
            'Quando concluir, marque o item como resolvido.',
          ],
    }),
    urgente: () => ({
      resumo: `${t} vence em ${dias(n)} (${data}). É urgente.`,
      passos: doc
        ? [
            `Providencie a renovação o quanto antes — faltam só ${dias(n)}.`,
            'Verifique os requisitos com o órgão ou a empresa responsável e agende o atendimento, se for preciso.',
            'Depois de renovar, atualize aqui a nova data de vencimento.',
          ]
        : [
            `Resolva nos próximos dias — o limite é ${data}.`,
            'Se não for possível cumprir no prazo, procure o responsável para negociar ou pedir mais prazo.',
            'Quando concluir, marque o item como resolvido.',
          ],
    }),
    vence_hoje: () => ({
      resumo: `${t} vence hoje (${data}).`,
      passos: doc
        ? [
            'Hoje é o último dia de validade deste documento.',
            'Se ainda não renovou, providencie a renovação imediatamente.',
            'Depois de renovar, atualize aqui a nova data de vencimento.',
          ]
        : [
            'Hoje é o último dia para cumprir este prazo.',
            'Conclua hoje para evitar multa, juros ou outras consequências.',
            'Quando concluir, marque o item como resolvido.',
          ],
    }),
    vencido: () => ({
      resumo: `${t} venceu há ${dias(Math.abs(n))} (${data}).`,
      passos: doc
        ? [
            'Um documento vencido pode deixar de valer. Regularize o quanto antes.',
            'Verifique com o órgão ou a empresa responsável como renovar e se há multa ou exigência adicional.',
            'Depois de renovar, atualize aqui a nova data de vencimento.',
          ]
        : [
            'O prazo passou. Regularize o quanto antes para limitar multa, juros ou outras consequências.',
            'Procure o responsável para saber como regularizar.',
            'Quando resolver, marque o item como resolvido para o Radar parar de alertar.',
          ],
    }),
  };

  const { resumo, passos } = regras[analise.situacao]();
  return { resumo, prioridade: PRIORIDADE[analise.situacao], passos, aviso: AVISO_ORIENTACAO };
}
