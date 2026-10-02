# Publicação

Pelo acordo Cloud 1 / Cloud 2, **o Cloud 2 cuida** de `wrangler.toml`, workflows, backups e Play Store. Este arquivo diz exatamente o que o Hazluno precisa.

## Cloudflare (um Worker serve app + API, igual ao Radar Preventivo)
- **Worker:** `hazluno`, `main = "backend/src/worker.ts"` (a partir de `HAZLUNO/`).
- **Arquivos do app:** `[assets] directory = "frontend/dist"`, `binding = "ASSETS"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]`.
- **Banco:** D1 `hazluno`, binding `DB`, `migrations_dir = "backend/src/db/migrations"` → `wrangler d1 migrations apply hazluno --remote`.
- **Variáveis:** `NODE_ENV=production`, `SESSION_DAYS=30`, `ALLOWED_ORIGINS` e `PUBLIC_URL` com o endereço final.
- **Segredos:** `PASSWORD_PEPPER` e `IP_HASH_SECRET` (16+ caracteres cada) via `wrangler secret put`. **Nunca** trocar o `PASSWORD_PEPPER` depois de ter contas: as senhas param de funcionar.
- **R2 (desde a Fase 2):** bucket `hazluno-files`, binding **`FILES`** (fotos de perfil e capas em `public/…`; depois materiais e certificados). Privado: o Worker é quem serve os arquivos.

## Ordem do deploy
1. `cd HAZLUNO/frontend && npm ci && npm run build`
2. `cd HAZLUNO/backend && npm ci && npm test`
3. Aplicar migrações D1 e depois `wrangler deploy`.

## Android (Fase 8)
Mesmo processo do Radar Preventivo (Capacitor). Ícone aprovado em `brand/icon-1024.png`.

## Fase 3 — pagamentos (Stripe Connect)
- Segredos do Worker: `STRIPE_SECRET_KEY` (começar com `sk_test_…`) e `STRIPE_WEBHOOK_SECRET` (`whsec_…`). Sem os dois, pagamento fica desligado e o app diz isso (grupos grátis continuam funcionando).
- Webhook no painel do Stripe: `https://<domínio>/api/payments/webhook`, eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `account.updated`, `refund.updated`. Marcar "Connect" também para `account.updated`.
- Cron do Worker (`[triggers] crons = ["*/15 * * * *"]`): libera vagas não pagas e transfere aos professores o líquido dos grupos que terminaram. O admin também pode rodar em `POST /api/admin/payments/settle`.
