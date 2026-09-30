# Padrões LeuName Softwares (Google Play)

- Conta Play Console: organização (SUPER MISTO TEMPEROS LTDA, D-U-N-S 939102424).
- Publicação automática: secret `PLAY_SERVICE_ACCOUNT_JSON` (conta de serviço leuplay-publicador). Nunca colocar a chave no código.
- App novo: o dono cria no Play Console (nome, pacote, Português (Brasil), App/Jogo, **Gratuito**, declarações, proteção automática ativada) e envia o 1º AAB à mão. Depois disso as versões sobem pelo workflow.
- Ciclo: melhorias vão para **Teste interno**; só vão para Produção quando o dono disser "liberado".
- Cobrança: app gratuito + assinatura dentro do app, **7 dias de teste grátis**. Preço sugerido pelo Claude (Gestacell: R$ 19,90/mês, R$ 199,90/ano, R$ 9,90 nos 3 primeiros meses).
- Imagens/descrições da loja: `ANDROID/materiais-play-store/<app>/`.
- Evitar o número 13 em textos, exemplos e prints.
- Toda versão enviada à Play aumenta o versionCode.
