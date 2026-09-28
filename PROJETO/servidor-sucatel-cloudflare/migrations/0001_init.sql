-- Sucatel — esquema inicial (Cloudflare D1).
-- Marketplace de peças de celular usadas/sucata, com anúncio pago por
-- crédito (R$5 = 1 crédito = 1 anúncio por 30 dias) e busca filtrada por
-- bairro (a entrega é sempre presencial, então região importa muito).

CREATE TABLE IF NOT EXISTS estados (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cidades (
  id TEXT PRIMARY KEY,
  estado_id TEXT NOT NULL REFERENCES estados(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bairros (
  id TEXT PRIMARY KEY,
  cidade_id TEXT NOT NULL REFERENCES cidades(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  senha_hash TEXT NOT NULL,
  bairro_id TEXT REFERENCES bairros(id),
  saldo_creditos INTEGER NOT NULL DEFAULT 0,
  vendas_confirmadas_total INTEGER NOT NULL DEFAULT 0,
  reputacao INTEGER NOT NULL DEFAULT 100,
  is_admin INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em TEXT NOT NULL,
  revogada_em TEXT
);

-- Limite basico de tentativas de login/cadastro (protecao obrigatoria).
CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  kind TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Marca > Modelo > Tipo de peça -- garante que só dá pra anunciar peça de
-- celular de verdade (não existe opção pra outra coisa, é dropdown fechado).
CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modelos (
  id TEXT PRIMARY KEY,
  marca_id TEXT NOT NULL REFERENCES marcas(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tipos_peca (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS anuncios (
  id TEXT PRIMARY KEY,
  vendedor_id TEXT NOT NULL REFERENCES users(id),
  marca_id TEXT NOT NULL REFERENCES marcas(id),
  modelo_id TEXT NOT NULL REFERENCES modelos(id),
  tipo_peca_id TEXT NOT NULL REFERENCES tipos_peca(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_centavos INTEGER NOT NULL,
  fotos TEXT NOT NULL DEFAULT '[]',
  bairro_id TEXT NOT NULL REFERENCES bairros(id),
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | pausado_manual | expirado | removido_admin
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em TEXT NOT NULL,
  renovado_de TEXT REFERENCES anuncios(id) -- aponta pro anuncio anterior, se for renovacao
);

-- Cada venda confirmada pelo vendedor sob um anuncio (nao remove o anuncio,
-- so registra -- o mesmo anuncio pode ter varias vendas nos 30 dias).
CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  anuncio_id TEXT NOT NULL REFERENCES anuncios(id),
  vendedor_id TEXT NOT NULL REFERENCES users(id),
  confirmado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Compra de creditos via Pix (Asaas). 1 credito = R$5, liberado
-- automaticamente quando o webhook confirmar o pagamento.
CREATE TABLE IF NOT EXISTS pagamentos_creditos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  quantidade_creditos INTEGER NOT NULL,
  valor_centavos INTEGER NOT NULL,
  asaas_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | confirmado | expirado
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  confirmado_em TEXT
);

CREATE TABLE IF NOT EXISTS denuncias (
  id TEXT PRIMARY KEY,
  anuncio_id TEXT NOT NULL REFERENCES anuncios(id),
  denunciante_id TEXT NOT NULL REFERENCES users(id),
  motivo TEXT NOT NULL, -- sem_estoque | fora_do_tema | golpe | outro
  detalhes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | procedente | improcedente
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversas (
  id TEXT PRIMARY KEY,
  anuncio_id TEXT NOT NULL REFERENCES anuncios(id),
  comprador_id TEXT NOT NULL REFERENCES users(id),
  vendedor_id TEXT NOT NULL REFERENCES users(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL REFERENCES conversas(id),
  remetente_id TEXT NOT NULL REFERENCES users(id),
  texto TEXT NOT NULL,
  bloqueada INTEGER NOT NULL DEFAULT 0, -- 1 = continha telefone/whatsapp, foi filtrado
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anuncios_bairro ON anuncios(bairro_id, status);
CREATE INDEX IF NOT EXISTS idx_anuncios_vendedor ON anuncios(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_modelos_marca ON modelos(marca_id);
CREATE INDEX IF NOT EXISTS idx_bairros_cidade ON bairros(cidade_id);
CREATE INDEX IF NOT EXISTS idx_cidades_estado ON cidades(estado_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
