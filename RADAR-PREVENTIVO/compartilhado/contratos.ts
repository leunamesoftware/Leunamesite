/**
 * Contrato entre a interface (frontend) e a API (backend) do Radar Preventivo.
 * Os dois lados importam este arquivo, então o formato dos dados é sempre o mesmo.
 */

// ---------- valores fixos ----------

export type TipoConta = 'pessoa' | 'empresa';
export type Papel = 'usuario' | 'administrador';

/** Documento (tem validade) ou prazo (tem data-limite para algo ser feito). */
export type Natureza = 'documento' | 'prazo';

export type EstadoItem = 'ativo' | 'resolvido' | 'arquivado';

export type OrigemDados = 'manual' | 'automatica';

/** Situação calculada pela análise. */
export type Situacao = 'sem_prazo' | 'em_dia' | 'atencao' | 'urgente' | 'vence_hoje' | 'vencido';

export type Pendencia = 'sem_data_vencimento';

export type MotivoAlerta = 'mudou_situacao' | 'lembrete_vencido';

export type Prioridade = 'pendente' | 'baixa' | 'media' | 'alta' | 'critica';

/** Faixas aprovadas para a V1. */
export const FAIXAS = {
  /** A partir de quantos dias antes do vencimento o item entra em "Atenção" (padrão). */
  atencaoDias: 30,
  /** A partir de quantos dias antes do vencimento o item entra em "Urgente". */
  urgenteDias: 7,
  /** De quantos em quantos dias um item vencido e não resolvido gera novo lembrete. */
  lembreteVencidoDias: 7,
} as const;

// ---------- respostas da API ----------

export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: CodigoErro; mensagem: string; campos?: Record<string, string> };

export type CodigoErro =
  | 'dados_invalidos'
  | 'nao_autenticado'
  | 'sem_permissao'
  | 'nao_encontrado'
  | 'email_ja_cadastrado'
  | 'credenciais_invalidas'
  | 'muitas_tentativas'
  | 'senha_atual_incorreta'
  | 'senha_incorreta'
  | 'arquivo_invalido'
  | 'arquivo_grande_demais'
  | 'item_resolvido'
  | 'item_nao_pago'
  | 'erro_interno';

// ---------- conta ----------

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipoConta: TipoConta;
  papel: Papel;
  criadoEm: string;
}

export interface CadastroEntrada {
  nome: string;
  email: string;
  senha: string;
  tipoConta: TipoConta;
}

export interface EntrarEntrada {
  email: string;
  senha: string;
}

export interface SessaoCriada {
  token: string;
  expiraEm: string;
  usuario: Usuario;
}

export interface AtualizarContaEntrada {
  nome?: string;
  tipoConta?: TipoConta;
}

export interface TrocarSenhaEntrada {
  senhaAtual: string;
  novaSenha: string;
}

// ---------- itens (documentos e prazos) ----------

export interface ItemEntrada {
  natureza: Natureza;
  titulo: string;
  /** Texto livre: "CNH", "Alvará", "Contrato de aluguel"... */
  tipo: string;
  descricao?: string | null;
  /** AAAA-MM-DD */
  dataEmissao?: string | null;
  /** AAAA-MM-DD */
  dataVencimento?: string | null;
  /** Substitui os 30 dias padrão da faixa "Atenção" só neste item. */
  antecedenciaDias?: number | null;
  /** Valor a pagar, em centavos (R$ 12,34 = 1234). Opcional. */
  valorCentavos?: number | null;
}

export interface Analise {
  situacao: Situacao;
  /** Dias até o vencimento (negativo = dias de atraso). Nulo quando não há data. */
  diasRestantes: number | null;
  pendencias: Pendencia[];
  analisadoEm: string;
  versaoRegras: string;
}

export interface Orientacao {
  resumo: string;
  prioridade: Prioridade;
  passos: string[];
  aviso: string;
}

export interface Anexo {
  id: string;
  nome: string;
  formato: string;
  tamanhoBytes: number;
  situacaoLeitura: 'nao_processado';
  criadoEm: string;
}

export interface ItemResumo {
  id: string;
  natureza: Natureza;
  titulo: string;
  tipo: string;
  dataVencimento: string | null;
  estado: EstadoItem;
  resolvidoEm: string | null;
  /** Valor a pagar, em centavos. */
  valorCentavos: number | null;
  /** Quanto foi pago (com juros, se houve), em centavos. Só em itens pagos. */
  valorPagoCentavos: number | null;
  analise: Analise | null;
  quantidadeAnexos: number;
  atualizadoEm: string;
}

export interface ItemDetalhe extends ItemResumo {
  descricao: string | null;
  dataEmissao: string | null;
  antecedenciaDias: number | null;
  origemDados: OrigemDados;
  criadoEm: string;
  orientacao: Orientacao;
  anexos: Anexo[];
  alertas: Alerta[];
}

export interface FiltroItens {
  situacao?: Situacao;
  estado?: EstadoItem;
  busca?: string;
}

// ---------- alertas ----------

export interface Alerta {
  id: string;
  itemId: string;
  itemTitulo: string;
  itemNatureza: Natureza;
  /** Vencimento atual do item (AAAA-MM-DD), para mostrar junto do alerta. */
  itemDataVencimento: string | null;
  motivo: MotivoAlerta;
  situacao: Situacao;
  mensagem: string;
  criadoEm: string;
  lidoEm: string | null;
  resolvidoEm: string | null;
}

// ---------- painel do radar ----------

export interface ResumoRadar {
  contagem: Record<Situacao, number>;
  totalAtivos: number;
  totalResolvidos: number;
  /** Vencidos, vence hoje, urgentes e em atenção — do mais grave ao menos grave. */
  atencaoAgora: ItemResumo[];
  /** Próximos vencimentos ainda em dia (ativos, ordenados pela data, até 5). */
  proximos: ItemResumo[];
  /** Itens com alguma pendência de cadastro. */
  pendencias: ItemResumo[];
  /** Últimos itens pagos (do mais recente), inclusive os pagos com atraso. Até 5. */
  pagosRecentes: ItemResumo[];
  alertasNaoLidos: number;
  financeiro: ResumoFinanceiro;
}

export interface TotalContas {
  quantidade: number;
  totalCentavos: number;
}

/** Somas dos valores informados. Itens sem valor não entram nas somas. */
export interface ResumoFinanceiro {
  /** Contas ainda não pagas que vencem de hoje em diante, somadas por data (até 5 datas). */
  porData: (TotalContas & { data: string })[];
  /** Contas vencidas e ainda não pagas. */
  emAtraso: TotalContas;
  /** Mês atual (AAAA-MM): quanto já foi pago e quanto falta pagar do que vence no mês.
   *  pago.quantidade conta todas as contas pagas no mês; pagoSemValor, as que foram pagas sem valor informado. */
  mes: { referencia: string; pago: TotalContas; pagoSemValor: number; aPagar: TotalContas };
  /** Contas ativas com data e sem valor informado (ficam fora das somas). */
  semValor: number;
}
