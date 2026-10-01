# Arquitetura — Razluno

```
App (React, 6 idiomas)  ──HTTPS + token de sessão──▶  API (Hono, Cloudflare Worker)
   │  (vira Android na Fase 8)                           │
   │                                                     ├── Banco: Cloudflare D1 (SQLite)
   │                                                     ├── Arquivos: Cloudflare R2 (Fase 5)
   │                                                     ├── Pagamentos: provedor marketplace (Fase 3)
   │                                                     ├── Vídeo ao vivo: provedor profissional (Fase 4)
   │                                                     └── E-mail / notificações (adaptadores)
```

## Separação
- **Frontend** (`frontend/`): só mostra e coleta dados. Nunca decide preço, permissão ou se algo foi pago.
- **Backend** (`backend/src`):
  - `app.ts` monta as rotas; não sabe onde está hospedado.
  - `worker.ts` (Cloudflare) e `server.ts` (Node) montam as dependências de cada ambiente.
  - `infra/` adaptadores trocáveis: banco (`sqlite.ts`, `d1.ts`), e-mail (`mailer.ts`). Vídeo, pagamentos e armazenamento entram do mesmo jeito: uma interface + um adaptador por provedor, para trocar de provedor sem mexer nas regras.
  - `modules/` um módulo por assunto (`auth`, `account`, `catalog`, `audit`; depois `courses`, `classes`, `enrollments`, `payments`, `live`, `recordings`, `certificates`, `admin`…).
- **Contrato** (`shared/contracts.ts`): tipos usados pelos dois lados.

## Regras fixas
- Toda operação financeira e toda autorização são validadas **no backend**.
- Nenhuma chave secreta no app. Segredos ficam em `wrangler secret`.
- Pagamento só vira "pago" com confirmação real do provedor (webhook verificado). Nada de pagamento simulado.
- Turma que começou não aceita aluno novo; turma encerrada não aceita inscrição. Para oferecer de novo, o professor cria outra turma.
- Valores de cobrança e limites ficam em `fee_rules` e `platform_settings` (editáveis pelo admin), nunca no código.

## Banco (resumo)
- Identidade: `users`, `user_roles`, `sessions`, `login_attempts`, `auth_tokens`, `auth_identities`, `student_profiles`, `instructor_profiles`, `consents`.
- Catálogo: `languages`, `countries`, `categories` (+ traduções), `courses`, `course_modules`, `lessons`.
- Turmas: `class_sessions` (a turma: horário, vagas, preço, estado), `live_sessions` (cada encontro ao vivo da turma), `enrollments`, `attendances`, `waitlist`, `favorites`.
- Dinheiro: `fee_rules`, `payments`, `payment_transactions`, `platform_fees`, `refunds`, `instructor_payouts`. Valores sempre em centavos + moeda.
- Conteúdo: `recordings`, `materials`, `certificates`, `certificate_verifications`, `reviews`.
- Comunicação e controle: `conversations`, `messages`, `user_blocks`, `notifications`, `reports`, `moderation_actions`, `support_tickets`, `support_messages`, `audit_logs`, `platform_settings`.

### Estados da turma (`class_sessions.status`)
`draft → enrollment_open ⇄ full → enrollment_closed → scheduled → live → completed`, e `canceled` a partir de qualquer estado antes de `completed`.

## Idiomas
Textos do app em `frontend/src/i18n/<idioma>.ts` (PT é a base; os outros precisam ter as mesmas chaves, o TypeScript reclama se faltar). A API devolve **códigos** de erro, nunca frases, e o app traduz. Para adicionar um idioma: novo arquivo em `i18n/`, código em `LANGUAGES` (`shared/contracts.ts`) e uma linha em `languages` (migração).

## Preparado para IA (sem funcionalidade falsa)
Transcrição, legendas, resumo e capítulos vão se ligar às `recordings`; tradução aos textos de curso; recomendação aos `favorites`/`enrollments`; moderação aos `reports`. Nenhuma dessas funções existe ainda.
