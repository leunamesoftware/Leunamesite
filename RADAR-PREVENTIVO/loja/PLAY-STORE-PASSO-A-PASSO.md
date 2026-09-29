# Radar Preventivo — Play Store

Tudo o que vai na Play Console, pronto para copiar. Tudo o que está aqui descreve
só o que o app faz de verdade.

## Arquivos para enviar

| O quê | Arquivo |
|---|---|
| App (AAB) | baixar em GitHub → Actions → "Gerar AAB do Radar Preventivo" → Artifacts → `RadarPreventivo-Play-Store` |
| Ícone (512×512) | `marca/icone-play-store-512.png` |
| Imagem de destaque (1024×500) | `loja/imagem-destaque-1024x500.png` |
| Capturas de tela do celular | `loja/capturas/1-abertura.png` até `6-cadastrar.png` (1080×1920) |

## Dados do app

- **Nome do app:** Radar Preventivo
- **ID do pacote:** `com.radarpreventivo.app` (não dá para mudar depois do primeiro envio)
- **Categoria:** Produtividade
- **Gratuito**
- **Política de privacidade:** https://radar-preventivo.emanuelantunes2024.workers.dev/privacidade.html
- **Excluir conta (link pedido pela Play):** https://radar-preventivo.emanuelantunes2024.workers.dev/excluir-conta.html

## Textos da ficha da loja

**Descrição curta (até 80 caracteres):**

> Controle vencimentos de documentos e prazos e receba alertas antes de vencer.

**Descrição completa:**

> O Radar Preventivo acompanha seus documentos, obrigações e prazos e avisa antes que vençam.
>
> Cadastre o que precisa ser renovado ou pago — CNH, IPVA, alvará, contrato, seguro, qualquer prazo — com a data de vencimento. O Radar analisa cada item na hora e todos os dias:
>
> • Mostra no painel o que está vencido, o que é urgente, o que pede atenção e o que está em dia.
> • Gera alertas dentro do app quando um item entra em atenção, fica urgente, vence hoje ou vence.
> • Traz uma orientação preventiva com os próximos passos para cada situação.
> • Guarda o histórico de cada item, mesmo depois de resolvido.
> • Permite anexar o documento (PDF, JPG ou PNG) para ter tudo em um lugar só.
> • Radar animado que destaca o que precisa de ação agora.
>
> Você escolhe com quanta antecedência quer começar a ser avisado. Seus dados ficam na sua conta, os arquivos anexados são privados e você pode excluir sua conta e tudo o que cadastrou a qualquer momento, pelo próprio app.
>
> Protege seu hoje. Evita problemas amanhã.

## Segurança dos dados (formulário da Play)

- **O app coleta dados?** Sim.
- **Os dados são compartilhados com terceiros?** Não.
- **Os dados são criptografados em trânsito?** Sim (HTTPS).
- **A pessoa pode pedir a exclusão dos dados?** Sim (no app: Conta → Excluir conta; e pelo link acima).
- **Tipos de dados coletados** (todos: coletados, não compartilhados, obrigatórios para o app funcionar; finalidade: **Funcionalidade do app** e **Gerenciamento da conta**):
  - Informações pessoais → **Nome** e **Endereço de e-mail**
  - Arquivos e documentos → **Arquivos e documentos** (anexos que a pessoa escolhe enviar; opcional)
  - Atividade no app → **Outros conteúdos gerados pelo usuário** (documentos e prazos cadastrados)
- **Anúncios:** o app não tem anúncios.

## Outras declarações

- **Acesso ao app:** o app pede login. Crie uma conta só para a revisão da Google (pelo próprio app, em "Criar conta") e informe o e-mail e a senha nesse campo.
- **Público-alvo:** 18 anos ou mais.
- **Classificação de conteúdo:** responder "Não" a violência, sexo, drogas, jogos de azar etc. É um app de produtividade. O resultado esperado é "Livre".
- **App de notícias / governo / saúde / finanças:** Não.

## Teste interno (usar pela Play antes dos 14 dias)

1. Play Console → **Criar app** → nome "Radar Preventivo", idioma Português (Brasil), App, Gratuito.
2. Menu **Testar e lançar → Testes → Teste interno** → **Criar nova versão**.
3. Envie o arquivo `RadarPreventivo.aab`. Em "Nome da versão", pode deixar o sugerido (1.0.0).
4. **Salvar → Revisar versão → Iniciar lançamento para teste interno.**
5. Aba **Testadores** → crie uma lista com os e-mails (conta Google) de quem vai testar (até 100 pessoas), incluindo o seu.
6. Copie o **link de participação** e mande para os testadores. Cada um abre o link no celular, toca em "Aceitar" e instala pela Play Store normalmente.

O teste interno costuma liberar em minutos, sem esperar os 14 dias. Se a Play pedir alguma declaração antes, os textos acima já cobrem.

## Chave de assinatura (importante)

Na primeira geração do AAB, o pacote de download vem com `RadarPreventivo-chave-assinatura.keystore` e `LEIA-ISSO-chave-de-assinatura.txt`. **Guarde os dois em pelo menos 2 lugares seguros.** Toda atualização futura do app precisa dessa mesma chave.
