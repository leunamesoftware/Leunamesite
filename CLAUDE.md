# Padrões LeuName Softwares

> **A conta da Play Store foi banida (2026).** A venda agora é pela loja própria LeuApps. **Leia primeiro `PROXIMO-CLAUDE.md` no repositório `leunamesoftware/leuname-softwarea-apps` (branch `ccr-f58cd13b-ml0bzs`).** As regras de Play abaixo ficam só como histórico.

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

## Venda sem Play Store (atual)
A conta da Play foi banida. Os apps são vendidos pela loja própria LeuApps (www.leunamesoftware.com.br) e instalados pelo navegador (link do app + `?instalar=1`, botão Instalar). Pagou → e-mail automático com o link, pelo Gmail da empresa (segredo `GMAIL_SENHA_APP` na Cloudflare). Guia completo: `COMO-FUNCIONA-A-VENDA.md` no repositório `leunamesoftware/leuname-softwarea-apps` (branch `ccr-f58cd13b-ml0bzs`).
