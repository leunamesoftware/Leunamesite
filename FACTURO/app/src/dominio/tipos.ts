// Modelo de dados do Facturo. Todo valor em dinheiro é guardado em CENTAVOS (inteiro)
// para não ter erro de arredondamento. Todo registro tem id único e atualizadoEm,
// para no futuro sincronizar com a nuvem sem refazer nada.

export type Id = string;

export interface Registro {
  id: Id;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export type FormaPagamento = 'pix' | 'link' | 'banco';

export interface Negocio extends Registro {
  nome: string;
  documento: string; // CPF/CNPJ, NIF, Tax ID…
  telefone: string;
  email: string;
  endereco: string;
  logo: string | null; // data URL (PNG/JPEG) reduzido
  cor: string; // cor principal dos documentos
  pais: string; // ISO 3166-1 alfa-2 (BR, US, PT…)
  moeda: string; // ISO 4217 (BRL, USD, EUR…)
  idioma: string; // pt-BR, en, es
  profissao: string; // id do modelo de profissão
  pagamento: {
    pixChave: string;
    pixCidade: string;
    link: string; // PayPal, Wise, Stripe, Mercado Pago…
    banco: string; // dados bancários em texto livre
  };
  validadePadraoDias: number;
  observacaoPadrao: string;
}

export interface Cliente extends Registro {
  nome: string;
  telefone: string;
  email: string;
  documento: string;
  endereco: string;
}

export interface Item extends Registro {
  nome: string;
  unidade: string; // un, h, m², serviço…
  preco: number; // centavos
}

export type TipoDocumento = 'orcamento' | 'fatura' | 'recibo';

export type StatusDocumento =
  | 'rascunho'
  | 'enviado'
  | 'aprovado'
  | 'recusado'
  | 'pago'
  | 'cancelado';

export interface LinhaDocumento {
  itemId: Id | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number; // centavos
}

export interface Aprovacao {
  nome: string;
  assinatura: string | null; // data URL PNG
  em: string; // ISO
}

export interface LinkCompartilhado {
  id: string; // aparece na URL
  chaveDono: string; // só o app sabe; consulta o status
  url: string;
  criadoEm: string;
}

export interface Documento extends Registro {
  tipo: TipoDocumento;
  numero: number;
  clienteId: Id | null;
  cliente: Pick<Cliente, 'nome' | 'telefone' | 'email' | 'documento' | 'endereco'>;
  linhas: LinhaDocumento[];
  desconto: number; // centavos
  observacoes: string;
  emitidoEm: string; // ISO (data)
  validoAte: string | null; // orçamento
  venceEm: string | null; // fatura
  status: StatusDocumento;
  moeda: string;
  origemId: Id | null; // fatura criada a partir do orçamento; recibo a partir da fatura
  link: LinkCompartilhado | null;
  aprovacao: Aprovacao | null;
  pagoEm: string | null;
}
