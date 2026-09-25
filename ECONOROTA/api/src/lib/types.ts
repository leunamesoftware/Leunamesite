export type Role = 'cliente' | 'mercado' | 'entregador' | 'admin';

export type Env = {
  DB: D1Database;
  /** Fotos privadas (R2). */
  FILES: R2Bucket;
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string;
  TOKEN_TTL_HOURS: string;
  /** "true" somente em desenvolvimento local. */
  DEV_MODE?: string;
  /** Só com DEV_MODE: fixa a hora local ("HH:MM") para testes. */
  DEV_CLOCK?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_TEMPLATE?: string;
  /** IDs de cliente OAuth aceitos (Android, iOS, Web), separados por vírgula. */
  GOOGLE_CLIENT_IDS?: string;
  GEOCODER_USER_AGENT?: string;
  /** Pedido mínimo do EconoRota (soma de todos os mercados), em centavos. Padrão: 10000 (R$ 100). */
  MIN_ORDER_CENTS?: string;
  /** Parte da taxa de entrega que fica com o entregador, em % (padrão 80). */
  COURIER_SHARE_PCT?: string;
  /** Comissão do EconoRota sobre as vendas do mercado, em % (definida no final; padrão 10). */
  COMMISSION_PCT?: string;
  /** Asaas (Pix e cartão). Sem chave: em DEV_MODE usa o simulador; em produção, pagamentos ficam indisponíveis. */
  ASAAS_API_KEY?: string;
  /** https://sandbox.asaas.com/api/v3 (testes) ou https://api.asaas.com/v3 (produção). */
  ASAAS_BASE_URL?: string;
  /** Token configurado no webhook do Asaas (header asaas-access-token). */
  ASAAS_WEBHOOK_TOKEN?: string;
  /** Versão mínima e mais recente do app (ex.: "1.0.0") e link da loja. */
  APP_MIN_VERSION?: string;
  APP_LATEST_VERSION?: string;
  APP_STORE_URL?: string;
  /** Chave de criptografia dos dados pessoais (CPF, CNH, Pix): 32 bytes em base64. Obrigatória em produção. */
  DATA_KEY?: string;
  /** Push no celular (Firebase Cloud Messaging, opcional): projeto e conta de serviço. */
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
};

export type AuthUser = { id: string; role: Role };

export type AppEnv = { Bindings: Env; Variables: { user: AuthUser } };

export type Channel = 'email' | 'whatsapp';
