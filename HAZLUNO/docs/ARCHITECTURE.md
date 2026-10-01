# Arquitetura — Hazluno

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
- **O que cada pessoa pode fazer com uma turma** sai de uma função só, `shared/class-access.ts`, usada pelo app e pela API (testada em `backend/test/class-access.test.ts`):

  | Situação da turma | Quem não comprou | Aluno inscrito |
  |---|---|---|
  | Antes de começar, com vaga e dentro do prazo | "Inicia el …" + vagas restantes → **comprar** | ver detalhes e materiais |
  | Lotada ou prazo de inscrição encerrado | nada clicável | ver detalhes e materiais |
  | Ao vivo agora | nada clicável | **entrar** |
  | Começou (entre um encontro e outro) | nada clicável | ver detalhes |
  | Terminada | nada clicável | **gravação** |
  | Cancelada | nada clicável | nada (reembolso automático) |

  O horário manda: passou do início, ninguém novo entra, mesmo que o estado ainda não tenha sido atualizado.

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

## Referências de tela da Fase 2 (em `brand/`)
- `home-reference-phase2.webp` (início) e `explore-reference-phase2.webp` (buscar): barra de busca, categorias em chips, filtros (tipo, preço, nível, duração; o prompt mestre pede também idioma, país, data e horário), ordenação, contagem de resultados, cartões com foto do professor, avaliação e botão, barra inferior Início / Buscar / Mis clases / Favoritos / Perfil.
- Ajustes obrigatórios em relação às imagens:
  - Cartão "EN VIVO" **não** mostra "Unirme" para quem não comprou (regra acima). Para essa pessoa, o cartão mostra o próximo grupo do mesmo curso, se existir.
  - Número de participantes nunca passa da capacidade (máximo 25); a imagem mostra 32.
  - Nota (4,9 etc.) só aparece com avaliações reais; professor sem avaliação aparece como "Nuevo".
  - Contagem "124 clases" e qualquer número da tela vêm do banco; nada de número de exemplo.
  - Fotos dos cartões são as que o professor envia; sem fotos de banco de imagens se passando por professores.
- `class-detail-reference-phase2.webp` (detalhe da aula/curso): foto ou vídeo de apresentação, título, professor, nota, alunos, data/hora, duração, nível, abas Informação / Comentários / Professor / Aulas parecidas, "Sobre esta clase", "Sobre la profesora", opiniões, favoritar, compartilhar e botão fixo embaixo.
- Ajustes obrigatórios em relação a essa imagem:
  - **O botão de baixo segue a regra da turma:** quem está de fora e a turma não começou vê "Reservar plaza · €20"; turma ao vivo para quem está de fora fica desativada ("Clase en curso · inscripciones cerradas") com o próximo grupo, se houver; inscrito com aula ao vivo vê "Entrar a la clase"; inscrito depois do fim vê "Ver grabación".
  - **Preço, vagas e prazo** aparecem antes de comprar: "€20 · Quedan 8 plazas · Inscripción hasta el lunes 08:00". A imagem não mostra preço nem vagas.
  - **Próximos grupos** (manhã, tarde, noite e outros dias) em lista, cada um com sua data, vagas e preço, como pede o prompt mestre.
  - **Curso de vários dias:** "7 encuentros · 1 h 30 cada uno", com a lista de datas, sempre no fuso de quem está vendo.
  - O **play** no topo só aparece se o professor enviar um vídeo de apresentação. Gravação de aula nunca é pública.
  - "320 alumnos" (deste curso) e "3,2 mil alumnos" (total do professor) precisam dizer claramente a que se referem.
  - **Materiais necessários e recomendados** em lista (a imagem só mostra "opcionales").
  - Antes de pagar: aviso da **regra de desistência** (perde 50%) e, em curso com risco físico, aviso de segurança; os dois com aceite.
  - Opiniões só de quem fez o curso de verdade (ligadas a uma inscrição).
- `choose-class-reference-phase2.webp` ("Elige tu clase"): passo entre o detalhe e o pagamento, com os grupos do curso (Mañana / Tarde / Noche), data, horário, vagas, preço, "Elegir", resumo do grupo escolhido e "Continuar".
  - Manhã/tarde/noite calculados pela hora local de quem vê (antes das 12h, 12h–18h, depois das 18h), com aviso "Hora local".
  - Inscrição fecha no início da aula (padrão do prazo = início do 1º encontro), como diz a tela.
  - Grupo lotado, encerrado ou já começado aparece apagado ("Completo", "Cerrado", "En curso") e não pode ser escolhido.
  - Preço é "por grupo" (vale para todos os encontros da turma), não "por clase".
  - Curso de vários encontros mostra o período ("15–21 de octubre · 7 encuentros").
- `my-classes-reference-phase2.webp` ("Mis clases"): abas Próximas / Pasadas / Favoritos, cartão com selo (EN VIVO / CONFIRMADA), professor, data, horário, turno, "Entrar a la clase" e "Ver detalles".
  - "Entrar a la clase" só no cartão ao vivo (regra da turma); entrada sempre pelo app, com verificação facial (Fase 4).
  - Para quem já comprou, no lugar de "plazas disponibles": progresso da turma ("Encuentro 2 de 7 · jueves 09:00").
  - "Clases pasadas": gravação (só para inscritos) e certificado quando houver (Fase 5).
