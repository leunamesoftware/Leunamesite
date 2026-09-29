# Radar Preventivo

**Protege seu hoje. Evita problemas amanhã.**

Aplicativo que acompanha documentos, obrigações e prazos e avisa antes que vençam.
Fluxo central: **receber → analisar → identificar → alertar → orientar**.

- No ar: https://radar-preventivo.emanuelantunes2024.workers.dev
- Política de privacidade: `/privacidade.html` · Excluir conta: `/excluir-conta.html`

## Estrutura

```
compartilhado/   contratos (tipos) usados pelo frontend e pelo backend
backend/         API em TypeScript + Hono
  src/modulos/   autenticacao, conta, itens, analise (motor), orientacao,
                 alertas, anexos, rotina (análise diária)
  src/infra/     adaptadores de banco (SQLite local, Cloudflare D1) e de
                 arquivos (disco local, memória p/ testes, Cloudflare R2)
  src/worker.ts  entrada na Cloudflare (app + API + rotina diária por cron)
  src/servidor.ts entrada em Node (desenvolvimento)
  test/          testes automáticos (vitest)
frontend/        app em React + TypeScript + Vite (telas, componentes, serviços)
app-android/     empacotamento Android (Capacitor 8, API 36) — com.radarpreventivo.app
marca/           ícone oficial, ícone 512 da Play, referência da abertura
loja/            capturas, imagem de destaque e passo a passo da Play Store
wrangler.toml    configuração da Cloudflare (Worker, D1, R2, cron)
```

## Rodar no computador

```bash
cd backend && npm install && npm run dev        # API em http://localhost:8787
cd frontend && npm install && npm run dev       # app em http://localhost:5173
```

Variáveis do backend: ver `backend/.env.exemplo`.

## Testes

```bash
cd backend && npm run testar     # 27 testes: login, isolamento entre contas, análise,
                                 # alertas ao longo do tempo, anexos privados,
                                 # exclusão de conta, limpeza de registros
cd frontend && npm run tipos     # checagem de tipos
```

## Publicação

- **Cloudflare:** Worker `radar-preventivo`, banco D1 `radar-preventivo`, arquivos no R2
  `radar-preventivo-anexos`, rotina diária às 06:00 (Brasília). O segredo `PIMENTA_SENHA`
  é gerado uma vez no deploy e nunca fica no código.
- **Android:** o app abre o Radar hospedado, então melhorias no sistema chegam sem
  precisar publicar outro AAB. Para uma nova versão na Play, aumente `versionCode` em
  `app-android/versao-release.properties`.

## Regras da V1

- Faixas: **Atenção** a partir de 30 dias (ou a antecedência escolhida no item),
  **Urgente** a partir de 7 dias, **Vence hoje**, **Vencido** (lembrete semanal).
- Tipo do documento é texto livre. Resolver um item mantém o item e os alertas no histórico.
- Alertas dentro do app. A estrutura já prevê push e e-mail (tabela `entregas_alerta`).
- Preparado para depois: leitura automática de documentos (IA/OCR), painel administrativo
  (`papel` do usuário, `/api/admin` reservado), prazos recorrentes, recuperação de senha
  por e-mail.
