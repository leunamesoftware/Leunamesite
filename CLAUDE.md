# Padrões LeuName Softwares (Google Play)

- Conta Play Console: organização (SUPER MISTO TEMPEROS LTDA, D-U-N-S 939102424).
- Publicação automática: secret `PLAY_SERVICE_ACCOUNT_JSON` (conta de serviço leuplay-publicador). Nunca colocar a chave no código.
- App novo: o dono cria no Play Console (nome, pacote, Português (Brasil), App/Jogo, **Gratuito**, declarações, proteção automática ativada) e envia o 1º AAB à mão. Depois disso as versões sobem pelo workflow.
- Ciclo: melhorias vão para **Teste interno**; só vão para Produção quando o dono disser "liberado".
- Cobrança: app gratuito + assinatura dentro do app, **7 dias de teste grátis**. Preço sugerido pelo Claude (Gestacell: R$ 19,90/mês, R$ 199,90/ano, R$ 9,90 nos 3 primeiros meses).
- Imagens/descrições da loja: `ANDROID/materiais-play-store/<app>/`.
- Evitar o número 13 em textos, exemplos e prints.
- Toda versão enviada à Play aumenta o versionCode.

## Códigos dos apps (o dono chama por B1, B2, B3…)

| Código | App | Pacote | Situação |
|---|---|---|---|
| B1 | Gestacell | com.leunamesoftwares.gestacell | Produção 1.0.4 em análise; 1.0.5 (teste de 7 dias) pronta para subir depois da aprovação |
| B2 | Radar Preventivo | com.radarpreventivo.app | Teste interno (não lançar até o dono dizer "liberado") |

## Divisão de trabalho (acordo Cloud 1 × Cloud 2)

- **Cloud 1:** código dos apps (telas, regras, pagamentos no app, analytics, notificações, hash de senha) e os testes de cada função nova.
- **Cloud 2:** `.github/workflows`, `.github/scripts`, `wrangler.toml` (rotas, bindings, cron), backups, monitoramento, publicação na Play Store e materiais da loja.
- Cada um no seu branch; junta no principal por PR. Ninguém dá push direto no principal.
- Comunicação: issues no GitHub com etiqueta `cloud1` ou `cloud2`.
- Backups: `backup-bancos-d1.yml` (diário, 30 dias). Monitoramento: `monitoramento.yml` (de hora em hora, abre/fecha issue `cloud2`).
- LeuCloud fica fora de backup/monitoramento/publicação por decisão do dono. EconoRota é de cliente: publicar só com ok do dono.
