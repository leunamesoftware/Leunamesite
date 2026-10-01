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
- `booked-class-reference-phase4.webp` (aula reservada, com contagem regressiva): "La clase comienza en", "Entrar a la clase" (ativa 5 min antes), agregar ao calendário, cancelar reserva, materiais, mensagens com o professor, outros alunos, sobre o professor.
  - **Regra nova do dono (Fase 4):** a primeira entrada vale de 5 min antes até 5 min depois do início de cada encontro (`live.early_join_minutes` = 5, `live.late_join_minutes` = 5, editáveis). Quem já entrou e caiu da internet **pode voltar** a qualquer momento do encontro (o prompt mestre pede reconexão).
  - Sem selo "EN VIVO" antes da hora: no lugar, a contagem regressiva.
  - Sem "plazas disponibles" para quem já comprou.
  - "Cancelar reserva" mostra antes o valor que volta e o que fica retido (regra de desistência de 50 %) e pede confirmação.
  - "Otros alumnos": por privacidade (GDPR), só aparece quem aceitar ser visto; para os demais, só o número de colegas.
- `live-room-reference-phase4.webp` (sala ao vivo): vídeo do professor em destaque, faixa com os alunos, chat / participantes / materiais, tempo restante, nº de alunos, microfone, câmera, levantar a mão, chat, compartilhar, "Salir de la clase".
  - **Câmera do aluno obrigatória** e checagem facial periódica (pedido do dono); sem câmera, o aluno não fica na sala.
  - **Marca-d'água** com o nome do aluno sobre o vídeo do professor (desestimula gravar e repassar).
  - **Levantar a mão → professor dá a palavra → contador de 30 s** (`live.question_seconds`), um aluno por vez.
  - "Compartir" para aluno só quando o professor autorizar.
  - Selo **"Grabando"** sempre visível quando a gravação estiver ligada (GDPR); consentimento pedido antes de entrar.
  - Chat com denúncia de mensagem; professor pode silenciar e remover aluno.
  - Android: bloqueio de captura e gravação de tela durante a aula (FLAG_SECURE).
  - Nunca mais de 25 alunos (a sala segue a capacidade da turma).
- `class-finished-reference-phase5.webp` ("¡Clase finalizada!"): gravação, materiais, certificado, avaliar, mensagem ao professor, "Ver mis clases" / "Buscar más clases".
  - Gravação disponível por **30 dias** (`recording.retention_days`), só para inscritos.
  - Curso de vários encontros: a tela aparece ao fim de cada encontro, mas **certificado só depois do último**, com presença mínima (`courses.completion_min_attendance_bp`, padrão 80 %).
  - Certificado diz "de participação/conclusão"; nunca afirma reconhecimento oficial sem comprovação.
  - "Evaluar la clase": uma avaliação por inscrição, só de quem participou.
- `recording-reference-phase5.webp` (gravação): player, capítulos, "Grabación disponible 30 días", continuar vendo, materiais, favoritos, certificado, avaliar, mais cursos do professor.
  - **Sem botão "Descargar"** (proposta ao dono): arquivo baixado pode ser repassado. Gravação só dentro do app, por streaming com link temporário, com o nome do aluno por cima do vídeo, e apagada no fim do prazo.
  - Capítulos: marcados pelo professor; sugestão automática por IA só quando existir de verdade (transcrição).
  - "Más clases de esta profesora" mostra cursos ao vivo com turmas abertas (o Hazluno não vende gravações avulsas).
- `materials-reference-phase5.webp` (materiais da aula): PDFs, vídeos complementares, imagens de referência e links úteis, com abas Materiales / Grabación / Chat / Detalles.
  - Só para inscritos; o professor envia por curso (vale para todos os grupos) ou por grupo.
  - Tipo (PDF, vídeo, imagem) detectado pelo arquivo real, como já é feito com as fotos; limite de tamanho por tipo.
  - PDF e imagem podem ser baixados (o professor decidiu compartilhar); vídeo complementar só por streaming, como a gravação.
  - Link externo abre com aviso de saída do app; links entram na moderação (denúncia).

## Certificados — quem responde por quê (regra do dono, vale desde já)
| Quem | Responsabilidade |
|---|---|
| **Hazluno** | Emite e registra o certificado digital: ID único (`HZ-AAAA-NNNNNN`), QR Code e página pública de verificação. Aparece como **plataforma emissora**. |
| **Professor** | Responsável pela formação. Aparece como **professor responsável** e **aprova a emissão** (`instructor_approved_at`). |
| **Aluno** | Recebe o certificado só depois de cumprir os critérios da turma: todos os encontros encerrados + presença mínima do curso (padrão 80%) + aprovação do professor. |
| **Curso/turma** | O certificado diz exatamente qual formação, a **carga horária real** (soma dos encontros), a data de conclusão e o professor. |
| **Quem recebe o certificado** | Confere a autenticidade na Hazluno pelo QR Code ou pelo ID. |

Regras no código: `shared/certificate.ts` (elegibilidade e formato do ID) e migração `0005_certificate_responsibilities.sql`; testes em `backend/test/certificate.test.ts`.

**Texto do certificado** (nos 6 idiomas; exemplo em espanhol):
> CERTIFICADO DE CONCLUSIÓN — Certificamos que **Ana Torres** concluyó la formación **Pintura creativa para principiantes** (6 h), impartida por **Laura Méndez**, a través de la plataforma Hazluno.
> Rodapé: *Laura Méndez — Profesora / responsable de la formación* · *Hazluno — Plataforma emisora* · *ID HZ-2026-000123* · QR Code + "Verificar certificado".

- Nunca "qualificação profissional" ou "reconhecimento oficial", a não ser que aquela formação tenha essa validade comprovada.
- A "assinatura" do professor é o nome dele em letra cursiva marcando a **aprovação feita na plataforma**; não é assinatura eletrônica qualificada.
- Selo/marca-d'água da Hazluno no fundo; a garantia de verdade é a verificação pelo QR/ID.
- **Privacidade na verificação:** só com o ID, a página confirma que o certificado existe, o curso, a data e o professor, com o nome do aluno abreviado ("Ana T."). Com a chave do QR Code (que só o aluno tem para compartilhar), mostra o nome completo. Assim ninguém consegue listar os alunos tentando IDs em sequência.
- Referência visual: `brand/certificate-reference-phase5.webp` (ajustar o texto para o modelo acima e incluir carga horária, ID e QR).
- `review-reference-phase5.webp` ("Evalúa la clase"): nota geral, 4 aspectos (contenido, didáctica, organización, cumplimiento del horario), "¿Qué te gustó más?" e comentário de até 500 caracteres. Banco preparado na migração `0006_review_aspects.sql`.
  - Só quem participou (uma avaliação por inscrição), depois do último encontro.
  - **As estrelas começam vazias** (na imagem já vêm todas marcadas, o que puxa a nota para cima e não é justo com os outros alunos).
  - O que aparece em público: nota geral, aspectos, destaques e comentário, com o nome abreviado ("Pedro S."). O professor pode responder uma vez.
  - Comentário passa pelo filtro de moderação (denúncia, ocultar); o professor não apaga avaliação, só a moderação.
  - A nota do curso e do professor é a média das avaliações publicadas; sem avaliações aparece "Nuevo".
- `my-classes-history-reference.webp` ("Mis clases" com histórico): adaptado ao modelo **ao vivo**. Abas Próximas / En curso / Completadas / Favoritas, busca, progresso = **encontros já realizados** ("2 de 3 encuentros"), não "vídeo assistido". Não existe "Comenzar" (a aula começa na data marcada). "Ver de nuevo" = gravação (30 dias) e "Certificado" só depois de concluir (Fase 5). A barra de baixo continua com 5 itens; notificações ficam no sino do topo (6 itens não cabem bem no celular).
- `profile-reference.webp` (perfil): contadores reais (aulas concluídas, certificados, em andamento), abas Meu perfil / Configuração / Segurança, meus dados, áreas de interesse (salvas, para recomendar), favoritos, trocar senha, aparelhos, privacidade, sair. Ficam de fora até existirem de verdade: aparência (modo escuro), lembretes, ajuda/suporte e telefone do aluno (não é necessário para estudar; minimização de dados do GDPR).
- `teacher-signup-reference.webp` (cadastro do professor em 4 passos): dados pessoais → informação profissional → documentos e verificação → revisão e envio. Correções de texto: "alumnos en toda Europa" (não "todo el mundo"), "clases siempre en vivo" (não "en video o combinadas"). O passo de documento + selfie depende do provedor de verificação de identidade (Fase 4) e diz isso na tela.
- `teacher-profile-setup-reference.webp` e `teacher-dashboard-profile-reference.webp` (perfil do professor em 5 passos): dados pessoais (telefone e cidade, não públicos) → informação profissional (capa, experiência, especialidades, links) → documentos → métodos de cobro → revisão. Ajustes: links só Instagram / YouTube / site, sempre `https`, e **nunca WhatsApp, Telegram, Signal, Viber ou Messenger** (evita combinar aula por fora da plataforma; o servidor recusa com `contact_link`). "Métodos de cobro" só mostra o aviso até a Fase 3 (sem transferência bancária falsa). Menu lateral no computador (≥1000px) e abas no celular.
- `create-course-reference.webp` ("Crear curso" em 4 passos: informação básica → conteúdo → imagem e apresentação → revisão e publicação). Ajuste de modelo: **carga horária, número de aulas e preço ficam no grupo**, não no curso (cada grupo tem seus encontros e seu preço); a prévia do curso mostra "desde €X" quando houver grupo. O vídeo de apresentação espera a Fase 5 (armazenamento de vídeo).
- `create-class-reference.webp` ("Crear turma y definir horarios"): dias da semana + hora de início/fim + data de início/fim geram os encontros automaticamente; nome e descrição do grupo; prévia do grupo e dicas. Ajustes: **só aula ao vivo** (a opção "Clase grabada" não existe no Hazluno), limite de alunos **máximo 25** (não 30), e a data de fim é obrigatória para saber quantos encontros (e horas reais do certificado) o grupo terá.
- `manage-students-reference.webp` ("Gestionar alumnos"): lista por curso/grupo com filtros, busca e ficha do aluno. Ajustes: **sem "Añadir alumnos"** (aluno só entra comprando; adicionar à mão pularia o pagamento), **sem e-mail do aluno** para o professor (conversa só dentro da plataforma e minimização de dados do GDPR), **sem "Eliminar alumno"** (aluno que pagou envolve reembolso: vira "Reportar al equipo", tratado pelo admin na Fase 6). Estados = inscrição (confirmada / pagamento pendente / cancelada); progresso = **encontros com presença** (Fase 4). "Enviar mensaje" é Fase 4, "Certificado" (aprovação do professor) é Fase 5, notas privadas do professor ficam só para ele.
