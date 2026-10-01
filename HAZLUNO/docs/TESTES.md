# Testes

```bash
cd HAZLUNO/backend && npm test        # 30 testes (banco em memória, sem internet)
cd HAZLUNO/backend && npm run typecheck
cd HAZLUNO/frontend && npm run build  # checagem de tipos + build
```

## O que está coberto (Fase 1)
- **Banco:** existem todas as entidades do prompt mestre; só os 8 estados de turma são aceitos; vagas nunca passam da capacidade; inscrição fecha antes do início; divisão de pagamento sempre soma o valor pago; regras de cobrança iniciais do dono.
- **Catálogo:** 12 categorias nos 6 idiomas, inglês quando o idioma não existe, só anuncia funções realmente configuradas.
- **Cadastro:** aprender (aluno) e ensinar (professor em verificação), consentimento com versão, códigos de erro por campo, e-mail repetido, senha nunca guardada pura, IP nunca guardado puro.
- **Login e sessões:** maiúsculas/espaços, mesma resposta para senha errada e e-mail inexistente, bloqueio após 10 erros por 15 min, expiração, conta suspensa perde o acesso, auditoria.
- **Conta:** perfil, troca de senha derruba os outros aparelhos, desconectar aparelho, não mexe em aparelho de outra pessoa, aluno pode pedir para ensinar.
- **Papéis:** área de administrador recusa aluno e aceita administrador (checado no servidor).
- **Recuperação de senha:** indisponível sem e-mail configurado; com e-mail, link de uso único, expira em 1 hora e desconecta todos os aparelhos.

## Também conferido no navegador (celular 390px e 360px)
Abertura em ES/PT/EN/FR/DE, escolha aprender/ensinar, cadastro com erros e com sucesso, início com categorias reais, sair, login com erro, aviso de recuperação indisponível, sem rolagem lateral.

## Próximas fases (já planejados)
Pagamentos em sandbox, regra de turma fechada nas inscrições, acesso às gravações, emissão e verificação de certificados. O pipeline no GitHub Actions é do Cloud 2 (veja DEPLOY.md).
