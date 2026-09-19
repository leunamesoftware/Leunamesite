# LeuName Gestão — Gerar o instalador Windows e o APK Android pelo celular

Este repositório já vem pronto para o GitHub compilar os dois arquivos
reais para você, nos servidores dele — você não precisa de computador
nem instalar nada.

## O que vai ser gerado

- **Instalar-LeuName-Gestao-1.0.0.exe** — instalador Windows real
- **LeuName-Gestao.apk** — aplicativo Android real

## Não precisa de nenhum Secret

Os dois workflows abaixo rodam sozinhos, sem senha, sem token, sem
nenhuma configuração extra no GitHub. Não crie nenhum Secret — não é
necessário para esta etapa.

## Passo a passo, pelo celular

### 1. Criar o repositório privado
No navegador do celular, acesse **github.com**, entre na sua conta e
toque em **"New repository"** (ou o "+" no canto superior). Dê um nome
(ex: `leuname-gestao`), marque como **Private**, e crie.

### 2. Subir os arquivos deste projeto
Dentro do repositório recém-criado, toque em **"Add file" → "Upload
files"**. Envie **o conteúdo desta pasta** (tudo que está dentro de
`LEUNAME-GESTAO-ENTREGA/`, incluindo a pasta `.github` — ela pode vir
oculta, confirme que foi junto) direto na raiz do repositório — não
crie mais uma subpasta "LEUNAME-GESTAO-ENTREGA" dentro dele.

Se o navegador do celular não deixar arrastar a pasta inteira de uma
vez, o GitHub aceita selecionar vários arquivos e pastas juntos pela
caixa de seleção de arquivos do celular — selecione tudo de uma vez.

Confirme o envio ("Commit changes").

### 3. Gerar o instalador Windows
No repositório, toque na aba **"Actions"**. Você verá dois workflows na
lista à esquerda: **"Build Windows EXE"** e **"Build Android APK"**.

Toque em **"Build Windows EXE"** → toque no botão **"Run workflow"**
(pode aparecer um pequeno menu, é só confirmar) → aguarde. Leva alguns
minutos. Uma bolinha amarela girando vira um ✅ verde quando termina.

Toque na execução que terminou → role até o final da página → seção
**"Artifacts"** → toque em **"Instalar-LeuName-Gestao-Windows"** para
baixar. É um `.zip` — dentro dele está o `.exe` de verdade.

### 4. Gerar o APK Android
Mesma coisa, só que no workflow **"Build Android APK"**. Esse demora um
pouco mais que o do Windows (é normal, ele monta o projeto Android do
zero a cada vez). Quando terminar, baixe o Artifact
**"LeuName-Gestao-Android"** — dentro está o `.apk` de verdade.

## Avisos normais que podem aparecer

- **Windows**: como o instalador não tem certificado de assinatura
  digital (isso é uma etapa comercial futura, opcional), o Windows pode
  avisar "Editor desconhecido" na instalação. Isso é normal para
  instaladores não assinados — o usuário clica em "Mais informações →
  Executar assim mesmo".
- **Android**: como o `.apk` não veio da Play Store, o Android vai pedir
  para autorizar "instalar de fontes desconhecidas" na primeira vez.
  Também é normal.

## Se algum workflow falhar

Toque na execução que falhou (ícone ❌) para ver em qual passo travou —
o GitHub mostra o log detalhado de cada etapa. Me mande o texto do erro
que eu te ajudo a resolver.

## O que não muda

Nada do sistema em si (módulos, regras, licença, banco de dados) foi
alterado nesta etapa — só foi adicionada a pasta `.github/workflows/`
para automatizar a compilação. Tudo o mais é exatamente o mesmo projeto
já entregue e testado.
