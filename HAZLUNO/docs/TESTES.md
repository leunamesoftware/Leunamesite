# Testes

```bash
cd HAZLUNO/backend && npm test        # 57 testes (banco em memória, sem internet)
cd HAZLUNO/backend && npm run typecheck
cd HAZLUNO/frontend && npm run build  # checagem de tipos + build
```

## O que está coberto (Fase 1)
- **Banco:** existem todas as entidades do prompt mestre; só os 8 estados de turma são aceitos; vagas nunca passam da capacidade; inscrição fecha antes do início; divisão de pagamento sempre soma o valor pago; regras de cobrança iniciais do dono.
- **Catálogo:** 14 categorias nos 6 idiomas, inglês quando o idioma não existe, só anuncia funções realmente configuradas.
- **Cadastro:** aprender (aluno) e ensinar (professor em verificação), consentimento com versão, códigos de erro por campo, e-mail repetido, senha nunca guardada pura, IP nunca guardado puro.
- **Login e sessões:** maiúsculas/espaços, mesma resposta para senha errada e e-mail inexistente, bloqueio após 10 erros por 15 min, expiração, conta suspensa perde o acesso, auditoria.
- **Conta:** perfil, troca de senha derruba os outros aparelhos, desconectar aparelho, não mexe em aparelho de outra pessoa, aluno pode pedir para ensinar.
- **Papéis:** área de administrador recusa aluno e aceita administrador (checado no servidor).
- **Recuperação de senha:** indisponível sem e-mail configurado; com e-mail, link de uso único, expira em 1 hora e desconecta todos os aparelhos.

- **Regra da turma (`class-access`):** só compra quem está de fora, antes do início e com vaga; lotada, encerrada, ao vivo, iniciada ou terminada não deixa ninguém de fora clicar; inscrito entra ao vivo e vê a gravação; o horário vale mais que o estado gravado; rascunho não aparece.

- **Fase 2 (`catalog.test.ts`):** professor novo prepara rascunho mas não publica; verificação exige dados fiscais e os trava; admin aprova/recusa com registro e aviso; aluno não entra na área do professor nem do admin; grupo valida vagas (máx. 25), datas futuras, encontros sobrepostos, prazo; professor não tem duas aulas na mesma hora; grupo publicado não muda; cancelar tira do catálogo; curso com grupo aberto não arquiva; agenda em ordem; rascunho invisível; de fora só compra antes do início; terminado sai da busca; busca por título, professor e categoria + filtros e ordenação; perfil público só de aprovado; favoritos pessoais; foto só imagem real; capa só pelo dono do curso.

## Também conferido no navegador (celular 390px e 360px)
Abertura em ES/PT/EN/FR/DE, escolha aprender/ensinar, cadastro com erros e com sucesso, início com categorias reais, sair, login com erro, aviso de recuperação indisponível, sem rolagem lateral.

## Próximas fases (já planejados)
Pagamentos em sandbox, regra de turma fechada nas inscrições, acesso às gravações, emissão e verificação de certificados. O pipeline no GitHub Actions é do Cloud 2 (veja DEPLOY.md).
