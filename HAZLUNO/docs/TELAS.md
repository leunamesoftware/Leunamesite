# Mapa das 40 telas (fluxograma do dono)

Referência: `brand/flowchart-reference.webp`. Cada tela tem uma das três situações:

- **Pronta**: funciona de verdade, ligada ao servidor.
- **Parcial**: existe, mas parte depende de uma fase seguinte (está escrito na própria tela).
- **Fase N**: ainda não existe. Nenhuma tela finge funcionar antes da hora.

## Fluxo do aluno (1–20)

| # | Tela | Situação | Onde |
|---|------|----------|------|
| 1 | Abertura / boas-vindas | Pronta (no computador `/` é o site público; no celular, a tela de boas-vindas do app) | `/` |
| 2 | Entrar / criar conta | Pronta | `/login`, `/signup` |
| 3 | Escolher perfil | Pronta (aluno / professor). **"Sou empresa" fica para a Fase 9** (Hazluno Empleo) | `/signup` (primeiro passo) |
| 4 | Cadastro do aluno | Pronta | `/signup` |
| 5 | Início do aluno | Pronta | `/home` |
| 6 | Buscar / explorar aulas | Pronta | `/explore` |
| 7 | Detalhes da aula | Pronta (regra: de fora só clica para comprar) | `/course/:id` |
| 8 | Escolher grupo e horário | Pronta (mostra a descrição do grupo) | `/course/:id/choose` |
| 9 | Pagamento e confirmação | Pronta (Stripe Checkout; liga quando as chaves do Stripe forem colocadas) | `/course/:id/checkout/:classId` |
| 10 | Reserva confirmada | Pronta (só confirma pelo aviso assinado do Stripe; calendário .ics; cancelar com 50%) | `/enrollment/:id` |
| 11 | Minhas aulas | Pronta (próximas / em curso / concluídas) | `/my` |
| 12 | Detalhes da aula agendada | Parcial: contagem regressiva e "Entrar" na **Fase 4** | `/my` |
| 13 | Sala de aula ao vivo | **Fase 4** (vídeo + verificação facial) | — |
| 14 | Aula encerrada | **Fase 5** | — |
| 15 | Gravação da aula | **Fase 5** (30 dias, sem download) | — |
| 16 | Materiais da aula | **Fase 5** | — |
| 17 | Certificado | **Fase 5** (regras já no banco e em `shared/certificate.ts`) | — |
| 18 | Avaliação da aula | **Fase 5** (banco pronto, migração 0006) | — |
| 19 | Histórico de aulas | Pronta (aba "Completadas" de Minhas aulas) | `/my` |
| 20 | Perfil e configurações | Pronta | `/profile` |

## Fluxo do professor (21–28)

| # | Tela | Situação | Onde |
|---|------|----------|------|
| 21 | Cadastro do professor | Pronta (5 passos) | `/teach/profile` |
| 22 | Perfil profissional | Pronta (capa, experiência, links sem WhatsApp/Telegram) | `/teach/profile` |
| 23 | Criar curso | Pronta (4 passos com prévia) | `/teach/courses/new` |
| 24 | Criar grupo e definir horários | Pronta (dias da semana geram os encontros; só ao vivo; máx. 25) | `/teach/courses/:id/groups/new` |
| 25 | Gerenciar alunos | Pronta (lista, filtros, notas privadas, reportar). Presença real chega na **Fase 4** | `/teach/students` |
| 26 | Aula ao vivo do professor | **Fase 4** (gravação sempre ligada) | — |
| 27 | Gravações do professor | **Fase 5** | — |
| 28 | Ganhos e saques | Pronta (taxa do Stripe às claras, conta de cobro no Stripe, repasse ao terminar o grupo) | `/teach/earnings` |

## Fluxo administrativo (29–40) — Fase 6

| # | Tela | Situação |
|---|------|----------|
| 29 | Dashboard administrativo | Pronta (números reais; dinheiro na Fase 3) — `/admin` |
| 30 | Gerenciar usuários | Parcial: aprovação de professores já pronta (`/admin/instructors`) |
| 31 | Gerenciar cursos | Fase 6 |
| 32 | Gerenciar turmas | Fase 6 |
| 33 | Pagamentos e transações | Fase 6 (depende da Fase 3) |
| 34 | Comissões e repasses | Fase 6 (taxa de €5 e regra de desistência 50% / 50-50) |
| 35 | Certificados | Fase 6 (emissão é da Fase 5) |
| 36 | Gravações | Fase 6 (apagar caso sensível; a regra de 30 dias é automática) |
| 37 | Denúncias e suporte | Fase 6 (denúncias já gravadas: o professor reporta aluno desde já) |
| 38 | Notificações | Fase 6 |
| 39 | Configurações | Fase 6 (hoje em `platform_settings` e `fee_rules`) |
| 40 | Relatórios | Fase 6 |
