# Publicação

Pelo acordo Cloud 1 / Cloud 2, **o Cloud 2 cuida** de `wrangler.toml`, workflows, backups e Play Store. Este arquivo diz exatamente o que o Razluno precisa.

## Cloudflare (um Worker serve app + API, igual ao Radar Preventivo)
- **Worker:** `razluno`, `main = "backend/src/worker.ts"` (a partir de `RAZLUNO/`).
- **Arquivos do app:** `[assets] directory = "frontend/dist"`, `binding = "ASSETS"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]`.
- **Banco:** D1 `razluno`, binding `DB`, `migrations_dir = "backend/src/db/migrations"` → `wrangler d1 migrations apply razluno --remote`.
- **Variáveis:** `NODE_ENV=production`, `SESSION_DAYS=30`, `ALLOWED_ORIGINS` e `PUBLIC_URL` com o endereço final.
- **Segredos:** `PASSWORD_PEPPER` e `IP_HASH_SECRET` (16+ caracteres cada) via `wrangler secret put`. **Nunca** trocar o `PASSWORD_PEPPER` depois de ter contas: as senhas param de funcionar.
- **R2** (Fase 5): bucket privado para materiais e certificados.

## Ordem do deploy
1. `cd RAZLUNO/frontend && npm ci && npm run build`
2. `cd RAZLUNO/backend && npm ci && npm test`
3. Aplicar migrações D1 e depois `wrangler deploy`.

## Android (Fase 8)
Mesmo processo do Radar Preventivo (Capacitor). Ícone aprovado em `brand/icon-1024.png`.
