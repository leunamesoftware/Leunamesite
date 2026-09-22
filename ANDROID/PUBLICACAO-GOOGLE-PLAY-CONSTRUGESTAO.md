# ConstruGestão — Publicação na Google Play

Este documento explica o que já está pronto no projeto e o que ainda
precisa ser feito manualmente no Google Play Console para publicar.

## O que já está pronto no projeto

- **Nome do app:** ConstruGestão
- **Package name (applicationId):** `com.leunamesoftwares.construgestao`
  — este identificador é **definitivo**: depois de publicado uma vez,
  nunca pode ser trocado. Já está definido desde a primeira entrega.
- **Ícone oficial:** aplicado (ícone adaptativo Android 8+, com margem
  de segurança testada, mais os ícones legados) — casinha branca com
  gráfico de crescimento, fundo laranja.
- **Versão:** controlada em
  `ANDROID/projeto-instalador-construgestao/versao-release.properties`
  (`versionCode` e `versionName`).
- **Assinatura de release:** keystore gerado (exclusivo do ConstruGestão,
  diferente do keystore do Gestacell), workflow configurado para assinar
  o `.aab` automaticamente usando os secrets do repositório (ver
  `.github/workflows/build-android-construgestao-release.yml`).
- **Licença/ativação:** intocada — a tela "Ativação da licença" continua
  obrigatória na primeira abertura.
- **Funcionamento offline/local:** intocado — banco de dados local
  (IndexedDB) e todos os módulos continuam 100% iguais.
- **Política de privacidade:** já publicada em
  `https://api.leunamesoftware.com/privacidade?app=construgestao`.

## Como gerar o .aab (agora ou no futuro)

1. Se for uma atualização, abra
   `ANDROID/projeto-instalador-construgestao/versao-release.properties`
   e aumente o `versionCode` (ex.: de 1 para 2). Ajuste `versionName` se
   quiser (ex.: "1.0.1").
2. No GitHub, aba **Actions** → workflow **"Build Android AAB
   ConstruGestão (Google Play)"** → **Run workflow**.
3. Ao terminar, baixe o artifact **ConstruGestao-Android-AAB** — vem
   um `.zip` contendo o arquivo `ConstruGestao.aab` real dentro.

Isso só funciona depois que os 4 secrets abaixo forem cadastrados no
repositório (ver seção seguinte).

## Secrets necessários (uma vez só)

No GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, cadastre estes 4. **São segredos SEPARADOS dos do Gestacell —
cada app tem sua própria chave de assinatura, não misture.**

- `ANDROID_CONSTRUGESTAO_KEYSTORE_B64_PART1` até `..._PART5` (o arquivo
  `.keystore` convertido para texto base64, dividido em 5 pedaços curtos
  — cada um cabe numa tela de celular sem rolar, pra evitar colagem
  incompleta)
- `ANDROID_CONSTRUGESTAO_KEYSTORE_PASSWORD`
- `ANDROID_CONSTRUGESTAO_KEY_ALIAS`
- `ANDROID_CONSTRUGESTAO_KEY_PASSWORD`

O arquivo `.keystore` original já foi entregue diretamente (fora deste
documento, por segurança). As senhas e o alias também já foram passados
separadamente.

⚠️ **O arquivo `.keystore` precisa ser guardado em local seguro e com
backup pela LeuName Softwares.** Se ele for perdido, não tem como gerar
outro igual — a Google não permite trocar a chave de assinatura de um
app já publicado (a não ser por um processo especial e limitado de
recuperação de conta).

## O que falta fazer no Google Play Console (fora deste projeto)

1. **Criar o app** no Play Console (mesma conta de desenvolvedor já
   verificada), usando o package name `com.leunamesoftwares.construgestao`.
2. **Enviar o `.aab`** gerado pelo workflow na seção de "Produção" (ou
   primeiro em "Teste interno/fechado", recomendado antes de ir para
   produção).
3. **Ficha da loja (Store listing):** ver
   `ANDROID/TEXTOS-FICHA-DA-LOJA-PLAY-STORE-CONSTRUGESTAO.md` para os
   textos prontos. Ícone 512x512 já pronto em
   `ANDROID/projeto-instalador-construgestao/icones-oficiais/ic_launcher_play_store_512.png`.
   Ainda faltam: imagem de destaque (feature graphic, 1024x500) e pelo
   menos 2 capturas de tela do app em uso.
4. **Questionário de classificação de conteúdo** (content rating) —
   formulário dentro do próprio Play Console.
5. **Formulário de segurança de dados (Data safety)** — mesma resposta
   do Gestacell: o app funciona local/offline e só transmite dados para
   sincronizar entre os aparelhos do próprio lojista (mesma chave de
   licença), nunca para terceiros nem publicidade.
6. **Categoria do app** (Negócios) e público-alvo.
7. Revisar e enviar para análise da Google.
