# EconoRota — Entrega para o distribuidor

| Item | Valor |
|---|---|
| App | **EconoRota** — compare, economize e receba em casa |
| Versão | **1.0.0** (versionCode 1) — `app/pubspec.yaml` e `Env.appVersion` |
| applicationId | `com.leunamesoftwares.econorota` |
| Idioma | Português (pt-BR); textos em `app/lib/l10n` (pronto para outras línguas) |
| Plataformas | Android (Play Store) e Web (site/painéis). Mesmo código. |
| Perfis | Cliente, Mercado, Entregador e Administração (um app só; o login decide a área) |
| Repositório | `leunamesoftware/econorota` (branch `main`) |
| Pacote | `entregas/econorota-v1.0.0.zip` (código sem `node_modules`/`build`) |

O app de demonstração (sem servidor) já funciona: `flutter run` usa dados de exemplo. Logins da demonstração: cliente `11987654321`, mercado `mercado@demo.app`, entregador `entregador@demo.app`, administração `admin@demo.app` — senha `senha1234`; código de verificação `123456`.

---

## 1. Servidor (Cloudflare Workers + D1 + R2)

Pré-requisito: conta Cloudflare (plano Workers Paid já existente) e Node 20+.

```bash
cd api
npm install
npx wrangler login
npx wrangler d1 create econorota                  # copie o database_id para wrangler.toml
npx wrangler r2 bucket create econorota-arquivos  # documentos e fotos privadas
npm run db:migrate:remote                         # cria as tabelas (migrations 0001–0017)
npx wrangler secret put JWT_SECRET                # 64+ caracteres aleatórios
npx wrangler secret put DATA_KEY                  # openssl rand -base64 32  (GUARDE UMA CÓPIA SEGURA)
npx wrangler secret put ASAAS_API_KEY
npx wrangler secret put ASAAS_WEBHOOK_TOKEN
npm run deploy
node scripts/create-admin.mjs "Nome" email@empresa.com   # primeiro administrador (gera o SQL)
```

Obrigatório em produção:
- **Nunca** configurar `DEV_MODE` nem rodar `seed/demo.sql` (são só para testes locais).
- `DATA_KEY` cifra CPF, CNH e chaves Pix. Sem ela o servidor recusa gravar esses dados; **se perder a chave, esses dados não podem ser lidos** — guarde em cofre de senhas.
- `ALLOWED_ORIGINS` no `wrangler.toml`: domínio do site/painel (ex.: `https://app.econorota.com.br`), não `*`.
- `ASAAS_BASE_URL`: `https://api.asaas.com/v3` quando sair do sandbox.

Domínio e HTTPS: Workers → econorota-api → Settings → Domains → adicionar `api.SEUDOMINIO` (certificado automático).
Monitoramento: Workers → Observability (logs e erros já ativados no `wrangler.toml`).
Backup: o D1 tem **Time Travel** (restaura qualquer ponto dos últimos 30 dias: `npx wrangler d1 time-travel restore econorota --timestamp=...`). Recomendado também uma exportação semanal: `npx wrangler d1 export econorota --remote --output=backup-AAAA-MM-DD.sql` guardada fora da Cloudflare.

### Serviços externos

| Serviço | Para quê | Configuração |
|---|---|---|
| **Asaas** (obrigatório) | Pix e cartão, estornos | Chave + webhook `https://api.SEUDOMINIO/webhooks/asaas` com o mesmo token do `ASAAS_WEBHOOK_TOKEN`; eventos de cobrança (ver README) |
| **Provedor de mapas** (obrigatório) | Mapa do rastreamento | Conta em MapTiler/Stadia/Mapbox; passar a URL no build: `--dart-define=MAP_TILES_URL=https://.../{z}/{x}/{y}.png?key=...`. O servidor público do OpenStreetMap **não** pode ser usado em produção |
| Resend (recomendado) | E-mail de código e avisos | `RESEND_API_KEY` e `EMAIL_FROM` |
| WhatsApp Cloud API (opcional) | Código por WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` |
| Google (opcional) | Entrar com Google | `GOOGLE_CLIENT_IDS` + `--dart-define=GOOGLE_SERVER_CLIENT_ID` |
| Firebase (opcional) | Push com o app fechado | Ver seção 5 |

Valores do negócio (pedido mínimo R$ 100, comissão, parte do entregador, entrega única R$ 7,90 + R$ 3,00 por mercado extra, prazo de liberação do mercado) são ajustados no **painel administrativo → Configurações**, sem novo deploy.

## 2. Build do app

```bash
cd app
flutter pub get
# Android (Play Store)
flutter build appbundle --release \
  --dart-define=USE_MOCK=false \
  --dart-define=API_URL=https://api.SEUDOMINIO \
  --dart-define=MAP_TILES_URL='https://SEU-PROVEDOR/{z}/{x}/{y}.png?key=SUA_CHAVE'
# → build/app/outputs/bundle/release/app-release.aab

# Web (site / painéis de mercado e administração)
flutter build web --release --dart-define=USE_MOCK=false --dart-define=API_URL=https://api.SEUDOMINIO \
  --dart-define=MAP_TILES_URL='https://SEU-PROVEDOR/{z}/{x}/{y}.png?key=SUA_CHAVE'
# → build/web (publicar em Cloudflare Pages, ex.: app.SEUDOMINIO)
```

**Assinatura (keystore):** gere a chave de upload e crie `app/android/key.properties` a partir de `key.properties.example` (nunca versionar). Sem esse arquivo o build usa a chave de depuração e a Play Store recusa.

```bash
keytool -genkey -v -keystore ~/econorota-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Nova versão: aumentar `version:` no `pubspec.yaml` (ex.: `1.0.1+2`) **e** `Env.appVersion`. Para forçar atualização de versões antigas: `APP_MIN_VERSION` no `wrangler.toml`.

## 3. Play Store

- **Ícone 512×512:** `marca/icone-play-store-512.png` · ícone do app já configurado (adaptativo) · splash roxa com o logo.
- **Logo horizontal:** `marca/logo-horizontal.png` (banner/gráfico de destaque 1024×500 pode ser montado com ele).
- **Categoria:** Compras · **Classificação:** Livre · **Público:** 18+ para entregadores (validado no cadastro).
- **Capturas de tela:** gerar no celular com o app de produção (cliente: início, comparação, carrinho, rastreio; mercado; entregador).

**Título (30):** EconoRota: Compare e Economize

**Descrição curta (80):** Compare preços em até 3 mercados, economize e receba tudo em casa numa só entrega.

**Descrição completa:**

> Faça a feira gastando menos, sem sair de casa.
>
> O EconoRota compara os preços da sua lista nos mercados perto de você e monta a combinação mais barata — em até 3 mercados — com **uma única entrega**. Um entregador passa nos mercados e leva tudo até a sua porta.
>
> **Como funciona**
> • Digite ou cole sua lista ("arroz, feijão, leite Italac…"): o app entende produto, marca e quantidade.
> • Veja a tabela de preços por mercado e quanto você economiza.
> • Pague com Pix ou cartão com segurança.
> • Acompanhe no mapa: mercados, entregador e previsão de chegada.
> • Receba com código de entrega (QR Code) — ninguém recebe no seu lugar.
>
> **Transparência**
> • Uma taxa de entrega só, mostrada antes de pagar.
> • Item em falta? O valor volta na hora.
> • Problema com o pedido? Relate com fotos e acompanhe a solução.
>
> **Para mercados:** painel com pedidos, separação, estoque, validade, promoções, financeiro e repasses.
> **Para entregadores:** ganhos por entrega, rotas otimizadas e repasse por Pix.
>
> Seus dados são protegidos (LGPD): documentos cifrados, exportação e exclusão de conta pelo próprio app.

### Permissões Android

| Permissão | Por quê |
|---|---|
| `INTERNET` | Comunicação com o servidor |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | Encontrar mercados próximos; entregador informa a posição **só com o app aberto** durante a entrega |
| `CAMERA` | Entregador: foto dos documentos (CNH/CRLV) e leitura do QR Code na entrega; cliente: fotos de ocorrências |

Não há localização em segundo plano. Formulário "Segurança dos dados" da Play Store: coleta nome, e-mail, telefone, localização aproximada e precisa (entrega), CPF (pagamento), documentos (entregadores), histórico de compras; dados cifrados em trânsito (HTTPS) e em repouso para documentos; usuário pode pedir exclusão pelo app (Perfil → Meus dados e privacidade).

## 4. Pendências do distribuidor

1. Contas: Cloudflare (já existe), **Asaas**, provedor de mapas, Resend, Play Console; (opcionais) Firebase, Google OAuth, WhatsApp.
2. **Keystore** de upload e `key.properties`; ativar Play App Signing.
3. **Política de privacidade e Termos** revisados por advogado e publicados no site (o app já tem modelos em `app/lib/features/access/legal_texts.dart`; troque pelo texto final). URL da política na Play Store.
4. Domínios: `api.` (Workers) e `app.` (painel web, Cloudflare Pages).
5. Criar o primeiro administrador (`scripts/create-admin.mjs`) e cadastrar as **regiões** atendidas no painel.
6. Cadastrar/aprovar os mercados parceiros (o mercado se cadastra no app, completa **Dados da loja**, e a administração aprova).
7. Rodar a conferência manual de `TESTES.md` com o Asaas sandbox antes de ir para produção.

## 5. Push no celular (opcional)

Os avisos já aparecem na central do app (sino) e por e-mail. Para notificação com o app fechado:
1. Criar projeto no Firebase, app Android `com.leunamesoftwares.econorota`, e uma conta de serviço.
2. Servidor: `wrangler secret put FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (o envio já está implementado).
3. App: adicionar `firebase_core` e `firebase_messaging`, `google-services.json`, e após o login enviar o token para `POST /me/dispositivos {token, platform: "android"}`.

## 6. Verificar

```bash
bash scripts/test-all.sh     # tudo; a integração precisa da API local (cd api && npm run dev)
```
Detalhes e resultados em `TESTES.md`.
