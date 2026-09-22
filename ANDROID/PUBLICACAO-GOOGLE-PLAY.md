# Gestacell — Publicação na Google Play

Este documento explica o que já está pronto no projeto e o que ainda
precisa ser feito manualmente no Google Play Console para publicar.

## O que já está pronto no projeto

- **Nome do app:** Gestacell
- **Package name (applicationId):** `com.leunamesoftwares.gestacell`
  — este identificador é **definitivo**: depois de publicado uma vez,
  nunca pode ser trocado. Já está definido desde a primeira entrega.
- **Ícone oficial:** aplicado (ícone adaptativo Android 8+, com margem
  de segurança testada, mais os ícones legados).
- **Versão:** controlada em
  `ANDROID/projeto-instalador-android/versao-release.properties`
  (`versionCode` e `versionName`).
- **Assinatura de release:** keystore gerado, workflow configurado
  para assinar o `.aab` automaticamente usando os secrets do
  repositório (ver `.github/workflows/build-android-release.yml`).
- **Licença/ativação:** intocada — a tela "Ativação da licença" continua
  obrigatória na primeira abertura, exatamente como já funciona no APK.
- **Funcionamento offline/local:** intocado — banco de dados local
  (IndexedDB) e todos os módulos continuam 100% iguais.

## Como gerar uma nova versão do .aab (agora ou no futuro)

1. Se for uma atualização, abra
   `ANDROID/projeto-instalador-android/versao-release.properties` e
   aumente o `versionCode` (ex.: de 1 para 2). Ajuste `versionName` se
   quiser (ex.: "1.0.1").
2. No GitHub, aba **Actions** → workflow **"Build Android AAB (Google
   Play)"** → **Run workflow**.
3. Ao terminar, baixe o artifact **LeuName-Gestao-Android-AAB** — vem
   um `.zip` contendo o arquivo `LeuName-Gestao.aab` real dentro.

Isso só funciona depois que os 4 secrets abaixo forem cadastrados no
repositório (ver seção seguinte).

## Secrets necessários (uma vez só)

No GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, cadastre estes 4 (os valores foram entregues separadamente,
fora deste arquivo, por segurança):

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

⚠️ **O arquivo `.keystore` original (antes de virar base64) precisa ser
guardado em local seguro e com backup pela LeuName Softwares.** Se ele
for perdido, não tem como gerar outro igual — a Google não permite
trocar a chave de assinatura de um app já publicado (a não ser por um
processo especial e limitado de recuperação de conta).

## O que falta fazer no Google Play Console (fora deste projeto)

1. **Criar a conta de desenvolvedor** (taxa única de US$ 25) em
   https://play.google.com/console, se ainda não tiver.
2. **Criar o app** no Play Console, usando o mesmo package name
   `com.leunamesoftwares.gestacell`.
3. **Enviar o `.aab`** gerado pelo workflow na seção de "Produção"
   (ou primeiro em "Teste interno/fechado", recomendado antes de ir
   para produção).
4. **Ficha da loja (Store listing):** título, descrição curta e longa,
   ícone (512x512 — já temos em
   `ANDROID/projeto-instalador-android/icones-oficiais/ic_launcher_play_store_512.png`),
   imagem de destaque (feature graphic, 1024x500 — ainda precisa ser
   criada), e pelo menos 2 capturas de tela do app em uso.
5. **Política de privacidade:** a Google exige uma URL pública com a
   política de privacidade do app (mesmo sendo um app de uso local/
   offline). Precisa estar hospedada em algum lugar (site da LeuName,
   por exemplo) — ainda não existe.
6. **Questionário de classificação de conteúdo** (content rating) —
   formulário dentro do próprio Play Console.
7. **Formulário de segurança de dados (Data safety)** — declarar quais
   dados o app coleta. Como o Gestacell funciona local/offline e
   não envia dados a servidor algum, a resposta tende a ser "não
   coleta/compartilha dados", mas o formulário precisa ser preenchido.
8. **Categoria do app** e público-alvo (classificação indicativa).
9. Revisar e enviar para análise da Google (a primeira revisão de um
   app novo costuma levar alguns dias).

Os itens 4 a 8 são cadastro dentro do próprio Play Console — não
dependem de nenhuma mudança de código, mas precisam ser preenchidos por
alguém da LeuName Softwares antes de conseguir publicar.
