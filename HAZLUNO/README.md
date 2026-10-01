# Hazluno

Plataforma europeia de aprendizagem prática **ao vivo**: professores abrem turmas com horário, vagas e preço; alunos participam em tempo real, perguntam, praticam junto e recebem certificado.

| Pasta | O que é |
|---|---|
| `backend/` | API (Hono + TypeScript). Roda no Cloudflare Workers (D1) e em Node (SQLite) para desenvolvimento e testes. |
| `frontend/` | App (React + Vite), em 6 idiomas. O mesmo app vira o Android (Capacitor) na Fase 8. |
| `shared/contracts.ts` | Formato dos dados trocados entre app e API (os dois lados importam o mesmo arquivo). |
| `brand/` | Ícone aprovado, foto principal e referências de tela enviadas pelo dono. |
| `docs/` | ARCHITECTURE, SETUP, TESTES, DEPLOY, PAYMENTS, PRIVACY. |

O nome da marca fica em um lugar só: `frontend/src/brand.ts` (e `{brand}` nos textos).

## Situação por fase

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Arquitetura + banco + autenticação | **Concluída** (veja abaixo) |
| 2 | Aluno, professor, cursos e turmas | Próxima |
| 3 | Inscrição, pagamentos e comissão | — |
| 4 | Sala ao vivo | — |
| 5 | Gravações, materiais e certificados | — |
| 6 | Painel administrativo | — |
| 7 | Segurança, GDPR e testes | — |
| 8 | Preparação para publicação | — |

### Fase 1 — o que foi entregue
- Banco com **todas** as entidades do prompt mestre (37 tabelas), os 8 estados da turma e regras protegidas pelo próprio banco (vagas nunca passam da capacidade, inscrição fecha antes do início, divisão do pagamento sempre fecha com o valor pago).
- Modelo de cobrança do dono como **dado editável**, não código: €5 por turma aberta, comissão 0%, desistência retém 50% (metade Hazluno, metade professor), máximo de 25 alunos.
- 6 idiomas (abre em espanhol), 31 países europeus e 14 categorias traduzidas.
- Cadastro "Quero aprender" / "Quero ensinar" (professor começa **em verificação**), login, sair, sessões revogáveis, aparelhos conectados, trocar senha, limite de tentativas, papéis (aluno, professor, administrador, moderador) checados no servidor, registro de auditoria, consentimento de termos/privacidade com versão.
- Telas 1 (abertura), 2 (login), 3 (aprender ou ensinar + cadastro) e um início provisório com as categorias reais.
- Regra de acesso à turma (quem compra, quem entra, quem não clica em nada) num lugar só, usada por app e API.
- 39 testes automáticos.

### O que ainda falta (honesto)
- **Nome:** Hazluno (com H), confirmado pelo dono.
- **Recuperação de senha por e-mail:** pronta no servidor, mas desligada até existir um provedor de e-mail. Sem ele o app avisa que não está disponível.
- **Google / Apple:** botões prontos, mas só aparecem quando o fluxo de cada provedor for implementado e configurado.
- **Termos de uso e Política de privacidade:** as páginas existem e dizem que o texto está em preparação. O texto jurídico precisa ser escrito antes do lançamento.
- **Publicação na Cloudflare:** combinada com o Cloud 2 (veja `docs/DEPLOY.md`).
