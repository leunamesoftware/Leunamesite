# LeuName Gestão — Desktop (Electron)

Scaffold real para gerar o instalador Windows `Instalar-LeuName-Gestao.exe`.

## Como gerar o instalador

Pré-requisitos: Node.js 18+ instalado no computador que fará o build
(pode ser Windows, macOS ou Linux — o electron-builder consegue gerar
o `.exe` a partir de qualquer um deles, mas gerar no próprio Windows é
o caminho mais simples e confiável).

```bash
cd electron
npm install
npm run dist:win
```

O instalador final aparece em `electron/release/Instalar-LeuName-Gestao-1.0.0.exe`.

## O que este scaffold já faz de verdade

- Abre o LeuName Gestão (`app/index.html`, cópia exata do sistema web)
  em uma janela desktop nativa do Windows.
- Menu nativo em português, atalhos, tela cheia, zoom.
- Downloads (backup `.json`, relatórios `.csv`) abrem o diálogo nativo
  "Salvar como" do Windows.
- Impressão nativa via `window.print()` (mesmo mecanismo do navegador).
- Gera um instalador `.exe` profissional via NSIS, com atalho na área
  de trabalho e no menu Iniciar.

## O que falta para produção (infraestrutura fora deste ambiente)

1. **Ícone**: adicionar `build/icon.ico` com a marca oficial (ver
   `build/LEIA-ME-icone.txt`).
2. **Assinatura de código (code signing)**: sem um certificado válido,
   o Windows SmartScreen exibirá aviso de "editor desconhecido" ao
   instalar. É necessário comprar um certificado de assinatura de
   código (ex.: DigiCert, Sectigo) e configurar `win.certificateFile`
   no `package.json` do electron-builder.
3. **Auto-atualização**: hoje cada nova versão exige reinstalar
   manualmente. Para atualização automática real, usar
   `electron-updater` apontando para um servidor de releases (pode ser
   um bucket S3/Cloudflare R2 simples com o feed `latest.yml`).
4. **Sincronização com Google Drive/OneDrive/Dropbox**: ver seção
   correspondente no README principal do projeto — precisa de app
   OAuth registrado em cada provedor.

Nada disso é simulado neste scaffold: são passos reais de
infraestrutura que precisam ser executados pela LeuName Softwares
antes da distribuição comercial (§40 do briefing original).
